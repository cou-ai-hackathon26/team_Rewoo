#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# BanglaShield AI — Evaluation & Benchmarking Framework (runner)
#
# Single executable command that runs the COMPLETE evaluation pipeline:
#
#     python3 evaluation/run_evaluation.py
#
# Options:  --quick            reduced live-AI budget (skips Track B subset)
#           --base-url URL     application under test (default: config.yaml)
#           --skip SUITE ...   exclude suites by id (repeatable)
#           --only SUITE ...   run only these suites (repeatable)
#           --no-validate      skip the independent validation step
#           --strict-exit      exit 1 when the overall score is below baseline
#
# Suites:  repo_integrity, frontend, backend_api, detection, e2e,
#          security, latency
#
# Outputs (next to this file): results.json (machine-readable) and
# report.md (human-readable), both generated from measured data only.
#
# GUARANTEES (enforced by design, not by convention):
#   1. Nothing is hardcoded. Every metric originates from a live request
#      against base_url, a repository scan, or a toolchain subprocess that
#      executed during THIS run.
#   2. Failed checks are recorded as failures and printed — never suppressed,
#      never retried into submission.
#   3. Raw per-case / per-sample data is stored in results.json so every
#      aggregate can be independently recomputed by validate_results.py.
#   4. Rate-limit isolation uses virtual client IPs (the app's limiter is
#      X-Forwarded-For keyed by design — src/lib/rate-limit.ts: clientKey).
#      The identities used are recorded in results.json.
# ---------------------------------------------------------------------------

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import http.cookiejar
import json
import os
import platform
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))
import metrics as M  # noqa: E402  (shared pure math; also used by validator)

FRAMEWORK_NAME = "BanglaShield Evaluation Framework"
FRAMEWORK_VERSION = "1.0.0"

SUITE_ORDER = ["repo_integrity", "frontend", "backend_api", "detection", "e2e", "security", "latency"]

FLAGGED_VALUES = M.FLAGGED_VALUES
TERMINAL_SESSION_STATUS = {"completed", "failed", "canceled", "expired"}


class FrameworkError(RuntimeError):
    """Infrastructure failure of the harness itself (never a product finding)."""


def log(msg: str) -> None:
    print(msg, flush=True)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Configuration loading (PyYAML when available; fallback mini-parser keeps the
# framework runnable on a bare CPython install for our config's YAML subset)
# ---------------------------------------------------------------------------

def _coerce_scalar(s: str) -> Any:
    s2 = s.strip()
    if s2.lower() in ("true", "false"):
        return s2.lower() == "true"
    try:
        return int(s2)
    except ValueError:
        pass
    try:
        return float(s2)
    except ValueError:
        pass
    return s2


def _mini_yaml(text: str) -> dict[str, Any]:
    """Minimal YAML subset parser: nested maps (2-space indent), `- item`
    lists, and scalar values. Sufficient for evaluation/config.yaml."""
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-1, root)]
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        line = raw.strip()
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if line.startswith("- "):
            # list item under the last key of parent
            last_key = list(parent.keys())[-1] if parent else None
            if last_key is None:
                continue
            if not isinstance(parent[last_key], list):
                parent[last_key] = []
            parent[last_key].append(_coerce_scalar(line[2:]))
            continue
        if ":" not in line:
            continue
        key, _, rest = line.partition(":")
        key = key.strip()
        rest = rest.strip()
        if rest == "":
            child: dict[str, Any] = {}
            parent[key] = child
            stack.append((indent, child))
        else:
            parent[key] = _coerce_scalar(rest)
    return root


def load_config(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore

        cfg = yaml.safe_load(text)
    except ImportError:
        cfg = _mini_yaml(text)
    if not isinstance(cfg, dict):
        raise FrameworkError("config.yaml did not parse into a mapping")
    for key in ("base_url", "thresholds", "weights", "timeouts"):
        if key not in cfg:
            raise FrameworkError(f"config.yaml missing required key: {key}")
    wsum = sum(cfg["weights"].values())
    if abs(wsum - 1.0) > 1e-9:
        raise FrameworkError(f"weights must sum to 1.0 (got {wsum})")
    return cfg


# ---------------------------------------------------------------------------
# HTTP client (stdlib only; per-client cookie jar + virtual client IP)
# ---------------------------------------------------------------------------

class Resp:
    def __init__(self, status: int, headers: list[tuple[str, str]], body: bytes, elapsed_ms: float, url: str):
        self.status = status
        self.headers = [(k.lower(), v) for k, v in headers]
        self.body = body
        self.elapsed_ms = elapsed_ms
        self.url = url

    def header(self, name: str, default: str | None = None) -> str | None:
        n = name.lower()
        for k, v in self.headers:
            if k == n:
                return v
        return default

    def header_all(self, name: str) -> list[str]:
        n = name.lower()
        return [v for k, v in self.headers if k == n]

    def json(self) -> Any:
        try:
            return json.loads(self.body.decode("utf-8", "replace"))
        except Exception:
            return None

    def text(self) -> str:
        return self.body.decode("utf-8", "replace")


class Client:
    def __init__(self, base_url: str, virtual_ip: str | None = None, timeout_ms: int = 30000):
        self.base = base_url.rstrip("/")
        self.ip = virtual_ip
        self.timeout_s = timeout_ms / 1000.0
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(
        self,
        method: str,
        path: str,
        json_body: Any = None,
        raw_body: bytes | None = None,
        content_type: str | None = None,
        timeout_ms: int | None = None,
    ) -> Resp:
        url = self.base + path
        data: bytes | None = None
        headers = {"Accept": "application/json"}
        if self.ip:
            headers["X-Forwarded-For"] = self.ip
        if json_body is not None:
            data = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif raw_body is not None:
            data = raw_body
        if content_type:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(url, data=data, method=method.upper(), headers=headers)
        t0 = time.monotonic()
        timeout = (timeout_ms / 1000.0) if timeout_ms else self.timeout_s
        try:
            with self.opener.open(req, timeout=timeout) as res:
                body = res.read()
                hdrs = list(res.headers.items())
                status = res.status
        except urllib.error.HTTPError as e:
            try:
                body = e.read()
                hdrs = list(e.headers.items()) if e.headers else []
                status = e.code
            except Exception:
                body, hdrs, status = b"", [], e.code
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise FrameworkError(f"request {method} {url} failed: {e}") from e
        elapsed = (time.monotonic() - t0) * 1000.0
        return Resp(status, hdrs, body, elapsed, url)

    def get(self, path: str, timeout_ms: int | None = None) -> Resp:
        return self.request("GET", path, timeout_ms=timeout_ms)

    def post_json(self, path: str, obj: Any, timeout_ms: int | None = None) -> Resp:
        return self.request("POST", path, json_body=obj, timeout_ms=timeout_ms)


# ---------------------------------------------------------------------------
# Frozen benchmark dataset extraction (from the product's own source of truth)
# ---------------------------------------------------------------------------

ENTRY_RX = re.compile(
    r'\{\s*id:\s*"([^"]+)",\s*language:\s*"([^"]+)",\s*label:\s*"([^"]+)",'
    r'\s*subtype:\s*"([^"]+)",\s*text:\s*"((?:\\.|[^"\\])*)"\s*\}'
)


def extract_dataset(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    samples: list[dict[str, str]] = []
    for m in ENTRY_RX.finditer(text):
        raw_text = m.group(5)
        try:
            decoded = json.loads('"' + raw_text + '"')
        except Exception:
            decoded = raw_text
        samples.append(
            {
                "id": m.group(1),
                "language": m.group(2),
                "label": m.group(3),
                "subtype": m.group(4),
                "text": decoded,
            }
        )
    if not samples:
        raise FrameworkError(f"no benchmark samples parsed from {path}")
    return samples


def dataset_digest(samples: Sequence[Mapping[str, str]]) -> str:
    canonical = json.dumps(sorted(samples, key=lambda s: s["id"]), ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def stratified_picks(samples: Sequence[Mapping[str, str]], per_stratum: int) -> list[dict[str, str]]:
    strata: dict[tuple[str, str], list[dict[str, str]]] = {}
    for s in samples:
        strata.setdefault((s["language"], s["label"]), []).append(dict(s))  # type: ignore[arg-type]
    picks: list[dict[str, str]] = []
    for key in sorted(strata):
        lst = sorted(strata[key], key=lambda x: x["id"])
        for k in range(per_stratum):
            idx = (k * len(lst)) // per_stratum
            picks.append(lst[idx])
    return picks


def api_language_of(lang: str) -> str:
    return "bn" if lang == "bn" else "en"


# ---------------------------------------------------------------------------
# Suite scaffolding
# ---------------------------------------------------------------------------

class Suite:
    def __init__(self, suite_id: str, name: str, weight: float, description: str):
        self.id = suite_id
        self.name = name
        self.weight = weight
        self.description = description
        self.checks: list[dict[str, Any]] = []

    def record(
        self,
        cid: str,
        name: str,
        status: str,
        evidence: str,
        measured: Any = None,
        target: Any = None,
        details: Any = None,
    ) -> None:
        assert status in M.VALID_CHECK_STATUS, status
        entry: dict[str, Any] = {"id": cid, "name": name, "status": status, "evidence": evidence}
        if measured is not None:
            entry["measured"] = measured
        if target is not None:
            entry["target"] = target
        if details is not None:
            entry["details"] = details
        self.checks.append(entry)
        tag = {"passed": "PASS", "failed": "FAIL", "skipped": "SKIP"}[status]
        extra = ""
        if measured is not None and target is not None:
            extra = f" (measured={measured}, target={target})"
        elif measured is not None:
            extra = f" (measured={measured})"
        log(f"    [{tag}] {cid} {name}{extra}")

    def check(self, cid: str, name: str, ok: bool, evidence: str, measured: Any = None, target: Any = None, details: Any = None) -> bool:
        self.record(cid, name, "passed" if ok else "failed", evidence, measured, target, details)
        return ok

    def skip(self, cid: str, name: str, reason: str) -> None:
        self.record(cid, name, "skipped", f"skipped: {reason}")

    def finish(self, duration_s: float) -> dict[str, Any]:
        counts = M.suite_counts(self.checks)
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "weight": self.weight,
            "checks": self.checks,
            "counts": counts,
            "score": M.suite_score(self.checks),
            "durationSec": round(duration_s, 2),
        }


class Ctx:
    def __init__(self, config: dict[str, Any], root: Path, quick: bool):
        self.config = config
        self.root = root
        self.quick = quick
        self.base_url: str = config["base_url"]
        self.nonce = 100 + (int(time.time()) % 100)  # per-run virtual-client offset
        self.dataset: list[dict[str, str]] | None = None
        self.track_b_latencies: list[float] | None = None
        self.notes: list[str] = []

    def vip(self, key: str) -> str:
        """Virtual client IP for a suite scope. Configured addresses ending in
        '.9' are placeholders: the last octet is replaced by the run nonce so
        repeated runs never exhaust each other's rate-limit buckets."""
        raw = str(self.config["virtual_clients"][key])
        if raw.endswith(".9"):
            return raw[: -len("9")] + str(self.nonce)
        return raw


def run_tool(root: Path, args: Sequence[str], timeout_s: int) -> dict[str, Any]:
    try:
        proc = subprocess.run(
            list(args),
            cwd=str(root),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_s,
        )
        return {
            "cmd": " ".join(args),
            "exit": proc.returncode,
            "stdout": (proc.stdout or "")[-4000:],
            "stderr": (proc.stderr or "")[-2000:],
        }
    except subprocess.TimeoutExpired:
        return {"cmd": " ".join(args), "exit": None, "stdout": "", "stderr": "timeout", "timeout": True}


def file_lines(path: Path) -> list[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []


# ---------------------------------------------------------------------------
# Suite: repo_integrity (code quality, toolchain, architecture consistency)
# ---------------------------------------------------------------------------

def run_repo_integrity(ctx: Ctx) -> dict[str, Any]:
    cfg = ctx.config
    s = Suite("repo_integrity", "Repository & toolchain integrity", cfg["weights"]["repo_integrity"],
              "Static verification: typecheck, lint, existing regression tests, schema, architecture rules, secrets hygiene.")
    t0 = time.monotonic()

    # RI-01 typecheck -------------------------------------------------------
    r = run_tool(ctx.root, ["bun", "run", "typecheck"], int(cfg["timeouts"]["subprocess_ms"] / 1000))
    ts_errors = len(re.findall(r"error TS", r["stdout"] + r["stderr"]))
    s.check("RI-01", "TypeScript typecheck passes with zero errors", r["exit"] == 0 and ts_errors == 0,
            f"bun run typecheck (cwd=repo) exit={r['exit']}, diagnostics={ts_errors}",
            measured=ts_errors, target=0)

    # RI-02 lint ------------------------------------------------------------
    r = run_tool(ctx.root, ["bun", "run", "lint"], int(cfg["timeouts"]["subprocess_ms"] / 1000))
    lint_out = r["stdout"] + r["stderr"]
    m_err = re.search(r"(\d+)\s+error", lint_out)
    m_warn = re.search(r"(\d+)\s+warning", lint_out)
    n_err = int(m_err.group(1)) if m_err else 0
    n_warn = int(m_warn.group(1)) if m_warn else 0
    s.check("RI-02", "ESLint passes with zero errors", r["exit"] == 0 and n_err == 0,
            f"bun run lint exit={r['exit']}, errors={n_err}, warnings={n_warn}",
            measured=n_err, target=0, details={"warnings": n_warn})

    # RI-03 existing regression tests ---------------------------------------
    r = run_tool(ctx.root, ["bun", "test", "tests/"], int(cfg["timeouts"]["subprocess_ms"] / 1000))
    out = r["stdout"] + r["stderr"]
    m_pass = re.search(r"(\d+)\s+pass\b", out)
    m_fail = re.search(r"(\d+)\s+fail\b", out)
    n_pass = int(m_pass.group(1)) if m_pass else 0
    n_fail = int(m_fail.group(1)) if m_fail else (0 if r["exit"] == 0 else -1)
    s.check("RI-03", "Existing regression suite passes (tests/technova.test.ts)", r["exit"] == 0 and n_fail == 0 and n_pass > 0,
            f"bun test tests/ exit={r['exit']}, pass={n_pass}, fail={n_fail}",
            measured=n_pass, target=n_pass, details={"failed": n_fail})

    # RI-04 prisma validate --------------------------------------------------
    r = run_tool(ctx.root, ["bunx", "prisma", "validate"], 180)
    s.check("RI-04", "Prisma schema validates", r["exit"] == 0,
            f"bunx prisma validate exit={r['exit']}; " + ("schema valid" if r["exit"] == 0 else (r["stderr"] or r["stdout"])[:160]))

    # RI-05 required models ---------------------------------------------------
    schema = ctx.root / "prisma" / "schema.prisma"
    models = set(re.findall(r"^model\s+(\w+)\s*\{", "\n".join(file_lines(schema)), re.MULTILINE))
    required = set(cfg["required_models"])
    missing = sorted(required - models)
    s.check("RI-05", "Core data models present in Prisma schema", not missing,
            f"prisma/schema.prisma declares {len(models)} models; required-but-missing: {missing or 'none'}",
            measured=len(models), target=len(required), details={"missing": missing})

    # RI-06 route convention --------------------------------------------------
    routes = [p for p in (ctx.root / "src" / "app" / "api").rglob("route.ts")]
    rel = [str(p.relative_to(ctx.root)) for p in routes]
    outside = [p for p in rel if not (p.startswith("src/app/api/v1/") or p == "src/app/api/route.ts")]
    s.check("RI-06", "API routes follow the versioned /api/v1 convention", not outside,
            f"{len(rel)} route.ts files; outside /api/v1 (excluding documented root scaffold): {outside or 'none'}",
            measured=len(rel), target=len(rel), details={"outside": outside})

    # RI-07 server-only AI SDK --------------------------------------------------
    offenders: list[str] = []
    for base_dir in ("src/lib", "src/components", "src/hooks", "src/app"):
        for p in (ctx.root / base_dir).rglob("*.[jt]s[x]"):
            if p.is_file():
                try:
                    body = p.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                if "z-ai-web-dev-sdk" in body:
                    rel_p = str(p.relative_to(ctx.root))
                    if not any(rel_p.startswith(pre) for pre in cfg["server_only_prefixes"]):
                        offenders.append(rel_p)
    s.check("RI-07", "AI SDK imported only by server-side code", not offenders,
            f"files importing z-ai-web-dev-sdk outside {cfg['server_only_prefixes']}: {offenders or 'none'}",
            measured=len(offenders), target=0)

    # RI-08 strict TS ------------------------------------------------------------
    tsconfig = ctx.root / "tsconfig.json"
    strict = '"strict"' in tsconfig.read_text(encoding="utf-8", errors="replace") and re.search(
        r'"strict"\s*:\s*true', tsconfig.read_text(encoding="utf-8", errors="replace")
    )
    s.check("RI-08", "TypeScript strict mode enabled", bool(strict), "tsconfig.json compilerOptions.strict == true")

    # RI-09 secrets hygiene -------------------------------------------------------
    r = run_tool(ctx.root, ["git", "ls-files"], 60)
    tracked = [f for f in (r["stdout"] or "").splitlines() if f.strip()]
    env_tracked = ".env" in tracked
    key_hits: list[str] = []
    scan_ext = (".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml", ".sh", ".css")
    key_rx = re.compile(r"sk-or-v1-[A-Za-z0-9]{16,}")
    for f in tracked:
        if f.endswith(scan_ext) and (ctx.root / f).is_file() and (ctx.root / f).stat().st_size < 2_000_000:
            if key_rx.search((ctx.root / f).read_text(encoding="utf-8", errors="replace")):
                key_hits.append(f)
    s.check("RI-09", "No tracked secrets (.env untracked; no plaintext provider keys)", (not env_tracked) and (not key_hits),
            f"git ls-files: .env tracked={env_tracked}; files matching sk-or-v1-… pattern: {key_hits or 'none'}",
            measured=len(key_hits), target=0, details={"envTracked": env_tracked})

    # RI-10 SPA shell references resolve ------------------------------------------
    shield = ctx.root / "src" / "components" / "shield"
    import_rx = re.compile(r'from\s+"(\.{1,2}/(?:pages/)?[^"]+)"')
    bad_imports: list[str] = []
    n_imports = 0
    for p in list(shield.glob("*.tsx")) + list(shield.glob("*.ts")):
        for spec in import_rx.findall(p.read_text(encoding="utf-8", errors="replace")):
            n_imports += 1
            target_file = (p.parent / spec).resolve()
            if not (target_file.with_suffix(".tsx").exists() or target_file.with_suffix(".ts").exists()
                    or target_file.with_suffix(".css").exists() or target_file.exists()):
                bad_imports.append(f"{p.name} -> {spec}")
    s.check("RI-10", "SPA shell module imports resolve on disk", not bad_imports,
            f"{n_imports} relative imports scanned in src/components/shield/*; unresolved: {bad_imports or 'none'}",
            measured=len(bad_imports), target=0)

    suite = s.finish(time.monotonic() - t0)
    suite["metrics"] = {
        "typecheck": {"exit": r is not None, "note": "see RI-01 evidence"},
        "trackedFiles": len(tracked),
        "routeCount": len(rel),
        "modelCount": len(models),
    }
    return suite


# ---------------------------------------------------------------------------
# Suite: frontend (HTTP-level verification of the served client bundle)
# ---------------------------------------------------------------------------

def run_frontend(ctx: Ctx) -> dict[str, Any]:
    cfg = ctx.config["frontend"]
    s = Suite("frontend", "Frontend served bundle verification", ctx.config["weights"]["frontend"],
              "The SPA is verified over HTTP: HTML shell, script chunks, and page markers actually served.")
    t0 = time.monotonic()
    client = Client(ctx.base_url, timeout_ms=ctx.config["timeouts"]["http_ms"])

    r = client.get("/")
    html = r.text()
    is_html = (r.status == 200) and "html" in (r.header("content-type") or "")
    s.check("FE-01", "Root page serves the HTML shell", is_html,
            f"GET / -> {r.status}, content-type={r.header('content-type')}, bytes={len(r.body)}",
            measured=r.status, target=200)

    has_title = re.search(r"<title>[^<]+</title>", html) is not None
    has_viewport = 'name="viewport"' in html
    has_lang = re.search(r"<html[^>]+lang=", html) is not None
    s.check("FE-02", "Document metadata present (title, viewport, lang)", has_title and has_viewport and has_lang,
            f"title={has_title}, viewport={has_viewport}, lang={has_lang}")

    script_srcs = re.findall(r'<script[^>]+src="([^"]+)"', html)
    fetched: dict[str, str] = {}
    fetch_fail: list[str] = []
    for src in script_srcs[: cfg["max_initial_scripts"]]:
        rr = client.get(src, timeout_ms=ctx.config["timeouts"]["http_ms"])
        if rr.status == 200 and "javascript" in (rr.header("content-type") or "").lower():
            fetched[src] = rr.text()
        else:
            fetch_fail.append(f"{src}->{rr.status}")
    s.check("FE-03", "All initial script chunks resolve (HTTP 200, JS content-type)", script_srcs and not fetch_fail,
            f"{len(script_srcs)} script srcs in HTML; fetched OK={len(fetched)}; failures={fetch_fail or 'none'}",
            measured=len(fetched), target=len(script_srcs[: cfg['max_initial_scripts']]))

    # Discover the next layer of the chunk graph referenced from fetched JS.
    discovered: list[str] = []
    disc_fail: list[str] = []
    js_rx = re.compile(r'["\']([^"\']+\.js)["\']')
    for src, body_txt in list(fetched.items()):
        for ref in js_rx.findall(body_txt):
            if not ("chunk" in ref or ref.startswith("_next") or ref.startswith("/_next") or ref.startswith("static/")):
                continue
            if ref.startswith("/"):
                url_path = ref
            elif ref.startswith("static/"):
                url_path = "/_next/" + ref
            else:
                base = urllib.parse.urlparse(src).path
                url_path = urllib.parse.urljoin(base, ref)
            if url_path in fetched or url_path in discovered or len(discovered) >= cfg["max_graph_scripts"]:
                continue
            discovered.append(url_path)
            rr = client.get(url_path, timeout_ms=ctx.config["timeouts"]["http_ms"])
            if rr.status == 200:
                fetched[url_path] = rr.text()
            else:
                disc_fail.append(f"{url_path}->{rr.status}")
    s.check("FE-04", "Chunk-graph references resolve", not disc_fail,
            f"discovered {len(discovered)} additional chunk refs; failures={disc_fail or 'none'}",
            measured=len(discovered), target=len(discovered))

    all_js = "\n".join(fetched.values())
    all_js_lower = all_js.lower()
    found = [mk for mk in cfg["markers"] if (mk in all_js if re.search(r"[^\x00-\x7f]", mk) else mk.lower() in all_js_lower)]
    s.check("FE-05", "Core page markers present in the served bundle", len(found) >= cfg["markers_min_found"],
            f"markers found {len(found)}/{len(cfg['markers'])}: {found}",
            measured=len(found), target=cfg["markers_min_found"])

    suite = s.finish(time.monotonic() - t0)
    suite["metrics"] = {
        "htmlBytes": len(r.body),
        "initialScripts": len(script_srcs),
        "bundleFilesFetched": len(fetched),
        "discoveredRefs": len(discovered),
        "markersFound": found,
        "bundleBytes": sum(len(t) for t in fetched.values()),
    }
    return suite


# ---------------------------------------------------------------------------
# Suite: backend_api (functional contract of the public API surface)
# ---------------------------------------------------------------------------

def run_backend_api(ctx: Ctx) -> dict[str, Any]:
    w = ctx.config["weights"]
    s = Suite("backend_api", "Backend API functionality & reliability", w["backend_api"],
              "Live contract checks against the public REST surface (health, resources, evaluation, guest identity, chat).")
    t0 = time.monotonic()
    client = Client(ctx.base_url, virtual_ip=ctx.vip("backend_api"), timeout_ms=ctx.config["timeouts"]["http_ms"])

    # BA-01 health
    r = client.get("/api/v1/health")
    j = r.json() or {}
    s.check("BA-01", "Health endpoint reports readiness", r.status == 200 and j.get("status") == "ok" and j.get("checks", {}).get("database") == "ok",
            f"GET /api/v1/health -> {r.status}; status={j.get('status')}, database={j.get('checks', {}).get('database')}, latencyMs={j.get('latencyMs')}",
            measured=r.status, target=200)

    # BA-02 gateway label + no secrets
    body_txt = r.text()
    gw = (j.get("checks") or {}).get("llmGateway")
    s.check("BA-02", "Health reports configured gateway honestly without secrets", gw in ("openrouter", "sandbox-provider") and "sk-or" not in body_txt,
            f"llmGateway={gw}; secrets in body: {'sk-or' in body_txt}")

    # BA-03 resources contract
    r = client.get("/api/v1/resources")
    j = r.json() or {}
    res = j.get("resources") or []
    res_source = j.get("source")
    policy_ok = (j.get("contactPolicy") or {}).get("maxAgeDays") == 180
    fields_ok = res and all(
        ("eligible" in x and "exclusionReasons" in x and "key" in x and "category" in x and "verifiedAt" in x) for x in res
    )
    eligible_n = sum(1 for x in res if x.get("eligible"))
    s.check("BA-03", "Verified-resources directory serves eligibility-assessed records", r.status == 200 and bool(res) and policy_ok and fields_ok,
            f"GET /api/v1/resources -> {r.status}; source={res_source}, records={len(res)}, eligible={eligible_n}, policy.maxAgeDays=180",
            measured=len(res), target=1)

    # BA-04 evaluation runs endpoint + dataset cross-check
    r = client.get("/api/v1/evaluation/runs")
    j = r.json() or {}
    api_n = (j.get("dataset") or {}).get("sampleCount")
    s.check("BA-04", "Public evaluation endpoint exposes the frozen dataset contract",
            r.status == 200 and api_n == ctx.config["detection"]["expected_samples"] and (ctx.dataset is None or api_n == len(ctx.dataset)),
            f"GET /api/v1/evaluation/runs -> {r.status}; dataset={j.get('dataset')}; locally extracted samples={len(ctx.dataset) if ctx.dataset else 'n/a'}",
            measured=api_n, target=ctx.config["detection"]["expected_samples"])

    # BA-05 guest cookie flow
    cr = client.post_json("/api/v1/analyses", {"modality": "message", "language": "bn", "consentAnalysis": True, "consentRetention": False})
    cj = cr.json() or {}
    set_cookies = cr.header_all("set-cookie")
    cookie_txt = " ".join(set_cookies)
    cookie_ok = "bs_guest=" in cookie_txt and "HttpOnly" in cookie_txt and "SameSite=Lax" in cookie_txt
    case_id = cj.get("id") if isinstance(cj, dict) else None
    listed = False
    if cr.status == 201 and case_id:
        lr = client.get("/api/v1/analyses")
        lj = lr.json() or {}
        listed = any(x.get("id") == case_id for x in (lj.get("sessions") or []))
    s.check("BA-05", "Guest identity minted server-side (signed httpOnly cookie) and honored",
            cr.status == 201 and cookie_ok and listed,
            f"POST /api/v1/analyses -> {cr.status}; Set-Cookie flags ok={cookie_ok}; session listed for owner={listed}; case={case_id}",
            measured=cr.status, target=201)

    # BA-06 auth/me honest 401
    r = Client(ctx.base_url, timeout_ms=ctx.config["timeouts"]["http_ms"]).get("/api/v1/auth/me")
    s.check("BA-06", "Unauthenticated member endpoint rejected (401)", r.status == 401,
            f"GET /api/v1/auth/me (no credentials) -> {r.status}", measured=r.status, target=401)

    # BA-07 unknown route 404
    r = client.get("/api/v1/does-not-exist")
    s.check("BA-07", "Unknown API path returns 404 (no 5xx)", r.status == 404,
            f"GET /api/v1/does-not-exist -> {r.status}", measured=r.status, target=404)

    # BA-08 guardian chat engine-labeled
    r = client.post_json(
        "/api/v1/agent/chat",
        {"messages": [{"role": "user", "content": "একজন ফোন করে আমার বিকাশের OTP চাইছে।"}]},
        timeout_ms=ctx.config["timeouts"]["chat_ms"],
    )
    j = r.json() or {}
    engine = j.get("engine")
    s.check("BA-08", "Guardian chat replies carry an honest engine label", r.status == 200 and engine in ("live-ai", "rule-based-fallback", "incident-rules") and bool(j.get("reply")),
            f"POST /api/v1/agent/chat -> {r.status}; engine={engine}, servedModel={j.get('servedModel')}, replyChars={len(j.get('reply') or '')}",
            measured=str(engine), target="live-ai|rule-based-fallback|incident-rules")

    # BA-09 analyst-protected endpoint requires auth
    r = Client(ctx.base_url, timeout_ms=ctx.config["timeouts"]["http_ms"]).post_json("/api/v1/evaluation/runs", {"mode": "rules"})
    s.check("BA-09", "Analyst-only endpoints require authentication (401)", r.status == 401,
            f"POST /api/v1/evaluation/runs (no credentials) -> {r.status}", measured=r.status, target=401)

    # BA-10 feedback acknowledged
    ok_fb = False
    if case_id:
        r = client.post_json("/api/v1/feedback", {"sessionId": case_id, "helpful": True, "followed": True, "outcome": "avoided"})
        ok_fb = r.status == 200 and (r.json() or {}).get("received") is True
    s.check("BA-10", "Citizen feedback accepted and acknowledged", ok_fb,
            f"POST /api/v1/feedback for case {case_id} -> received={ok_fb}")

    suite = s.finish(time.monotonic() - t0)
    suite["metrics"] = {
        "resourcesSource": res_source,
        "resourcesEligible": eligible_n,
    }
    return suite


# ---------------------------------------------------------------------------
# Suite: detection (AI detection accuracy — the core benchmark)
# ---------------------------------------------------------------------------

def _fetch_run_row(client: Client, run_id: str, attempts: int = 10) -> dict[str, Any] | None:
    for _ in range(attempts):
        r = client.get("/api/v1/evaluation/runs")
        rows = (r.json() or {}).get("runs") or []
        for row in rows:
            if row.get("runId") == run_id:
                return row
        time.sleep(1)
    return None


def _run_track_a(ctx: Ctx, s: Suite) -> dict[str, Any]:
    det = ctx.config["detection"]
    analyst = Client(
        ctx.base_url,
        virtual_ip=ctx.vip("detection_analyst_base"),
        timeout_ms=ctx.config["timeouts"]["http_ms"],
    )
    lr = analyst.post_json("/api/v1/auth/analyst", {"email": ctx.config["analyst"]["email"], "password": ctx.config["analyst"]["password"]})
    if lr.status != 200:
        s.check("DET-02", "Analyst runner accessible (seeded demo credentials)", False,
                f"POST /api/v1/auth/analyst -> {lr.status}: {(lr.json() or {}).get('error', {}).get('code') if isinstance(lr.json(), dict) else '?'}")
        return {}

    r1 = analyst.post_json("/api/v1/evaluation/runs", {"mode": "rules"})
    j1 = r1.json() or {}
    run_id_1 = j1.get("runId")
    row1 = _fetch_run_row(analyst, run_id_1) if run_id_1 else None
    ok_run = bool(row1) and row1.get("completed") and row1.get("itemsRecorded") == row1.get("sampleCount") == det["expected_samples"]
    s.check("DET-02", "Rules baseline completes over the full frozen dataset (product runner)", ok_run,
            f"POST /api/v1/evaluation/runs mode=rules -> runId={run_id_1}; items={row1.get('itemsRecorded') if row1 else '?'}/{row1.get('sampleCount') if row1 else '?'}, completed={row1.get('completed') if row1 else '?'}")

    row2 = None
    if det.get("track_a_double_run", True):
        r2 = analyst.post_json("/api/v1/evaluation/runs", {"mode": "rules"})
        run_id_2 = (r2.json() or {}).get("runId")
        row2 = _fetch_run_row(analyst, run_id_2) if run_id_2 else None

    # determinism
    if row1 and row2:
        keys = ("tp", "fp", "fn", "tn", "abstained", "ambiguousHeld", "decided")
        same = all(row1.get(k) == row2.get(k) for k in keys)
        s.check("DET-03", "Rules baseline is deterministic (two runs, identical confusion matrix)", same,
                f"runs {run_id_1} vs {row2.get('runId')}: " + ", ".join(f"{k}={row1.get(k)}/{row2.get(k)}" for k in keys))
    else:
        s.skip("DET-03", "Rules determinism double-run", "second run not executed")

    cm = {k: row1.get(k) for k in ("tp", "fp", "fn", "tn")} if row1 else {}
    abst = row1.get("abstained") if row1 else None
    held = row1.get("ambiguousHeld") if row1 else None
    computed = M.binary_metrics({**cm, "abstained": abst, "ambiguous_held": held}) if row1 else {}

    # cross-verify API-reported precision/recall/fpr against external math
    if row1 and computed.get("precision") is not None:
        api_p, api_r, api_fpr = row1.get("precision"), row1.get("recall"), row1.get("falsePositiveRate")
        cross = all(
            (a is not None and b is not None and abs(a - b) <= M.TOL)
            for a, b in ((api_p, computed["precision"]), (api_r, computed["recall"]), (api_fpr, computed["falsePositiveRate"]))
        )
        s.check("DET-04", "Product-reported precision/recall/FPR cross-verified externally", cross,
                f"API precision={api_p} recall={api_r} fpr={api_fpr}; recomputed={computed['precision']:.9f}/{computed['recall']:.9f}/{computed['falsePositiveRate']:.9f} (tol 1e-9)")
    else:
        s.skip("DET-04", "Cross-verification of reported metrics", "run row unavailable")

    tgt = det["track_a_targets"]
    if row1 and computed.get("precision") is not None:
        s.check("DET-05", "Rules precision meets target", computed["precision"] >= tgt["precision_min"],
                f"measured over {det['expected_samples']} frozen samples", measured=round(computed["precision"], 6), target=tgt["precision_min"])
        s.check("DET-06", "Rules recall meets target", computed["recall"] >= tgt["recall_min"],
                f"TP={cm['tp']} FN={cm['fn']}", measured=round(computed["recall"], 6), target=tgt["recall_min"])
        s.check("DET-07", "Rules F1 meets target", (computed["f1"] or 0) >= tgt["f1_min"],
                f"harmonic mean of precision/recall", measured=round(computed["f1"], 6), target=tgt["f1_min"])
        s.check("DET-08", "Rules false-positive rate within budget", computed["falsePositiveRate"] <= tgt["fpr_max"],
                f"FP={cm['fp']} TN={cm['tn']} (benign messages wrongly flagged)", measured=round(computed["falsePositiveRate"], 6), target=tgt["fpr_max"])
        s.check("DET-09", "Rules false-negative rate within budget", computed["falseNegativeRate"] <= tgt["fnr_max"],
                f"FN={cm['fn']} TP={cm['tp']} (scams missed)", measured=round(computed["falseNegativeRate"], 6), target=tgt["fnr_max"])
        n_amb = sum(1 for x in (ctx.dataset or []) if x["label"] == "ambiguous")
        ok_policy = held == n_amb and (row1.get("decided", 0) + (abst or 0) + (held or 0)) == det["expected_samples"]
        s.check("DET-10", "Ambiguous samples held out of binary scoring", ok_policy,
                f"ambiguousHeld={held}, dataset ambiguous={n_amb}; decided+abstained+held={row1.get('decided', 0) + (abst or 0) + (held or 0)}",
                measured=held, target=n_amb)
        cov = M.ratio(row1.get("decided", 0), (row1.get("decided", 0) or 0) + (abst or 0))
        s.check("DET-11", "Rules decision coverage (no silent abstentions)", (cov or 0) >= 0.95,
                f"decided={row1.get('decided')}, abstained={abst}", measured=round(cov, 6) if cov is not None else None, target=0.95)
    else:
        for cid, nm in (("DET-05", "precision"), ("DET-06", "recall"), ("DET-07", "F1"), ("DET-08", "FPR"), ("DET-09", "FNR"), ("DET-10", "ambiguous policy"), ("DET-11", "coverage")):
            s.skip(cid, f"Rules {nm} target", "run row unavailable")

    return {
        "runIds": [run_id_1] + ([row2.get("runId")] if row2 else []),
        "row1": row1,
        "row2": row2,
        "confusion": {**cm, "decided": row1.get("decided") if row1 else None, "abstained": abst, "ambiguousHeld": held},
        "metrics": computed,
        "p50LatencyMs": row1.get("p50LatencyMs") if row1 else None,
        "p95LatencyMs": row1.get("p95LatencyMs") if row1 else None,
    }


def _run_one_track_b_case(ctx: Ctx, index: int, sample: Mapping[str, str]) -> dict[str, Any]:
    ip = f"{ctx.config['virtual_clients']['detection_track_b_base']}.{index + 1}"
    client = Client(ctx.base_url, virtual_ip=ip, timeout_ms=ctx.config["timeouts"]["http_ms"])
    out: dict[str, Any] = {
        "id": sample["id"], "language": sample["language"], "label": sample["label"],
        "subtype": sample["subtype"], "caseId": None, "status": "error", "predicted": None,
        "flagged": None, "engine": None, "analysisMode": None, "latencyMs": None, "error": None,
    }
    r = client.post_json("/api/v1/analyses", {"modality": "message", "language": api_language_of(sample["language"]), "consentAnalysis": True})
    j = r.json() or {}
    case_id = j.get("id") if isinstance(j, dict) else None
    if r.status != 201 or not case_id:
        out["error"] = f"create->{r.status}"
        return out
    out["caseId"] = case_id
    r = client.post_json(f"/api/v1/analyses/{case_id}/input", {"kind": "text", "text": sample["text"]}, timeout_ms=ctx.config["timeouts"]["http_ms"])
    if r.status != 200:
        out["error"] = f"input->{r.status}"
        return out
    t_submit = time.monotonic()
    deadline = t_submit + ctx.config["timeouts"]["analysis_ms"] / 1000.0
    interval = ctx.config["timeouts"]["poll_interval_ms"] / 1000.0
    time.sleep(max(1.0, interval / 2))
    status = "processing"
    while time.monotonic() < deadline:
        sr = client.get(f"/api/v1/analyses/{case_id}/status")
        sj = sr.json() or {}
        status = sj.get("status") or status
        if status in TERMINAL_SESSION_STATUS:
            break
        time.sleep(interval)
    out["latencyMs"] = round((time.monotonic() - t_submit) * 1000.0, 1)  # quantized by the poll interval
    out["status"] = status
    if status != "completed":
        out["error"] = f"terminal-status={status}"
        return out
    rr = client.get(f"/api/v1/analyses/{case_id}/result")
    rj = rr.json() or {}
    res = rj.get("result") or {}
    predicted = res.get("riskCategory")
    out["predicted"] = predicted
    out["engine"] = rj.get("engine") or res.get("engine")
    out["analysisMode"] = res.get("analysisMode")
    if predicted is None:
        out["error"] = "no-riskCategory"
    else:
        out["flagged"] = predicted in FLAGGED_VALUES
    return out


def _run_track_b(ctx: Ctx, s: Suite) -> dict[str, Any]:
    det = ctx.config["detection"]
    if ctx.quick:
        for cid, nm in (("DET-12", "completion"), ("DET-13", "accuracy"), ("DET-14", "F1"), ("DET-15", "engine labeling"), ("DET-16", "language coverage"), ("DET-17", "ambiguous hold-out")):
            s.skip(cid, f"Live production path {nm}", "--quick mode: Track B subset skipped (budget); see report limitations")
        return {"skipped": True}

    picks = stratified_picks(ctx.dataset or [], int(det["track_b_samples_per_stratum"]))
    if not picks:
        for cid, nm in (("DET-12", "completion"), ("DET-13", "accuracy"), ("DET-14", "F1"), ("DET-15", "engine labeling"), ("DET-16", "language coverage"), ("DET-17", "ambiguous hold-out")):
            s.skip(cid, f"Live production path {nm}", "dataset unavailable")
        return {"skipped": True}

    log(f"    Track B: {len(picks)} stratified cases via the public citizen API (workers={det['track_b_workers']})")
    outcomes: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=int(det["track_b_workers"])) as pool:
        futs = {pool.submit(_run_one_track_b_case, ctx, i, p): p for i, p in enumerate(picks)}
        for fut in concurrent.futures.as_completed(futs):
            try:
                outcomes.append(fut.result())
            except FrameworkError as e:
                bad = futs[fut]
                outcomes.append({"id": bad["id"], "language": bad["language"], "label": bad["label"],
                                "subtype": bad["subtype"], "caseId": None, "status": "error",
                                "predicted": None, "flagged": None, "engine": None, "analysisMode": None,
                                "latencyMs": None, "error": str(e)})
    outcomes.sort(key=lambda o: o["id"])
    for o in outcomes:
        log(f"      case {o['id']} [{o['language']}/{o['label']}]: status={o['status']} predicted={o['predicted']} engine={o['engine']} latency={o['latencyMs']}ms err={o['error']}")

    # per-case latency was measured inside the worker (submit -> terminal
    # verdict, quantized by the poll interval; documented in limitations).
    completed = [o for o in outcomes if o["status"] == "completed"]
    decided_cases = [o for o in completed if o["label"] in ("scam", "benign")]
    completion = M.ratio(len(completed), len(outcomes))
    s.check("DET-12", "Live production path reaches terminal verdicts", (completion or 0) >= det["track_b_targets"]["completion_min"],
            f"{len(completed)}/{len(outcomes)} stratified cases completed ({', '.join(o['id'] for o in outcomes)})",
            measured=round(completion, 4) if completion is not None else None, target=det["track_b_targets"]["completion_min"])

    outcomes_payload = [{k: o.get(k) for k in ("id", "language", "label", "subtype", "caseId", "status", "predicted", "flagged", "engine", "analysisMode", "latencyMs", "error")} for o in outcomes]
    cm = M.confusion_from_outcomes(outcomes_payload)
    met = M.binary_metrics(cm)
    acc = met["accuracy"]
    s.check("DET-13", "Live production path accuracy (decided cases) meets target", (acc or 0) >= det["track_b_targets"]["accuracy_min"],
            f"tp={cm['tp']} fp={cm['fp']} fn={cm['fn']} tn={cm['tn']} over {cm['decided']} decided; abstained={cm['abstained']}, ambiguousHeld={cm['ambiguous_held']}",
            measured=round(acc, 4) if acc is not None else None, target=det["track_b_targets"]["accuracy_min"])

    s.check("DET-14", "Live production path F1 meets target", (met["f1"] or 0) >= det["track_b_targets"]["f1_min"],
            f"subset F1 over {len(picks)} stratified samples", measured=round(met["f1"], 4) if met["f1"] is not None else None, target=det["track_b_targets"]["f1_min"])

    engines = sorted({str(o["engine"]) for o in completed})
    engines_ok = all(e in ("ai_assisted", "rule_based") for e in engines) and bool(completed)
    s.check("DET-15", "Every completed case is engine-labeled (ai_assisted | rule_based)", engines_ok,
            f"engines observed: {engines} over {len(completed)} completed cases", measured=engines)

    langs = {o["language"] for o in decided_cases}
    s.check("DET-16", "All three languages exercised with decided cases", langs == {"bn", "banglish", "en"},
            f"languages with decided cases: {sorted(langs)}")

    n_amb = sum(1 for o in outcomes if o["label"] == "ambiguous")
    s.check("DET-17", "Ambiguous subset cases held out of binary scoring", cm["ambiguous_held"] == n_amb,
            f"ambiguous in subset={n_amb}, held={cm['ambiguous_held']}", measured=cm["ambiguous_held"], target=n_amb)

    lat = [o["latencyMs"] for o in completed if isinstance(o.get("latencyMs"), (int, float))]
    lat_stats = M.latency_stats(lat) if lat else {"count": 0, "min": None, "p50": None, "p95": None, "max": None}
    return {
        "skipped": False,
        "cases": outcomes_payload,
        "confusion": cm,
        "metrics": met,
        "latency": lat_stats,
    }


def run_detection(ctx: Ctx) -> dict[str, Any]:
    w = ctx.config["weights"]
    s = Suite("detection", "AI detection accuracy benchmark", w["detection"],
              "Dual-track benchmark: (A) deterministic rules baseline over the full frozen 120-sample dataset via the product's own runner; (B) live production path (gateway + safety gate + honest fallback) on a stratified subset via the citizen API.")
    t0 = time.monotonic()

    # DET-01 dataset extraction + cross-check
    ds_path = ctx.root / ctx.config["detection"]["dataset_path"]
    try:
        samples = extract_dataset(ds_path)
        ctx.dataset = samples
    except FrameworkError as e:
        s.check("DET-01", "Frozen benchmark dataset extracted and cross-checked", False, str(e))
        samples = []
        ctx.dataset = []

    r = Client(ctx.base_url, timeout_ms=ctx.config["timeouts"]["http_ms"]).get("/api/v1/evaluation/runs")
    api_n = ((r.json() or {}).get("dataset") or {}).get("sampleCount")
    det_cfg = ctx.config["detection"]
    s.check("DET-01", "Frozen benchmark dataset extracted and cross-checked",
            len(samples) == det_cfg["expected_samples"] and api_n == len(samples),
            f"parsed {len(samples)} samples from {det_cfg['dataset_path']}; sha256(extraction)={dataset_digest(samples)[:16]}…; API dataset.sampleCount={api_n}",
            measured=len(samples), target=det_cfg["expected_samples"])

    track_a = _run_track_a(ctx, s)
    track_b = _run_track_b(ctx, s)
    ctx.track_b_latencies = [o.get("latencyMs") for o in (track_b.get("cases") or []) if isinstance(o.get("latencyMs"), (int, float))]

    suite = s.finish(time.monotonic() - t0)
    suite["metrics"] = {"trackA": track_a, "trackB": track_b}
    return suite


# ---------------------------------------------------------------------------
# Suite: e2e (end-to-end workflows)
# ---------------------------------------------------------------------------

def _poll_case(client: Client, case_id: str, ctx: Ctx) -> tuple[str, dict[str, Any]]:
    deadline = time.monotonic() + ctx.config["timeouts"]["analysis_ms"] / 1000.0
    interval = ctx.config["timeouts"]["poll_interval_ms"] / 1000.0
    time.sleep(max(1.0, interval / 2))
    status = "processing"
    while time.monotonic() < deadline:
        r = client.get(f"/api/v1/analyses/{case_id}/status")
        status = (r.json() or {}).get("status") or status
        if status in TERMINAL_SESSION_STATUS:
            break
        time.sleep(interval)
    r = client.get(f"/api/v1/analyses/{case_id}/result")
    return status, (r.json() or {})


def run_e2e(ctx: Ctx) -> dict[str, Any]:
    w = ctx.config["weights"]
    s = Suite("e2e", "End-to-end workflow completion", w["e2e"],
              "Golden-path journeys: citizen analysis (submit → verdict → feedback), Guardian incident state machine, dynamic verified-contact directory lifecycle.")
    t0 = time.monotonic()
    client = Client(ctx.base_url, virtual_ip=ctx.vip("e2e"), timeout_ms=ctx.config["timeouts"]["http_ms"])

    # E2E-01/02 citizen golden path with a known labeled scam sample (S001)
    scam = next((x for x in (ctx.dataset or []) if x["id"] == "S001"), None)
    if scam is None:
        s.skip("E2E-01", "Citizen analysis journey", "S001 benchmark sample unavailable")
        s.skip("E2E-02", "Result contract completeness", "depends on E2E-01")
        verdict = {}
    else:
        cr = client.post_json("/api/v1/analyses", {"modality": "message", "language": "bn", "consentAnalysis": True})
        case_id = (cr.json() or {}).get("id")
        ir = client.post_json(f"/api/v1/analyses/{case_id}/input", {"kind": "text", "text": scam["text"]}, timeout_ms=ctx.config["timeouts"]["http_ms"])
        status, rj = _poll_case(client, case_id, ctx)
        res = rj.get("result") or {}
        flagged = res.get("riskCategory") in FLAGGED_VALUES
        ev = res.get("evidence") or []
        ia = res.get("immediateAction") or {}
        ok01 = (
            cr.status == 201 and ir.status == 200 and status == "completed" and flagged and bool(ev)
        )
        # feedback + listing
        fr = client.post_json("/api/v1/feedback", {"sessionId": case_id, "helpful": True, "followed": True, "outcome": "avoided"})
        lr = client.get("/api/v1/analyses")
        listed = any(x.get("id") == case_id and x.get("status") == "completed" for x in (lr.json() or {}).get("sessions") or [])
        ok01 = ok01 and (fr.status == 200 and (fr.json() or {}).get("received") is True) and listed
        s.check("E2E-01", "Citizen journey: submit → verdict → feedback → history", ok01,
                f"case {case_id} (sample {scam['id']}): create={cr.status}, input={ir.status}, status={status}, risk={res.get('riskCategory')}, engine={rj.get('engine')}, evidence={len(ev)}, feedback={fr.status}, listed={listed}",
                measured=res.get("riskCategory"), target="HIGH_RISK|CAUTION")
        verdict = res

        summary = res.get("summary") or {}
        why = res.get("why") or {}
        ev_ok = bool(ev) and all(x.get("key") and x.get("kind") and x.get("weight") for x in ev[:3])
        ok02 = (
            bool(summary.get("bn")) and bool(summary.get("en")) and bool(why.get("bn"))
            and ev_ok and bool(ia.get("title", {}).get("bn")) and rj.get("engine") in ("ai_assisted", "rule_based")
        )
        s.check("E2E-02", "Analysis result contract completeness (bilingual summary, evidence, action)", ok02,
                f"summary.bn={'set' if summary.get('bn') else 'missing'}, summary.en={'set' if summary.get('en') else 'missing'}, why.bn={'set' if why.get('bn') else 'missing'}, evidence[0..2] shaped={ev_ok}, immediateAction={'set' if ia else 'missing'}, engine={rj.get('engine')}")

    # E2E-03..05 Guardian incident state machine (deterministic, COU TECHNOVA C1)
    def chat(messages: list[dict[str, str]], directory: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"messages": messages}
        if directory:
            body["directory"] = directory
        r = client.post_json("/api/v1/agent/chat", body, timeout_ms=ctx.config["timeouts"]["chat_ms"])
        return r.json() or {}

    t1 = "একজন ফোন করে আমার বিকাশের OTP চাইছে।"
    r1 = chat([{"role": "user", "content": t1}])
    inc1 = r1.get("incident") or {}
    s.check("E2E-03", "Guardian: OTP mention → follow-up question (state unknown, deterministic engine)",
            r1.get("engine") == "incident-rules" and inc1.get("state") == "unknown" and inc1.get("stage") == "follow_up",
            f"engine={r1.get('engine')}, incident={ {k: inc1.get(k) for k in ('state', 'stage', 'resolvedBy')} }")

    h2 = [{"role": "user", "content": t1}, {"role": "assistant", "content": r1.get("reply") or ""},
          {"role": "user", "content": "না, দিইনি।"}]
    r2 = chat(h2)
    inc2 = r2.get("incident") or {}
    s.check("E2E-04", "Guardian: denial → preventive guidance (state not_shared)",
            r2.get("engine") == "incident-rules" and inc2.get("state") == "not_shared" and inc2.get("stage") == "preventive",
            f"engine={r2.get('engine')}, incident={ {k: inc2.get(k) for k in ('state', 'stage', 'changed')} }")

    h3 = h2 + [{"role": "assistant", "content": r2.get("reply") or ""},
               {"role": "user", "content": "আসলে আমি কোডটা দিয়ে ফেলেছি।"}]
    r3 = chat(h3)
    inc3 = r3.get("incident") or {}
    contacts = r3.get("contacts") or {}
    items = contacts.get("items") or []
    actionable = [i for i in items if i.get("actionable")]
    non_actionable = [i for i in items if not i.get("actionable")]
    phones_suppressed = all(i.get("phone") is None for i in non_actionable)
    ok05 = (
        r3.get("engine") == "incident-rules" and inc3.get("state") == "shared" and inc3.get("stage") == "recovery"
        and inc3.get("correction") is True and isinstance(contacts.get("directoryVersion"), str)
        and (bool(actionable) or contacts.get("unavailableNotice"))
        and phones_suppressed
    )
    s.check("E2E-05", "Guardian: admission → recovery with server-verified contact cards (policy applied)", ok05,
            f"state={inc3.get('state')}, stage={inc3.get('stage')}, correction={inc3.get('correction')}; contacts: source={contacts.get('source')}, version={contacts.get('source') and contacts.get('directoryVersion')}, actionable={len(actionable)}/{len(items)}, phones suppressed on non-actionable={phones_suppressed}, unavailableNotice={'set' if contacts.get('unavailableNotice') else 'none'}",
            measured=f"actionable={len(actionable)}", target=">=1 actionable or explicit unavailable notice")

    # E2E-06/07 demo directory lifecycle (COU TECHNOVA C2 — data-driven switching)
    dd = Client(ctx.base_url, virtual_ip=ctx.vip("e2e"), timeout_ms=ctx.config["timeouts"]["http_ms"])

    def demo_action(action: str) -> dict[str, Any]:
        return (dd.post_json("/api/v1/demo-directory", {"action": action}).json() or {})

    def demo_recovery_chat() -> dict[str, Any]:
        base_hist = [
            {"role": "user", "content": "ami bKash OTP chiye ekta phone eseche"},
            {"role": "assistant", "content": "prompt"},
            {"role": "user", "content": "I did not share the OTP"},
            {"role": "assistant", "content": "prompt"},
            {"role": "user", "content": "ami otp diye dilam"},
        ]
        return chat(base_hist, directory="demo")

    demo_action("reset")
    g0 = dd.get("/api/v1/demo-directory").json() or {}
    snap0 = g0.get("snapshot") or {}
    labeled = bool(g0.get("testdata")) and "TEST DATA" in str(g0.get("label", ""))
    s.check("E2E-07", "Demo directory is clearly-labeled fictional TEST DATA", labeled,
            f"GET /api/v1/demo-directory: testdata={g0.get('testdata')}, label={str(g0.get('label'))[:60]}…")

    demo_action("deactivate-a")
    demo_action("verify-b")
    r_b = demo_recovery_chat()
    contacts_b = r_b.get("contacts") or {}
    keys_b = sorted(i.get("key") for i in (contacts_b.get("items") or []))
    ok_b = keys_b == ["test-contact-b"] and all(i.get("actionable") for i in contacts_b.get("items") or [])
    demo_action("deactivate-b")
    r_none = demo_recovery_chat()
    contacts_none = r_none.get("contacts") or {}
    keys_none = sorted(i.get("key") for i in (contacts_none.get("items") or []))
    notice = contacts_none.get("unavailableNotice")
    ok_none = (not keys_none) and bool(notice)
    demo_action("reset")
    s.check("E2E-06", "Directory changes drive contact recommendations (A off → B verified → B off → none)", ok_b and ok_none,
            f"after deactivate-a+verify-b: recommended={keys_b} (all actionable={ok_b}); after deactivate-b: recommended={keys_none}, unavailableNotice={'set' if notice else 'none'}",
            measured=f"A-off: {keys_b}; B-off: {keys_none}", target="B only, then none+notice")

    suite = s.finish(time.monotonic() - t0)
    suite["metrics"] = {
        "incidentStates": [inc1.get("state"), inc2.get("state"), inc3.get("state")],
        "incidentStages": [inc1.get("stage"), inc2.get("stage"), inc3.get("stage")],
        "recoveryContactsActionable": len(actionable),
        "recoveryContactsTotal": len(items),
        "demoLifecycle": {"afterAOff": keys_b, "afterBOff": keys_none},
    }
    return suite


# ---------------------------------------------------------------------------
# Suite: security (edge cases, hostile input, authorization)
# ---------------------------------------------------------------------------

STACK_RX = re.compile(r"(\bat\s+\S*(src|node_modules)[/\\]|Traceback|/home/\S+|/usr/lib/\S+)", re.IGNORECASE)


def run_security(ctx: Ctx) -> dict[str, Any]:
    w = ctx.config["weights"]
    s = Suite("security", "Security & edge-case handling", w["security"],
              "Hostile/invalid input handling, authorization boundaries, consent gates, rate-limit enforcement, error hygiene.")
    t0 = time.monotonic()
    client = Client(ctx.base_url, virtual_ip=ctx.vip("security"), timeout_ms=ctx.config["timeouts"]["http_ms"])
    error_bodies: list[str] = []

    def note_error(r: Resp) -> None:
        if r.status >= 400:
            error_bodies.append(r.text())

    # SEC-01 malformed JSON
    r = client.request("POST", "/api/v1/analyses", raw_body=b"{not json", content_type="application/json")
    note_error(r)
    s.check("SEC-01", "Malformed JSON body rejected as 4xx (no 5xx)", 400 <= r.status < 500,
            f"POST /api/v1/analyses with broken JSON -> {r.status}", measured=r.status, target="4xx")

    # SEC-02 consent gate
    r = client.post_json("/api/v1/analyses", {"modality": "message", "language": "bn", "consentAnalysis": False})
    note_error(r)
    s.check("SEC-02", "Analysis without explicit consent rejected (422)", r.status == 422,
            f"POST /api/v1/analyses consentAnalysis=false -> {r.status}", measured=r.status, target=422)

    # SEC-03 oversized text
    cr = client.post_json("/api/v1/analyses", {"modality": "message", "language": "bn", "consentAnalysis": True})
    big_case = (cr.json() or {}).get("id")
    r = client.post_json(f"/api/v1/analyses/{big_case}/input", {"kind": "text", "text": "x" * 9000})
    note_error(r)
    s.check("SEC-03", "Oversized input rejected by schema (422)", r.status == 422,
            f"POST input with 9000-char text (max 8000) -> {r.status}", measured=r.status, target=422)

    # SEC-04 XSS payload — full pipeline run
    xss = "<script>alert('XSS')</script> প্রিয় গ্রাহক, আপনার বিকাশ একাউন্ট বন্ধ হবে, ওটিপি এখনই পাঠান এই নম্বরে ০১৭xxxxxxxx"
    xr = client.post_json("/api/v1/analyses", {"modality": "message", "language": "bn", "consentAnalysis": True})
    x_case = (xr.json() or {}).get("id")
    ir = client.post_json(f"/api/v1/analyses/{x_case}/input", {"kind": "text", "text": xss}, timeout_ms=ctx.config["timeouts"]["http_ms"])
    x_status, xj = _poll_case(client, x_case, ctx)
    ct_ok = "application/json" in (client.get(f"/api/v1/analyses/{x_case}/result").header("content-type") or "")
    s.check("SEC-04", "XSS payload processed safely (JSON responses, no 5xx, terminal verdict)",
            ir.status == 200 and x_status == "completed" and ct_ok,
            f"case {x_case}: input={ir.status}, status={x_status}, result content-type JSON={ct_ok}")

    # SEC-05 SQL injection payload accepted without server error
    sqli = "Robert'); DROP TABLE users;-- আপনার একাউন্ট ভেরিফাই করতে পিন দিন"
    sr = client.post_json("/api/v1/analyses", {"modality": "message", "language": "bn", "consentAnalysis": True})
    s_case = (sr.json() or {}).get("id")
    ir = client.post_json(f"/api/v1/analyses/{s_case}/input", {"kind": "text", "text": sqli}, timeout_ms=ctx.config["timeouts"]["http_ms"])
    st = client.get(f"/api/v1/analyses/{s_case}/status")
    s.check("SEC-05", "SQL-injection payload handled without server error", ir.status == 200 and st.status == 200,
            f"case {s_case}: input={ir.status}, status poll={st.status}")

    # SEC-06 invalid case id format (fails CASE_ID_RX) vs unknown-but-valid id (404)
    r_fmt = client.get("/api/v1/analyses/BS-bad!")  # invalid characters -> 400
    note_error(r_fmt)
    r_unk = client.get("/api/v1/analyses/BS-ZZZZZZZZ")  # valid format, unknown -> 404
    note_error(r_unk)
    s.check("SEC-06", "Invalid case-id format rejected (400); unknown-but-valid id returns 404",
            r_fmt.status == 400 and r_unk.status == 404,
            f"GET BS-bad! -> {r_fmt.status} (format check); GET BS-ZZZZZZZZ -> {r_unk.status} (uniform not-found)",
            measured=r_fmt.status, target=400)

    # SEC-07 cross-guest access
    other = Client(ctx.base_url, virtual_ip="10.77.61.77", timeout_ms=ctx.config["timeouts"]["http_ms"])
    r = other.get(f"/api/v1/analyses/{x_case}/result")
    note_error(r)
    leaked = bool((r.json() or {}).get("result"))
    s.check("SEC-07", "Cross-guest case access denied (403, no private content)", r.status == 403 and not leaked,
            f"second guest identity GET result for case {x_case} -> {r.status}, content leaked={leaked}", measured=r.status, target=403)

    # SEC-08 voice consent gate
    r = client.post_json("/api/v1/agent/voice", {"audioBase64": "A" * 80, "mime": "audio/webm", "consent": False})
    note_error(r)
    s.check("SEC-08", "Voice endpoint requires explicit consent (403)", r.status == 403 and (r.json() or {}).get("error", {}).get("code") == "consent-required",
            f"POST /api/v1/agent/voice consent=false -> {r.status}, code={(r.json() or {}).get('error', {}).get('code')}", measured=r.status, target=403)

    # SEC-09 invalid audio with consent → honest failure (422), no 5xx
    r = client.post_json("/api/v1/agent/voice", {"audioBase64": "A" * 80, "mime": "audio/webm", "consent": True},
                         timeout_ms=ctx.config["timeouts"]["chat_ms"])
    note_error(r)
    s.check("SEC-09", "Invalid audio returns honest transcription failure (422, no 5xx)", r.status == 422,
            f"POST /api/v1/agent/voice with garbage audio -> {r.status}, code={(r.json() or {}).get('error', {}).get('code')}", measured=r.status, target=422)

    # SEC-10 dangerous link scheme
    r = client.post_json("/api/v1/analyses", {"modality": "link", "language": "bn", "consentAnalysis": True})
    link_case = (r.json() or {}).get("id")
    r = client.post_json(f"/api/v1/analyses/{link_case}/input", {"kind": "link", "url": "javascript:alert(1)"})
    note_error(r)
    s.check("SEC-10", "javascript: link scheme rejected (422)", r.status == 422,
            f"POST input kind=link url=javascript:alert(1) -> {r.status}", measured=r.status, target=422)

    # SEC-11 uniform auth failure
    r1 = client.post_json("/api/v1/auth/analyst", {"email": "analyst@banglashield.org", "password": "wrong-password"})
    r2 = client.post_json("/api/v1/auth/analyst", {"email": "ghost@example.com", "password": "whatever!!"})
    note_error(r1)
    note_error(r2)
    m1 = (r1.json() or {}).get("error", {}).get("message")
    m2 = (r2.json() or {}).get("error", {}).get("message")
    s.check("SEC-11", "Analyst login failures are uniform (401, identical message)", r1.status == 401 and r2.status == 401 and m1 == m2,
            f"wrong-password -> {r1.status}; unknown-email -> {r2.status}; messages identical={m1 == m2}")

    # SEC-12 rate-limit enforcement (agent/chat limiter: 20 / 15 min per client)
    probe = Client(ctx.base_url, virtual_ip="10.77.61.88", timeout_ms=ctx.config["timeouts"]["http_ms"])
    n_429 = 0
    statuses: list[int] = []
    for _ in range(int(ctx.config["security"]["rate_limit_probe"]["attempts"])):
        rr = probe.post_json("/api/v1/agent/chat", {"messages": []})
        statuses.append(rr.status)
        if rr.status == 429:
            n_429 += 1
    s.check("SEC-12", "Rate limiter enforced (429 after quota)", n_429 >= 1,
            f"{len(statuses)} rapid invalid POSTs to /api/v1/agent/chat from one virtual client; statuses={ {c: statuses.count(c) for c in sorted(set(statuses))} }",
            measured=n_429, target=1)

    # SEC-13 method not allowed
    r = client.request("DELETE", "/api/v1/resources")
    note_error(r)
    s.check("SEC-13", "Unsupported method rejected (405)", r.status == 405,
            f"DELETE /api/v1/resources -> {r.status}", measured=r.status, target=405)

    # SEC-14 stack-trace hygiene across all error responses seen in this suite
    leaks = [b[:120] for b in error_bodies if STACK_RX.search(b)]
    s.check("SEC-14", "No stack traces or internal paths leaked in error responses", not leaks,
            f"{len(error_bodies)} error responses scanned; leaks={leaks or 'none'}",
            measured=len(leaks), target=0)

    suite = s.finish(time.monotonic() - t0)
    suite["metrics"] = {
        "errorResponsesScanned": len(error_bodies),
        "rateProbeStatusHistogram": {str(c): statuses.count(c) for c in sorted(set(statuses))},
    }
    return suite


# ---------------------------------------------------------------------------
# Suite: latency (measured against configured budgets; raw samples recorded)
# ---------------------------------------------------------------------------

def run_latency(ctx: Ctx) -> dict[str, Any]:
    w = ctx.config["weights"]
    s = Suite("latency", "Response latency & error budgets", w["latency"],
              "Warm sequential sampling per endpoint; percentiles computed from raw recorded samples (nearest-rank).")
    t0 = time.monotonic()
    client = Client(ctx.base_url, virtual_ip=ctx.vip("latency"), timeout_ms=ctx.config["timeouts"]["chat_ms"])
    cfg_lat = ctx.config["latency"]
    n_static = 3 if ctx.quick else int(cfg_lat["samples_static"])
    n_dyn = 1 if ctx.quick else int(cfg_lat["samples_dynamic"])

    endpoints: list[dict[str, Any]] = []

    def sample(name: str, path: str, target_ms: float, samples: int, method: str = "GET", body: Any = None) -> None:
        if cfg_lat.get("warmup", True):
            try:
                if method == "GET":
                    client.get(path)
                else:
                    client.post_json(path, body, timeout_ms=ctx.config["timeouts"]["chat_ms"])
            except FrameworkError:
                pass
        vals: list[float] = []
        for _ in range(samples):
            try:
                r = client.get(path) if method == "GET" else client.post_json(path, body, timeout_ms=ctx.config["timeouts"]["chat_ms"])
                if r.status < 500:
                    vals.append(round(r.elapsed_ms, 1))
            except FrameworkError:
                continue
        stats = M.latency_stats(vals)
        ok = (stats["p95"] is not None and stats["p95"] <= target_ms)
        s.check(f"LAT-{len(endpoints) + 1:02d}", f"{name} p95 within budget", ok,
                f"{samples} sequential samples on {method} {path}; p50={M.fmt_ms(stats['p50'])}, p95={M.fmt_ms(stats['p95'])}, max={M.fmt_ms(stats['max'])}",
                measured=round(stats["p95"], 1) if stats["p95"] is not None else None, target=target_ms)
        endpoints.append({"name": name, "endpoint": path, "samples": vals, "targetMs": target_ms, **stats})

    sample("Root page (HTML shell)", "/", cfg_lat["targets_ms"]["page"], n_static)
    sample("Health endpoint", "/api/v1/health", cfg_lat["targets_ms"]["health"], n_static)
    sample("Resources directory", "/api/v1/resources", cfg_lat["targets_ms"]["resources"], n_static)
    sample("Evaluation runs (read model)", "/api/v1/evaluation/runs", cfg_lat["targets_ms"]["evaluation_runs"], n_static)

    # deterministic stage reply (incident-rules path)
    stage_body = {"messages": [{"role": "user", "content": "একজন ফোন করে আমার বিকাশের OTP চাইছে।"}]}
    vals: list[float] = []
    for _ in range(n_dyn):
        r = client.post_json("/api/v1/agent/chat", stage_body, timeout_ms=ctx.config["timeouts"]["chat_ms"])
        if r.status < 500:
            vals.append(round(r.elapsed_ms, 1))
    stats = M.latency_stats(vals)
    ok = stats["p95"] is not None and stats["p95"] <= cfg_lat["targets_ms"]["chat_stage"]
    s.check("LAT-05", "Guardian deterministic stage reply p95 within budget", ok,
            f"incident-rules path; p50={M.fmt_ms(stats['p50'])}, p95={M.fmt_ms(stats['p95'])}",
            measured=round(stats["p95"], 1) if stats["p95"] is not None else None, target=cfg_lat["targets_ms"]["chat_stage"])
    endpoints.append({"name": "Guardian stage reply (deterministic)", "endpoint": "POST /api/v1/agent/chat", "samples": vals, "targetMs": cfg_lat["targets_ms"]["chat_stage"], **stats})

    # live-AI reply
    ai_body = {"messages": [{"role": "user", "content": "ডিজিটাল নিরাপত্তা নিয়ে আজকে আমাকে একটা টিপস দিন।"}]}
    vals = []
    for _ in range(max(1, n_dyn)):
        r = client.post_json("/api/v1/agent/chat", ai_body, timeout_ms=ctx.config["timeouts"]["chat_ms"])
        if r.status < 500:
            vals.append(round(r.elapsed_ms, 1))
    stats = M.latency_stats(vals)
    ok = stats["p95"] is not None and stats["p95"] <= cfg_lat["targets_ms"]["chat_ai"]
    s.check("LAT-06", "Guardian live-AI reply p95 within budget", ok,
            f"live gateway path; p50={M.fmt_ms(stats['p50'])}, p95={M.fmt_ms(stats['p95'])}, max={M.fmt_ms(stats['max'])}",
            measured=round(stats["p95"], 1) if stats["p95"] is not None else None, target=cfg_lat["targets_ms"]["chat_ai"])
    endpoints.append({"name": "Guardian live-AI reply", "endpoint": "POST /api/v1/agent/chat (free turn)", "samples": vals, "targetMs": cfg_lat["targets_ms"]["chat_ai"], **stats})

    # full analysis pipeline latency — reuse Track B measured latencies
    if ctx.track_b_latencies:
        stats = M.latency_stats([float(v) for v in ctx.track_b_latencies])
        ok = stats["p95"] is not None and stats["p95"] <= cfg_lat["targets_ms"]["analysis"]
        s.check("LAT-07", "Full analysis pipeline p95 within budget", ok,
                f"measured on the {len(ctx.track_b_latencies)} Track B citizen cases (submit → terminal verdict); p50={M.fmt_ms(stats['p50'])}, p95={M.fmt_ms(stats['p95'])}",
                measured=round(stats["p95"], 1) if stats["p95"] is not None else None, target=cfg_lat["targets_ms"]["analysis"])
        endpoints.append({"name": "Full analysis pipeline (Track B cases)", "endpoint": "POST analyses + input → poll", "samples": [float(v) for v in ctx.track_b_latencies], "targetMs": cfg_lat["targets_ms"]["analysis"], **stats})
    else:
        s.skip("LAT-07", "Full analysis pipeline latency", "Track B not measured in this run (skipped or --quick)")

    suite = s.finish(time.monotonic() - t0)
    suite["metrics"] = {"endpoints": endpoints}
    return suite


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def _status_icon(st: str) -> str:
    return {"passed": "PASS", "failed": "FAIL", "skipped": "SKIP"}[st]


def render_report(results: Mapping[str, Any]) -> str:
    cfg = results["config"]
    summ = results["summary"]
    lines: list[str] = []
    lines.append("# BanglaShield AI — Evaluation & Benchmark Report")
    lines.append("")
    lines.append(f"- **Generated:** {results['generatedAt']}")
    lines.append(f"- **Framework:** {results['framework']['name']} v{results['framework']['version']}")
    lines.append(f"- **Command:** `{results['framework']['command']}`")
    lines.append(f"- **Git commit:** `{results['git']['commit']}` (branch `{results['git']['branch']}`, dirty={results['git']['dirty']})")
    lines.append(f"- **Application under test:** {results['environment']['baseUrl']}")
    lines.append(f"- **Run duration:** {results['framework']['durationSec']} s")
    lines.append("")
    lines.append(f"**Overall score: {M.fmt_pct(summ['overallScore'])} ({summ['grade']})**")
    lines.append("")
    lines.append("Grading bands: **95%+ excellent · 90%+ strong · 80%+ baseline · below 80% below-baseline**.")
    lines.append("")
    lines.append("## Suite summary")
    lines.append("")
    lines.append("| Suite | Weight | Score | Band | Passed | Failed | Skipped |")
    lines.append("|---|---|---|---|---|---|---|")
    for suite in results["suites"]:
        sc = suite["score"]
        band = M.grade_for(sc, cfg["thresholds"]) or "n/a (not run)"
        c = suite["counts"]
        lines.append(
            f"| {suite['name']} | {suite['weight']:.2f} | {M.fmt_pct(sc)} | {band} | {c['passed']} | {c['failed']} | {c['skipped']} |"
        )
    lines.append("")

    # Detection detail
    det_suites = [x for x in results["suites"] if x["id"] == "detection"]
    if det_suites:
        m = det_suites[0].get("metrics") or {}
        ta = m.get("trackA") or {}
        tb = m.get("trackB") or {}
        lines.append("## Detection accuracy (frozen benchmark dataset)")
        lines.append("")
        lines.append(f"Dataset: `{results['dataset']['path']}` — {results['dataset']['samples']} labeled samples "
                      f"({results['dataset']['scam']} scam / {results['dataset']['benign']} benign / {results['dataset']['ambiguous']} ambiguous across bn / banglish / en).")
        lines.append("")
        if ta.get("confusion"):
            cm = ta["confusion"]
            met = ta.get("metrics") or {}
            lines.append("### Track A — deterministic rules baseline (full dataset, product runner)")
            lines.append("")
            lines.append(f"- Run IDs: `{', '.join(str(x) for x in ta.get('runIds', []))}`")
            lines.append(f"- Confusion matrix: TP={cm['tp']} FP={cm['fp']} FN={cm['fn']} TN={cm['tn']} · abstained={cm['abstained']} · ambiguous held={cm['ambiguousHeld']}")
            lines.append(f"- **Precision {M.fmt_pct(met.get('precision'))} · Recall {M.fmt_pct(met.get('recall'))} · F1 {M.fmt_pct(met.get('f1'))} · FPR {M.fmt_pct(met.get('falsePositiveRate'))} · FNR {M.fmt_pct(met.get('falseNegativeRate'))}**")
            lines.append("")
        if tb and not tb.get("skipped"):
            cm = tb.get("confusion") or {}
            met = tb.get("metrics") or {}
            cases = tb.get("cases") or []
            lines.append("### Track B — live production path (stratified subset, citizen API)")
            lines.append("")
            lines.append("| Case | Language | Label | Predicted | Engine | Outcome |")
            lines.append("|---|---|---|---|---|---|")
            for c in cases:
                out = "correct" if c.get("flagged") is not None and c["label"] in ("scam", "benign") else ("held" if c["label"] == "ambiguous" else "abstain")
                if c.get("flagged") is not None and c["label"] in ("scam", "benign"):
                    correct = (c["label"] == "scam") == bool(c["flagged"])
                    out = "correct" if correct else "wrong"
                lines.append(f"| {c['id']} | {c['language']} | {c['label']} | {c.get('predicted')} | {c.get('engine')} | {out} |")
            lines.append("")
            lines.append(f"- Confusion matrix: TP={cm.get('tp')} FP={cm.get('fp')} FN={cm.get('fn')} TN={cm.get('tn')} · abstained={cm.get('abstained')} · ambiguous held={cm.get('ambiguous_held')}")
            lines.append(f"- **Accuracy {M.fmt_pct(met.get('accuracy'))} · Precision {M.fmt_pct(met.get('precision'))} · Recall {M.fmt_pct(met.get('recall'))} · F1 {M.fmt_pct(met.get('f1'))}**")
            lines.append("")

    # Latency detail
    lat_suites = [x for x in results["suites"] if x["id"] == "latency"]
    if lat_suites:
        eps = (lat_suites[0].get("metrics") or {}).get("endpoints") or []
        lines.append("## Latency (raw samples recorded in results.json)")
        lines.append("")
        lines.append("| Endpoint | Samples | p50 | p95 | Max | Budget |")
        lines.append("|---|---|---|---|---|---|")
        for e in eps:
            lines.append(f"| {e['name']} | {e.get('count', len(e.get('samples', [])))} | {M.fmt_ms(e.get('p50'))} | {M.fmt_ms(e.get('p95'))} | {M.fmt_ms(e.get('max'))} | {e['targetMs']:.0f} ms |")
        lines.append("")

    lines.append("## Check detail")
    lines.append("")
    for suite in results["suites"]:
        lines.append(f"### {suite['name']}")
        lines.append("")
        lines.append("| ID | Check | Status | Measured | Target |")
        lines.append("|---|---|---|---|---|")
        for c in suite["checks"]:
            measured = c.get("measured")
            target = c.get("target")
            if measured is None:
                mtxt = "—"
            elif isinstance(measured, float):
                mtxt = f"{measured:.4f}"
            elif isinstance(measured, (int, str, bool)):
                mtxt = str(measured)
            else:
                mtxt = str(measured)
            ttxt = "—" if target is None else str(target)
            lines.append(f"| {c['id']} | {c['name']} | {_status_icon(c['status'])} | {mtxt} | {ttxt} |")
        lines.append("")

    lines.append("## Honesty section")
    lines.append("")
    lines.append("### Not exercised by this framework")
    lines.append("")
    for u in results["untested"]:
        lines.append(f"- {u}")
    lines.append("")
    lines.append("### Limitations")
    lines.append("")
    for l in results["limitations"]:
        lines.append(f"- {l}")
    lines.append("")
    lines.append("### Methodology notes")
    lines.append("")
    for n in results.get("methodology", []):
        lines.append(f"- {n}")
    lines.append("")
    v = results.get("validation") or {}
    lines.append("## Independent validation")
    lines.append("")
    lines.append(f"- Executed: {v.get('executed')} · Passed: {v.get('passed')} · exit code: {v.get('exitCode')}")
    if v.get("outputTail"):
        lines.append("")
        lines.append("```")
        lines.append(str(v.get("outputTail"))[-800:])
        lines.append("```")
    lines.append("")
    lines.append("## Reproduction")
    lines.append("")
    lines.append("```bash")
    lines.append("# 1. Application: bun run dev        (Next.js dev server on :3000)")
    lines.append("# 2. Environment:  bun run db:seed   (idempotent demo data — skips if already seeded)")
    lines.append("# 3. Evaluation:")
    lines.append(results["framework"]["command"])
    lines.append("# Independent re-validation of any results.json:")
    lines.append("python3 evaluation/validate_results.py evaluation/results.json")
    lines.append("```")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Provenance / environment
# ---------------------------------------------------------------------------

def git_info(root: Path) -> dict[str, Any]:
    def git(*args: str) -> str:
        r = run_tool(root, ["git", *args], 30)
        return (r["stdout"] or "").strip()
    commit = git("rev-parse", "HEAD") or "unknown"
    branch = git("branch", "--show-current") or "unknown"
    dirty = bool(git("status", "--porcelain"))
    return {"commit": commit, "branch": branch, "dirty": dirty}


def main() -> int:
    parser = argparse.ArgumentParser(description="BanglaShield AI evaluation & benchmarking pipeline")
    parser.add_argument("--base-url", default=None, help="application under test (default: config.yaml base_url)")
    parser.add_argument("--quick", action="store_true", help="reduced live-AI budget (skips Track B subset)")
    parser.add_argument("--skip", action="extend", nargs="+", default=[], metavar="SUITE", help="suite ids to exclude (repeatable)")
    parser.add_argument("--only", action="extend", nargs="+", default=[], metavar="SUITE", help="suite ids to run exclusively (repeatable)")
    parser.add_argument("--no-validate", action="store_true", help="skip the independent validation step")
    parser.add_argument("--strict-exit", action="store_true", help="exit 1 when overall score is below the baseline band")
    parser.add_argument("--version", action="version", version=f"{FRAMEWORK_NAME} {FRAMEWORK_VERSION}")
    args = parser.parse_args()

    eval_dir = Path(__file__).resolve().parent
    root = eval_dir.parent
    config_path = eval_dir / "config.yaml"
    results_path = eval_dir / "results.json"
    report_path = eval_dir / "report.md"

    config = load_config(config_path)
    if args.base_url:
        config["base_url"] = args.base_url

    log(f"{FRAMEWORK_NAME} v{FRAMEWORK_VERSION}")
    log(f"  application under test : {config['base_url']}")
    log(f"  repository             : {root}")
    log(f"  mode                   : {'quick' if args.quick else 'full'}")
    log("")

    # --- preflight ---------------------------------------------------------
    try:
        probe = Client(config["base_url"], timeout_ms=20000).get("/")
        if probe.status != 200:
            raise FrameworkError(f"root page returned HTTP {probe.status}")
        log(f"preflight OK: GET / -> {probe.status} ({probe.elapsed_ms:.0f} ms)")
    except FrameworkError as e:
        log(f"ERROR: application unreachable at {config['base_url']} — start it with `bun run dev`.")
        return 2

    selected = [s for s in SUITE_ORDER if s not in args.skip]
    if args.only:
        selected = [s for s in SUITE_ORDER if s in args.only]
    not_run = [s for s in SUITE_ORDER if s not in selected]

    ctx = Ctx(config, root, args.quick)

    # dataset pre-extraction for suites that need it (detection, e2e)
    try:
        ctx.dataset = extract_dataset(root / config["detection"]["dataset_path"])
        log(f"dataset: extracted {len(ctx.dataset)} frozen samples from {config['detection']['dataset_path']}")
    except FrameworkError as e:
        log(f"WARNING: dataset extraction failed ({e}); affected suites will record honest failures/skips")
        ctx.dataset = []

    # --- run suites ---------------------------------------------------------
    runners: dict[str, Callable[[Ctx], dict[str, Any]]] = {
        "repo_integrity": run_repo_integrity,
        "frontend": run_frontend,
        "backend_api": run_backend_api,
        "detection": run_detection,
        "e2e": run_e2e,
        "security": run_security,
        "latency": run_latency,
    }
    suites: list[dict[str, Any]] = []
    t_start = time.monotonic()
    for sid in selected:
        log(f"==> suite: {sid}")
        try:
            suite = runners[sid](ctx)
            suites.append(suite)
            c = suite["counts"]
            score = M.fmt_pct(suite["score"])
            log(f"<== {sid}: score {score} (passed={c['passed']}, failed={c['failed']}, skipped={c['skipped']}, {suite['durationSec']}s)")
        except FrameworkError as e:
            log(f"ERROR in suite {sid}: {e}")
            stub = Suite(sid, sid, config["weights"].get(sid, 0), "suite aborted by harness error")
            stub.check("HARNESS", "Suite executed without harness errors", False, f"FrameworkError: {e}")
            suites.append(stub.finish(0.0))
        log("")

    overall, weight_used = M.overall_score(suites)
    grade = M.grade_for(overall, config["thresholds"])
    n_checks = sum(len(x["checks"]) for x in suites)
    n_passed = sum(x["counts"]["passed"] for x in suites)
    n_failed = sum(x["counts"]["failed"] for x in suites)
    n_skipped = sum(x["counts"]["skipped"] for x in suites)

    # --- untested / limitations (mandatory honesty fields) ------------------
    untested = [
        "Voice ASR with real microphone audio (POST /api/v1/analyses/{id}/input kind=audio, /api/v1/agent/voice) — no audio fixture was recorded; only the consent gate and invalid-audio paths were exercised.",
        "Image OCR / VLM analysis path (kind=image) — no image fixture; only route contract knowledge from source.",
        "TTS synthesis route (POST /api/v1/tts) — not exercised.",
        "Member authentication (register/login/logout) and analyst review workflows (patterns, reports, graph, audit) — read-only 401 checks only.",
        "Community feed write APIs (posts, comments, helpful marks) — not exercised (would mutate demo data).",
        "Report submission and withdrawal flows — not exercised.",
        "Learning progress tracking — not exercised.",
        "Production build artifacts (next build) — intentionally not run in this environment; all dynamic checks ran against the Next.js dev server (Turbopack).",
    ]
    for sid in not_run:
        untested.append(f"Suite `{sid}` was excluded from this run via CLI flags.")
    limitations = [
        "All dynamic measurements were taken against the Next.js dev server (Turbopack, bun runtime) on a single machine; production-build latency and caching behavior will differ.",
        "Track B (live production path) uses a stratified subset, not all 120 samples — live LLM calls are rate- and budget-bound; the full-dataset figure is Track A (deterministic).",
        "Live-AI turns are nondeterministic; repeated runs may vary in wording and latency. Track A, repo, frontend, security and contract checks are deterministic.",
        "Analysis latencies are measured at poll boundaries (4 s interval), so they are quantized upward by up to one interval.",
        "Rate-limit isolation uses virtual client IPs (X-Forwarded-For), matching the limiter's documented keying (src/lib/rate-limit.ts). The in-memory limiter is single-process.",
        "The OpenRouter key in this environment is the repository's documented embedded demo key (see src/lib/llm-gateway.ts); model-path availability depends on that key's quota at run time.",
        "Latency samples are environment-dependent (shared sandbox machine) and are recorded raw in results.json for independent recomputation.",
    ]
    methodology = [
        "Every metric originates from a live HTTP request, repository scan, or toolchain subprocess executed during this run; nothing is hardcoded.",
        "Failed checks are recorded and reported — never suppressed or retried into passing.",
        "Detection scoring: binary on scam/benign; ambiguous samples held out; INSUFFICIENT_EVIDENCE counts as abstain (mirrors src/lib/evaluation/runner.ts).",
        "Percentiles use the nearest-rank method over raw recorded samples.",
        "Suite score = passed/(passed+failed); skipped checks are excluded from the denominator; skipped suites drop out of the weighted overall (weights redistributed).",
        "The independent validator (validate_results.py) recomputes every aggregate from raw data in results.json.",
    ]

    # --- assemble results ----------------------------------------------------
    results: dict[str, Any] = {
        "framework": {
            "name": FRAMEWORK_NAME,
            "version": FRAMEWORK_VERSION,
            "command": "python3 evaluation/run_evaluation.py" + (" --quick" if args.quick else ""),
            "argv": sys.argv[1:],
            "startedAt": datetime.fromtimestamp(t_start, timezone.utc).isoformat(timespec="seconds"),
            "durationSec": round(time.monotonic() - t_start, 1),
        },
        "generatedAt": utc_now_iso(),
        "git": git_info(root),
        "environment": {
            "python": platform.python_version(),
            "bun": (run_tool(root, ["bun", "--version"], 20)["stdout"] or "").strip(),
            "os": f"{platform.system()} {platform.release()}",
            "baseUrl": config["base_url"],
            "devServer": "next dev (Turbopack) on :3000",
        },
        "config": {
            "thresholds": config["thresholds"],
            "weights": config["weights"],
            "quick": bool(args.quick),
            "detectionSubsetPerStratum": config["detection"]["track_b_samples_per_stratum"],
        },
        "dataset": {
            "path": config["detection"]["dataset_path"],
            "version": config["detection"]["dataset_version"],
            "samples": len(ctx.dataset or []),
            "scam": sum(1 for x in ctx.dataset or [] if x["label"] == "scam"),
            "benign": sum(1 for x in ctx.dataset or [] if x["label"] == "benign"),
            "ambiguous": sum(1 for x in ctx.dataset or [] if x["label"] == "ambiguous"),
            "extractionSha256": dataset_digest(ctx.dataset or []),
        },
        "virtualClients": {
            "backend_api": ctx.vip("backend_api"),
            "detection_analyst": ctx.vip("detection_analyst_base"),
            "detection_track_b": [f"{config['virtual_clients']['detection_track_b_base']}.{i}" for i in range(1, 10)],
            "e2e": ctx.vip("e2e"),
            "security": ctx.vip("security"),
            "latency": ctx.vip("latency"),
        },
        "suites": suites,
        "suitesNotRun": not_run,
        "summary": {
            "overallScore": round(overall, 6) if overall is not None else None,
            "grade": grade,
            "weightUsed": round(weight_used, 4),
            "checksTotal": n_checks,
            "checksPassed": n_passed,
            "checksFailed": n_failed,
            "checksSkipped": n_skipped,
        },
        "untested": untested,
        "limitations": limitations,
        "methodology": methodology,
        "validation": {"executed": False, "passed": None, "exitCode": None, "outputTail": None},
    }

    results_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"results written: {results_path}")

    report_path.write_text(render_report(results), encoding="utf-8")
    log(f"report written:   {report_path}")

    # --- independent validation ---------------------------------------------
    if not args.no_validate:
        log("")
        log("==> independent validation (evaluation/validate_results.py)")
        try:
            proc = subprocess.run(
                [sys.executable, str(eval_dir / "validate_results.py"), str(results_path), "--config", str(config_path)],
                cwd=str(root), capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120,
            )
            output = (proc.stdout or "") + (proc.stderr or "")
            results["validation"] = {
                "executed": True,
                "passed": proc.returncode == 0,
                "exitCode": proc.returncode,
                "outputTail": output[-2000:],
            }
            results_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            log(output.rstrip())
        except subprocess.TimeoutExpired:
            results["validation"] = {"executed": True, "passed": False, "exitCode": None, "outputTail": "validator timeout"}
        results_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        # re-render the report so it embeds the executed validation verdict
        report_path.write_text(render_report(results), encoding="utf-8")
        log(f"report updated with validation verdict: {report_path}")

    # --- console summary -------------------------------------------------------
    log("")
    log("=" * 72)
    log(f"OVERALL SCORE : {M.fmt_pct(overall)}  ({grade})")
    log(f"CHECKS        : {n_passed} passed / {n_failed} failed / {n_skipped} skipped (total {n_checks})")
    for suite in suites:
        log(f"  - {suite['id']:<15} {M.fmt_pct(suite['score']):>8}  ({suite['counts']['passed']}P/{suite['counts']['failed']}F/{suite['counts']['skipped']}S)")
    v = results["validation"]
    log(f"VALIDATION    : {'passed' if v.get('passed') else 'FAILED'} (exit {v.get('exitCode')})")
    log(f"OUTPUTS       : evaluation/results.json · evaluation/report.md")
    log("=" * 72)

    if args.strict_exit and overall is not None and grade == "below-baseline":
        return 1
    if not v.get("passed", True):
        return 3
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except FrameworkError as e:
        log(f"FRAMEWORK ERROR: {e}")
        sys.exit(2)

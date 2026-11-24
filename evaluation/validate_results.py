#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# BanglaShield AI — Evaluation & Benchmarking Framework (independent validator)
#
#   python3 evaluation/validate_results.py [results.json] [--config config.yaml]
#
# Validates a results.json produced by run_evaluation.py WITHOUT trusting any
# pre-computed aggregate: every score, metric and grade is recomputed from the
# raw recorded data (check lists, confusion counts, per-case outcomes, raw
# latency samples) using the shared pure-math library (metrics.py), then
# compared against what the runner reported.
#
# Exits 0 when the results file is internally consistent and complete;
# exits 1 with a precise list of discrepancies otherwise.
# ---------------------------------------------------------------------------

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))
import metrics as M  # noqa: E402


class V:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.n = 0

    def ok(self, cond: bool, label: str, detail: str = "") -> bool:
        self.n += 1
        if not cond:
            self.failures.append(f"{label}" + (f" — {detail}" if detail else ""))
        return cond


def die_unless_finite_literals(text: str) -> dict[str, Any]:
    def reject(const: str) -> Any:
        raise ValueError(f"non-finite JSON literal: {const}")

    return json.loads(text, parse_constant=reject)


def walk_numbers(obj: Any, path: str = "$") -> list[tuple[str, float]]:
    out: list[tuple[str, float]] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.extend(walk_numbers(v, f"{path}.{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.extend(walk_numbers(v, f"{path}[{i}]"))
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        out.append((path, float(obj)))
    return out


def approx(a: float | None, b: float | None, tol: float = 1e-9) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= tol


def main() -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description="Independently validate evaluation results.json")
    ap.add_argument("results", nargs="?", default=str(here / "results.json"))
    ap.add_argument("--config", default=str(here / "config.yaml"))
    args = ap.parse_args()

    results_path = Path(args.results)
    config_path = Path(args.config)
    v = V()

    # ---- files exist --------------------------------------------------------
    v.ok(results_path.is_file(), "results file exists", str(results_path))
    config_file = config_path
    if not v.ok(config_file.is_file(), "config file exists", str(config_file)):
        report(v)
        return 1

    # ---- parse --------------------------------------------------------------
    try:
        results = die_unless_finite_literals(results_path.read_text(encoding="utf-8"))
        v.ok(True, "results.json parses (no NaN/Infinity literals)")
    except Exception as e:  # noqa: BLE001
        v.ok(False, "results.json parses", str(e))
        report(v)
        return 1
    try:
        cfg_text = config_file.read_text(encoding="utf-8")
        try:
            import yaml  # type: ignore

            config = yaml.safe_load(cfg_text)
        except ImportError:
            config = _mini_yaml_text(cfg_text)
        v.ok(True, "config.yaml parses")
    except Exception as e:  # noqa: BLE001
        v.ok(False, "config.yaml parses", str(e))
        report(v)
        return 1

    # ---- top-level structure --------------------------------------------------
    for key in ("framework", "generatedAt", "git", "environment", "config", "dataset",
                "suites", "summary", "untested", "limitations", "validation"):
        v.ok(key in results, f"top-level key present: {key}")

    # ---- provenance ------------------------------------------------------------
    git = results.get("git") or {}
    v.ok(bool(re.fullmatch(r"[0-9a-f]{40}", str(git.get("commit", "")))), "git commit is a 40-hex sha", str(git.get("commit")))
    for ts in (results.get("generatedAt"), (results.get("framework") or {}).get("startedAt")):
        if ts:
            try:
                datetime.fromisoformat(str(ts))
                v.ok(True, f"timestamp parses ISO-8601: {ts}")
            except ValueError:
                v.ok(False, f"timestamp parses ISO-8601: {ts}")
    for path, num in walk_numbers(results):
        if num != num or abs(num) == float("inf"):
            v.ok(False, "all recorded numbers finite", path)

    # ---- config echo -----------------------------------------------------------
    rcfg = results.get("config") or {}
    v.ok(rcfg.get("thresholds") == config["thresholds"], "thresholds recorded == config.yaml")
    v.ok(rcfg.get("weights") == config["weights"], "weights recorded == config.yaml")
    wsum = sum((config["weights"] or {}).values())
    v.ok(approx(wsum, 1.0), "weights sum to 1.0", str(wsum))

    # ---- suites -----------------------------------------------------------------
    suites = results.get("suites") or []
    v.ok(len(suites) > 0, "at least one suite recorded")
    seen_ids: set[str] = set()
    all_check_ids: set[str] = set()
    for suite in suites:
        sid = suite.get("id")
        v.ok(sid in config["weights"], f"suite known to config: {sid}")
        v.ok(sid not in seen_ids, f"suite id unique: {sid}")
        seen_ids.add(sid)
        v.ok(approx(suite.get("weight", -1), config["weights"].get(sid, -1), 1e-12), f"suite weight matches config: {sid}")
        checks = suite.get("checks") or []
        counts = suite.get("counts") or {}
        re_pass = sum(1 for c in checks if c.get("status") == "passed")
        re_fail = sum(1 for c in checks if c.get("status") == "failed")
        re_skip = sum(1 for c in checks if c.get("status") == "skipped")
        v.ok(counts.get("passed") == re_pass and counts.get("failed") == re_fail and counts.get("skipped") == re_skip,
             f"counts recomputed from checks: {sid}", f"stored={counts} recomputed={re_pass}/{re_fail}/{re_skip}")
        v.ok(re_pass + re_fail + re_skip == len(checks), f"counts cover all checks: {sid}")
        rescore = M.suite_score(checks)
        v.ok(approx(suite.get("score"), rescore, 1e-9), f"suite score recomputed: {sid}", f"stored={suite.get('score')} recomputed={rescore}")
        for c in checks:
            cid = c.get("id")
            v.ok(cid and cid not in all_check_ids, f"check id unique: {sid}/{cid}")
            all_check_ids.add(f"{sid}/{cid}")
            v.ok(c.get("status") in M.VALID_CHECK_STATUS, f"check status valid: {sid}/{cid}", str(c.get("status")))
            v.ok(bool(str(c.get("evidence") or "").strip()), f"check evidence non-empty: {sid}/{cid}")
            v.ok(bool(str(c.get("name") or "").strip()), f"check name non-empty: {sid}/{cid}")

    overall, weight_used = M.overall_score(suites)
    summ = results.get("summary") or {}
    v.ok(approx(summ.get("overallScore"), overall, 1e-6), "overall score recomputed from suites x weights",
         f"stored={summ.get('overallScore')} recomputed={overall}")
    v.ok(approx(summ.get("weightUsed"), weight_used, 1e-4), "weight-used recomputed", f"stored={summ.get('weightUsed')} recomputed={weight_used}")
    grade = M.grade_for(overall, config["thresholds"])
    v.ok(summ.get("grade") == grade, "grade matches thresholds", f"stored={summ.get('grade')} recomputed={grade}")
    tot = sum(len(s.get("checks") or []) for s in suites)
    v.ok(summ.get("checksTotal") == tot, "checksTotal recomputed", f"stored={summ.get('checksTotal')} recomputed={tot}")
    v.ok(summ.get("checksPassed") == sum((s.get("counts") or {}).get("passed", 0) for s in suites), "checksPassed recomputed")
    v.ok(summ.get("checksFailed") == sum((s.get("counts") or {}).get("failed", 0) for s in suites), "checksFailed recomputed")
    v.ok(summ.get("checksSkipped") == sum((s.get("counts") or {}).get("skipped", 0) for s in suites), "checksSkipped recomputed")

    # ---- dataset -------------------------------------------------------------------
    ds = results.get("dataset") or {}
    parts = ds.get("scam", 0) + ds.get("benign", 0) + ds.get("ambiguous", 0)
    v.ok(parts == ds.get("samples"), "dataset label partition sums to sample count", f"{parts} vs {ds.get('samples')}")
    v.ok(ds.get("samples") == config["detection"]["expected_samples"], "dataset size matches config expectation", str(ds.get("samples")))

    # ---- detection recomputation -----------------------------------------------------
    det = next((s for s in suites if s.get("id") == "detection"), None)
    if det is not None:
        m = det.get("metrics") or {}
        ta = m.get("trackA") or {}
        if ta.get("confusion"):
            cm = ta["confusion"]
            met = M.binary_metrics(cm)
            stored = ta.get("metrics") or {}
            for k in ("precision", "recall", "f1", "falsePositiveRate", "falseNegativeRate", "accuracy"):
                v.ok(approx(stored.get(k), met.get(k), 1e-9), f"Track A {k} recomputed from TP/FP/FN/TN",
                     f"stored={stored.get(k)} recomputed={met.get(k)}")
            # semantic checks for DET-05..DET-09 (targets from config)
            tgt = config["detection"]["track_a_targets"]
            sem = {
                "DET-05": (met["precision"], tgt["precision_min"], "ge"),
                "DET-06": (met["recall"], tgt["recall_min"], "ge"),
                "DET-07": (met["f1"], tgt["f1_min"], "ge"),
                "DET-08": (met["falsePositiveRate"], tgt["fpr_max"], "le"),
                "DET-09": (met["falseNegativeRate"], tgt["fnr_max"], "le"),
            }
            for c in det["checks"]:
                if c["id"] in sem:
                    val, tgt_v, op = sem[c["id"]]
                    if val is None:
                        v.ok(c["status"] == "skipped", f"{c['id']} status consistent (metric undefined -> skipped)")
                    else:
                        expect = (val >= tgt_v) if op == "ge" else (val <= tgt_v)
                        v.ok((c["status"] == "passed") == expect, f"{c['id']} status consistent with recomputed metric",
                             f"recomputed={val:.6f} target={tgt_v} stored status={c['status']}")
        tb = m.get("trackB") or {}
        if tb and not tb.get("skipped") and tb.get("cases"):
            cases = tb["cases"]
            recm = M.confusion_from_outcomes(cases)
            recmet = M.binary_metrics(recm)
            stored_cm = tb.get("confusion") or {}
            for k_src, k_dst in (("tp", "tp"), ("fp", "fp"), ("fn", "fn"), ("tn", "tn"), ("abstained", "abstained"), ("ambiguous_held", "ambiguous_held")):
                v.ok(stored_cm.get(k_dst) == recm.get(k_src), f"Track B confusion.{k_dst} recomputed from cases",
                     f"stored={stored_cm.get(k_dst)} recomputed={recm.get(k_src)}")
            stored_met = tb.get("metrics") or {}
            for k in ("precision", "recall", "f1", "accuracy", "falsePositiveRate", "falseNegativeRate"):
                v.ok(approx(stored_met.get(k), recmet.get(k), 1e-9), f"Track B {k} recomputed from cases",
                     f"stored={stored_met.get(k)} recomputed={recmet.get(k)}")
            # semantic checks DET-12/13/14
            completion = M.ratio(sum(1 for c in cases if c.get("status") == "completed"), len(cases))
            acc = recmet["accuracy"]
            tb_t = config["detection"]["track_b_targets"]
            sem = {
                "DET-12": (completion, tb_t["completion_min"], "ge"),
                "DET-13": (acc, tb_t["accuracy_min"], "ge"),
                "DET-14": (recmet["f1"], tb_t["f1_min"], "ge"),
            }
            for c in det["checks"]:
                if c["id"] in sem:
                    val, tgt_v, op = sem[c["id"]]
                    if val is None:
                        v.ok(c["status"] == "skipped", f"{c['id']} status consistent (metric undefined)")
                    else:
                        expect = (val >= tgt_v) if op == "ge" else (val <= tgt_v)
                        v.ok((c["status"] == "passed") == expect, f"{c['id']} status consistent with recomputed metric",
                             f"recomputed={val:.6f} target={tgt_v} status={c['status']}")

    # ---- latency recomputation ----------------------------------------------------------
    lat = next((s for s in suites if s.get("id") == "latency"), None)
    if lat is not None:
        eps = (lat.get("metrics") or {}).get("endpoints") or []
        for e in eps:
            samples = e.get("samples") or []
            stats = M.latency_stats(samples)
            for k in ("p50", "p95", "max", "min"):
                v.ok(approx(e.get(k), stats.get(k), 1e-6), f"latency {e.get('name')}: {k} recomputed from samples",
                     f"stored={e.get(k)} recomputed={stats.get(k)}")
            v.ok(e.get("count") == len(samples), f"latency {e.get('name')}: count matches samples")
        # LAT check statuses consistent with measured <= target (p95-budget semantics)
        for c in lat.get("checks") or []:
            if isinstance(c.get("measured"), (int, float)) and isinstance(c.get("target"), (int, float)) and "p95" in c["name"]:
                expect = c["measured"] <= c["target"]
                v.ok((c["status"] == "passed") == expect, f"{c['id']} status consistent with p95 <= budget",
                     f"measured={c['measured']} target={c['target']} status={c['status']}")

    # ---- honesty fields --------------------------------------------------------------------
    v.ok(isinstance(results.get("untested"), list) and len(results["untested"]) > 0, "untested components listed (non-empty)")
    v.ok(isinstance(results.get("limitations"), list) and len(results["limitations"]) > 0, "limitations listed (non-empty)")

    # ---- report.md consistency ---------------------------------------------------------------
    report_path = here / "report.md"
    v.ok(report_path.is_file(), "report.md exists next to results.json")
    if report_path.is_file() and summ.get("overallScore") is not None:
        text = report_path.read_text(encoding="utf-8")
        expected_score = f"{summ['overallScore'] * 100:.2f}%"
        v.ok(expected_score in text, "report.md contains the reported overall score string", expected_score)
        v.ok("Overall score:" in text, "report.md carries the executive overall-score line")
        v.ok("## Honesty section" in text, "report.md carries the honesty section (untested/limitations)")

    # ---- validation self-field ------------------------------------------------------------------
    val = results.get("validation") or {}
    if val.get("executed"):
        v.ok(val.get("passed") is True, "embedded validation verdict is PASS (when executed)")

    report(v)
    return 0 if not v.failures else 1


def _mini_yaml_text(text: str) -> dict[str, Any]:
    # identical fallback parser as the runner (kept local so the validator has
    # no dependency on the runner module)
    def coerce(s: str) -> Any:
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
            if parent:
                last = list(parent.keys())[-1]
                if not isinstance(parent[last], list):
                    parent[last] = []
                parent[last].append(coerce(line[2:]))
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
            parent[key] = coerce(rest)
    return root


def report(v: V) -> None:
    print(f"validate_results: {v.n} consistency checks executed")
    if not v.failures:
        print("VALID — results.json is internally consistent, complete and independently recomputable.")
    else:
        print(f"INVALID — {len(v.failures)} discrepancy(ies):")
        for f in v.failures:
            print(f"  - {f}")


if __name__ == "__main__":
    sys.exit(main())

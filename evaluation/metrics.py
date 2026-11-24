#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# BanglaShield AI — Evaluation & Benchmarking Framework
# metrics.py — pure metric mathematics (no I/O, no network, no side effects).
#
# Both run_evaluation.py (producer) and validate_results.py (independent
# validator) import THIS module, so every reported aggregate can be
# recomputed from raw recorded data with the exact same formulas.
#
# Conventions
#   - Binary detection scoring operates ONLY on scam/benign labels
#     ("flagged" = predicted HIGH_RISK or CAUTION). Ambiguous-label samples
#     are HELD OUT (reported, never silently dropped). INSUFFICIENT_EVIDENCE
#     predictions and request failures count as abstentions.
#   - Percentiles use the nearest-rank method (sorted, index floor(p/100*n)).
#   - Suite score = passed / (passed + failed); skipped checks are excluded
#     from the denominator (a skipped check is unmeasured, not passing or
#     failing). A suite with no scored checks has score None.
# ---------------------------------------------------------------------------

from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

# ---------------------------------------------------------------------------
# Basic numeric helpers
# ---------------------------------------------------------------------------

TOL = 1e-9


def is_num(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float("inf")


def ratio(num: float, den: float) -> float | None:
    """num/den with zero-denominator guard (None = undefined)."""
    if den == 0:
        return None
    return num / den


# ---------------------------------------------------------------------------
# Confusion matrix (binary detection scoring)
# ---------------------------------------------------------------------------

FLAGGED_VALUES = {"HIGH_RISK", "CAUTION"}
CLEAR_VALUES = {"NO_RISK_INDICATORS"}
ABSTAIN_VALUES = {"INSUFFICIENT_EVIDENCE", None}


def confusion_from_outcomes(outcomes: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    """Fold per-case outcomes into a confusion matrix.

    Each outcome mapping requires:
      label    : "scam" | "benign" | "ambiguous"  (frozen ground truth)
      flagged  : True | False | None              (None = abstained/failed)
    """
    tp = fp = fn = tn = decided = abstained = ambiguous_held = 0
    for o in outcomes:
        label = o.get("label")
        flagged = o.get("flagged")
        if label == "ambiguous":
            ambiguous_held += 1
            continue
        if flagged is None:
            abstained += 1
            continue
        decided += 1
        if label == "scam":
            if flagged:
                tp += 1
            else:
                fn += 1
        else:  # benign
            if flagged:
                fp += 1
            else:
                tn += 1
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "decided": decided,
        "abstained": abstained,
        "ambiguous_held": ambiguous_held,
    }


def binary_metrics(cm: Mapping[str, Any]) -> dict[str, float | None]:
    """Precision, recall, F1, FPR, FNR, accuracy from a confusion matrix.

    Positive class = scam. FNR = FN/(FN+TP) (miss rate on scams).
    FPR = FP/(FP+TN) (benign messages wrongly flagged).
    """
    tp, fp, fn, tn = cm["tp"], cm["fp"], cm["fn"], cm["tn"]
    precision = ratio(tp, tp + fp)
    recall = ratio(tp, tp + fn)
    f1 = None
    if precision is not None and recall is not None and (precision + recall) > 0:
        f1 = 2 * precision * recall / (precision + recall)
    fpr = ratio(fp, fp + tn)
    fnr = ratio(fn, fn + tp)
    accuracy = ratio(tp + tn, tp + fp + fn + tn)
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "falsePositiveRate": fpr,
        "falseNegativeRate": fnr,
        "accuracy": accuracy,
    }


# ---------------------------------------------------------------------------
# Latency statistics
# ---------------------------------------------------------------------------

def percentile_nearest(values: Sequence[float], p: float) -> float | None:
    """Nearest-rank percentile. Matches the in-app runner's method
    (src/lib/evaluation/runner.ts: percentilize)."""
    if not values:
        return None
    s = sorted(float(v) for v in values)
    idx = min(len(s) - 1, int((p / 100.0) * len(s)))
    return s[idx]


def latency_stats(samples: Sequence[float]) -> dict[str, float | int | None]:
    if not samples:
        return {"count": 0, "min": None, "p50": None, "p95": None, "max": None}
    s = [float(v) for v in samples]
    return {
        "count": len(s),
        "min": min(s),
        "p50": percentile_nearest(s, 50),
        "p95": percentile_nearest(s, 95),
        "max": max(s),
    }


# ---------------------------------------------------------------------------
# Suite / overall scoring
# ---------------------------------------------------------------------------

VALID_CHECK_STATUS = {"passed", "failed", "skipped"}


def suite_score(checks: Sequence[Mapping[str, Any]]) -> float | None:
    """passed / (passed + failed). Skipped checks are excluded by design."""
    passed = sum(1 for c in checks if c.get("status") == "passed")
    failed = sum(1 for c in checks if c.get("status") == "failed")
    if passed + failed == 0:
        return None
    return passed / (passed + failed)


def suite_counts(checks: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    return {
        "passed": sum(1 for c in checks if c.get("status") == "passed"),
        "failed": sum(1 for c in checks if c.get("status") == "failed"),
        "skipped": sum(1 for c in checks if c.get("status") == "skipped"),
    }


def overall_score(suites: Sequence[Mapping[str, Any]]) -> tuple[float | None, float]:
    """Weighted overall score.

    Suites whose score is None (entirely skipped) drop out and their weight is
    redistributed proportionally over the measured suites, so a skipped suite
    never silently inflates the overall score. Returns (score, weight_used).
    """
    measured = [(s["score"], s["weight"]) for s in suites if s.get("score") is not None]
    total_weight = sum(w for _, w in measured)
    if total_weight == 0 or not measured:
        return None, total_weight
    return sum(score * w for score, w in measured) / total_weight, total_weight


# ---------------------------------------------------------------------------
# Grading bands (the configured benchmark targets)
# ---------------------------------------------------------------------------

def grade_for(score: float | None, thresholds: Mapping[str, float]) -> str | None:
    """Map a 0..1 score onto the configured bands.

    thresholds = {"baseline": 80, "strong": 90, "excellent": 95}  (percent)
    Returns: excellent | strong | baseline | below-baseline | None (no score)
    """
    if score is None:
        return None
    pct = score * 100.0
    if pct >= thresholds["excellent"]:
        return "excellent"
    if pct >= thresholds["strong"]:
        return "strong"
    if pct >= thresholds["baseline"]:
        return "baseline"
    return "below-baseline"


def band_of_percent(pct: float | None, thresholds: Mapping[str, float]) -> str | None:
    if pct is None:
        return None
    return grade_for(pct / 100.0, thresholds)


# ---------------------------------------------------------------------------
# Formatting helpers (report rendering only; never used for scoring)
# ---------------------------------------------------------------------------

def fmt_pct(x: float | None, digits: int = 2) -> str:
    if x is None:
        return "n/a"
    return f"{x * 100:.{digits}f}%"


def fmt_ms(x: float | None) -> str:
    if x is None:
        return "n/a"
    return f"{x:.0f} ms"


def fmt_num(x: float | None, digits: int = 3) -> str:
    if x is None:
        return "n/a"
    return f"{x:.{digits}f}"


def mean(values: Iterable[float]) -> float | None:
    xs = list(values)
    if not xs:
        return None
    return sum(xs) / len(xs)

#!/usr/bin/env python3
"""Dependency-free descriptive metrics for Baseera validation JSONL."""
from __future__ import annotations
import argparse, json, math, statistics, sys
from collections import defaultdict
from pathlib import Path


def tokens(text: str) -> list[str]:
    return text.split()


def edit_distance(a: list[str], b: list[str]) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON on line {n}: {e}") from e
            if not isinstance(row, dict):
                raise ValueError(f"Line {n} must be a JSON object")
            rows.append(row)
    return rows


def audio_report(rows: list[dict]):
    selected = [r for r in rows if r.get("modality") == "audio"]
    if not selected:
        return None
    totals = [0, 0, 0, 0]  # word edits, ref words, char edits, ref chars
    people = defaultdict(lambda: [0, 0, 0, 0])
    for r in selected:
        if not isinstance(r.get("reference_text"), str) or not isinstance(r.get("hypothesis_text"), str):
            raise ValueError(f"Audio row {r.get('sample_id')} requires reference_text and hypothesis_text")
        rw, hw = tokens(r["reference_text"]), tokens(r["hypothesis_text"])
        rc, hc = list("".join(r["reference_text"].split())), list("".join(r["hypothesis_text"].split()))
        vals = [edit_distance(rw, hw), len(rw), edit_distance(rc, hc), len(rc)]
        for i, v in enumerate(vals):
            totals[i] += v
            people[str(r.get("participant_id", "unknown"))][i] += v
    def rates(v):
        return {"WER": v[0] / v[1] if v[1] else None, "CER": v[2] / v[3] if v[3] else None, "reference_words": v[1]}
    return {"samples": len(selected), **rates(totals), "normalization": "whitespace-only; Arabic letters and diacritics preserved",
            "per_participant": {k: rates(v) for k, v in sorted(people.items())}}


def gaze_report(rows: list[dict]):
    selected = [r for r in rows if r.get("modality") == "gaze"]
    if not selected:
        return None
    errors, by_person, reference_errors = [], defaultdict(list), []
    for r in selected:
        keys = ("target_x_px", "target_y_px", "predicted_x_px", "predicted_y_px")
        if any(not isinstance(r.get(k), (int, float)) for k in keys):
            raise ValueError(f"Gaze row {r.get('sample_id')} requires numeric target/predicted coordinates")
        e = math.hypot(r["predicted_x_px"] - r["target_x_px"], r["predicted_y_px"] - r["target_y_px"])
        errors.append(e); by_person[str(r.get("participant_id", "unknown"))].append(e)
        if isinstance(r.get("reference_gaze_x_px"), (int, float)) and isinstance(r.get("reference_gaze_y_px"), (int, float)):
            reference_errors.append(math.hypot(r["predicted_x_px"] - r["reference_gaze_x_px"], r["predicted_y_px"] - r["reference_gaze_y_px"]))
    def summary(vals):
        ordered = sorted(vals)
        return {"n": len(vals), "mean": statistics.mean(vals), "median": statistics.median(vals), "p95": ordered[max(0, math.ceil(.95 * len(ordered)) - 1)]}
    result = {"samples": len(errors), "target_prediction_error_px": summary(errors),
              "per_participant_target_error_px": {k: summary(v) for k, v in sorted(by_person.items())},
              "interpretation_warning": "Error against the displayed target is not ground-truth gaze accuracy. Use synchronized reference eye-tracker coordinates for that claim."}
    if reference_errors:
        result["reference_tracker_error_px"] = summary(reference_errors)
    return result


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("jsonl", type=Path)
    args = p.parse_args()
    try:
        rows = read_jsonl(args.jsonl)
        if not rows:
            raise ValueError("Input contains no records")
        unauthorized = [r for r in rows if r.get("split") != "synthetic" and r.get("consent_status") != "approved"]
        if unauthorized:
            raise ValueError(f"{len(unauthorized)} non-synthetic rows lack consent_status='approved'")
        print(json.dumps({"records": len(rows), "synthetic_records": sum(r.get("split") == "synthetic" for r in rows),
                          "audio": audio_report(rows), "gaze": gaze_report(rows),
                          "warning": "Descriptive metrics only; not clinical validation or diagnosis."}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())

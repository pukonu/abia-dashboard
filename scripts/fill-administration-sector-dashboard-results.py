#!/usr/bin/env python3
"""Fill Administration & Governance Sector Dashboard results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jul 2026 monthly reporting):
  - BudgIT State of States 2025 — Abia 4th overall (from 17th in 2023);
    No. 1 in capital project prioritisation with 77% of 2024 expenditure
    on capital (Vanguard / BudgIT / Time.com.ng partnership visit May 2026)
  - Gov. Otti May 2026 media chat / 3rd anniversary — salaries & pensions
    paid regularly on the 28th; court halls across all 17 LGAs; ultra-modern
    court complex commissioned (THISDAY / Newswatch / TechTrends)
  - Abia State Governors and Deputy Governor Pensions (Repeal) Law 2024 —
    abolishes pensions for former governors and deputies (TechTrends)

Usage:
  python3 scripts/fill-administration-sector-dashboard-results.py          # dry run
  python3 scripts/fill-administration-sector-dashboard-results.py --apply
"""

from __future__ import annotations

import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ADMINISTRATION_SLUG = "administration"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jul 2026"
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    "BudgIT State of States ranking": (
        4,
        None,
        "BudgIT State of States 2025: Abia ranked 4th overall nationally, "
        "up from 17th in 2023 — first Top-5 entry (Vanguard / BudgIT; "
        "reaffirmed during BudgIT visit May 2026). Rank scale: 1 = best. "
        "Target: State Plan 1.",
    ),
    "BudgIT capital prioritisation ranking": (
        1,
        None,
        "BudgIT 2025 report: Abia ranked No. 1 nationally on capital "
        "project prioritisation (Vanguard State of States coverage). "
        "Rank scale: 1 = best. Target: State Plan 1.",
    ),
    "Capital share of expenditure": (
        77,
        None,
        "BudgIT 2025: Abia dedicated 77% of total expenditure to capital "
        "projects in 2024 — highest ratio in the country (Vanguard). "
        "Distinct from the 2026 appropriation capital share (~80%). "
        "Target: State Plan ≥80%.",
    ),
    "Salary and pension payment day": (
        28,
        None,
        "Gov. Alex Otti 3rd-anniversary / May 2026 briefings: civil "
        "servants and pensioners receive salaries and pensions regularly "
        "on the 28th of every month (THISDAY / Newswatch). Target: State "
        "Plan day 28.",
    ),
    "LGAs with court halls planned or under construction": (
        17,
        None,
        "Gov. Otti May 2026: statewide programme to build court halls in "
        "all 17 LGAs, equipped with renewable energy, digital libraries, "
        "internet and water (THISDAY / Newswatch / TechTrends). Target: "
        "State Plan 17.",
    ),
    "Ultra-modern court complexes commissioned": (
        1,
        None,
        "TechTrends / anniversary coverage: an ultra-modern court complex "
        "has already been commissioned, alongside the 17-LGA court-hall "
        "programme.",
    ),
    "Former governors pension abolished": (
        1,
        None,
        "Abia State Governors and Deputy Governor Pensions (Repeal) Law "
        "2024 signed into law — abolishes pensions for former governors "
        "and deputy governors (TechTrends). Value 1 = reform enacted. "
        "Target: State Plan 1.",
    ),
}

LEFT_BLANK = [
    "Citizen complaints resolved within SLA",  # Citizens Engagement Centre cited; no published %
    "Average complaint resolution time",
    "Executive decisions implemented on time",
    "Procurement milestones published",  # e-procurement gaps noted by BudgIT; no Abia %
    "Priority projects with current status updates",
]


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"')
    return env


def q(value: str) -> str:
    return urllib.parse.quote(value, safe="")


class Supabase:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.key = key
        self.ctx = ssl._create_unverified_context()

    def _call(self, method: str, path: str, body=None, prefer: str | None = None):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        req = urllib.request.Request(
            f"{self.base}/{path}",
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, context=self.ctx, timeout=120) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"{method} {path} -> {err.code}: {err.read().decode()}") from err

    def select(self, path: str):
        return self._call("GET", path)


def main() -> int:
    apply_flag = "--apply" in sys.argv
    print(f"Will fill {len(FILLS)} sourced indicators; leave {len(LEFT_BLANK)} blank.\n")
    print("FILL (published sources only):")
    for name, (abia, ng, notes) in FILLS.items():
        ng_s = f", NG={ng}" if ng is not None else ""
        print(f"  ✓ {name} = {abia}{ng_s}")
        print(f"      {notes[:140]}…")
    print("\nLEAVE BLANK (no reliable published figure):")
    for name in LEFT_BLANK:
        print(f"  · {name}")

    if not apply_flag:
        print(f"\nDry run only. Re-run with --apply to write {PERIOD_LABEL} sourced results.")
        return 0

    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing Supabase env")
        return 1

    sb = Supabase(url, key)
    sectors = sb.select(f"sectors?select=id&slug=eq.{ADMINISTRATION_SLUG}")
    if not sectors:
        print("Administration & Governance sector not found")
        return 1
    administration_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{administration_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-administration-sector-dashboard-framework.py --apply first.")
        return 1
    ta_id = tas[0]["id"]

    periods = sb.select(
        f"time_periods?select=id,label&frequency=eq.monthly&label=eq.{q(PERIOD_LABEL)}"
    )
    if not periods:
        print(f"Time period not found: {PERIOD_LABEL}")
        return 1
    period_id = periods[0]["id"]

    clear_period_ids: dict[str, str] = {PERIOD_LABEL: period_id}
    for label in CLEAR_PERIOD_LABELS:
        if label == PERIOD_LABEL:
            continue
        found = sb.select(
            f"time_periods?select=id,label&frequency=eq.monthly&label=eq.{q(label)}"
        )
        if found:
            clear_period_ids[label] = found[0]["id"]

    domains = sb.select(f"domains?select=id,name&thematic_area_id=eq.{ta_id}")
    name_to_ind: dict[str, dict] = {}
    for d in domains:
        inds = sb.select(
            f"indicators?select=id,name,target_value&domain_id=eq.{d['id']}&indicator_scope=eq.state&limit=200"
        )
        for ind in inds:
            name_to_ind[ind["name"]] = ind

    missing = [n for n in FILLS if n not in name_to_ind]
    if missing:
        print(f"Indicators not found in DB: {missing}")
        return 1

    cleared = 0
    for label, pid in clear_period_ids.items():
        for name, ind in name_to_ind.items():
            existing = sb.select(
                "results?select=id"
                f"&indicator_id=eq.{ind['id']}"
                f"&time_period_id=eq.{pid}"
                "&entity_id=is.null"
            )
            for row in existing or []:
                sb._call("DELETE", f"results?id=eq.{row['id']}", prefer="return=minimal")
                cleared += 1
                print(f"  cleared {name} ({label})")

    print(f"\nCleared {cleared} prior statewide result(s).")

    rows = []
    for name, (abia, ng, notes) in FILLS.items():
        ind = name_to_ind[name]
        rows.append(
            {
                "indicator_id": ind["id"],
                "time_period_id": period_id,
                "entity_id": None,
                "abia_value": abia,
                "nigeria_value": ng,
                "target_value": ind.get("target_value"),
                "notes": notes,
            }
        )

    created = sb._call("POST", "results", rows, prefer="return=representation")
    print(f"\nWrote {len(created)} sourced statewide results for {PERIOD_LABEL}.")
    for r, name in zip(created, FILLS.keys()):
        print(f"  {name}: {r['abia_value']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

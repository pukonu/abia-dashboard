#!/usr/bin/env python3
"""Fill Economy & Trade Sector Dashboard statewide results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jul 2026 monthly reporting):
  - Abia State Q4 2025 Budget Implementation Report — independent revenue
    (IGR) ₦66.859 bn vs ₦120.625 bn target (55.4%); cited by FIJ
  - 2026 Appropriation — ₦1.016 tn budget; ~80% capital; IGR target ₦223.4 bn
    (Abia State Government / Business Hallmark / Realnews)
  - Gov. Otti May 2026 media chat / 3rd anniversary — 4,707 CofOs signed;
    ~4 million land documents digitised (UN-Habitat); debt cut from ~₦191 bn
    (2023) to ~₦60 bn (~70%); BudgIT fiscal ranking 17th → 4th
    (THISDAY / New Telegraph / Peoples Gazette)

Usage:
  python3 scripts/fill-economy-sector-dashboard-results.py          # dry run
  python3 scripts/fill-economy-sector-dashboard-results.py --apply
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

ECONOMY_SLUG = "economy"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jul 2026"
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    "Annual IGR": (
        66.86,
        None,
        "Abia State Fourth Quarter Budget Implementation Report 2025: "
        "independent revenue (IGR) year-to-date ₦66,859,046,135.25 "
        "(~₦66.86 bn) against final budget ₦120.625 bn — 55.4% of target "
        "(Ministry of Budget / Accountant-General; FIJ analysis). Pegged to "
        "Jul 2026 as latest full-year published outturn. Target on indicator: "
        "2026 IGR plan ₦223.4 bn.",
    ),
    "IGR collection vs annual target": (
        55.4,
        None,
        "Same Q4 2025 Budget Implementation Report: independent revenue "
        "performance 55.4% of the 2025 final IGR budget (₦66.86 bn / "
        "₦120.625 bn).",
    ),
    "Certificates of Occupancy signed": (
        4707,
        None,
        "Gov. Alex Otti May 2026 media chat / 3rd-anniversary briefings: "
        "4,707 Certificates of Occupancy signed — more than the total issued "
        "between 1999 and 2023 (THISDAY / New Telegraph / Peoples Gazette). "
        "Pegged to Jul 2026 as latest published cumulative stock.",
    ),
    "Land documents digitised": (
        4000000,
        None,
        "Same briefings: collaboration with UN-Habitat digitised about four "
        "million land documents into the state system for verification "
        "(THISDAY / New Telegraph). Target: State Plan 4,000,000.",
    ),
    "Approved annual budget": (
        1016.23,
        None,
        "2026 Appropriation Bill signed into law: ₦1,016,228,072,651.99 "
        "(~₦1.016 tn) — “Budget of Acceleration and New Possibilities” "
        "(Abia State Government / House of Assembly).",
    ),
    "Capital share of budget": (
        80,
        None,
        "2026 budget presentation: capital expenditure about 80% of total "
        "outlay (~₦811.8 bn capital vs ~₦204.4 bn recurrent) — Business "
        "Hallmark / Realnews / state briefings. Target: State Plan 80%.",
    ),
    "State debt stock": (
        60,
        None,
        "Gov. Otti May 2026 briefing: state debt profile reduced from about "
        "₦191 billion in 2023 to about ₦60 billion by end-2025 "
        "(Peoples Gazette / Vanguard anniversary coverage).",
    ),
    "Debt reduction since 2023": (
        70,
        None,
        "Anniversary / May 2026 briefings: debt burden reduced by more than "
        "70% since 2023 (Vanguard / Peoples Gazette). Target: State Plan ≥70%.",
    ),
    "BudgIT fiscal transparency ranking": (
        4,
        None,
        "Gov. Otti: Abia moved from 17th (2023) to 4th (2025) in budget / "
        "fiscal transparency rankings (Peoples Gazette May 2026 media chat). "
        "Rank scale: 1 = best. Target: State Plan 1.",
    ),
}

LEFT_BLANK = [
    "Monthly IGR",  # no clean published Jul 2026 monthly BIR figure
    "New businesses registered",  # no published monthly CAC/state register count
    "Jobs created",  # ASEPA ~2,000 cited under Environment; no economy-wide stock
    "SMEs accessing formal credit",
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
    sectors = sb.select(f"sectors?select=id&slug=eq.{ECONOMY_SLUG}")
    if not sectors:
        print("Economy & Trade sector not found")
        return 1
    economy_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{economy_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-economy-sector-dashboard-framework.py --apply first.")
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

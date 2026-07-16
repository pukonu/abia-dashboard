#!/usr/bin/env python3
"""Fill Environment Sector Dashboard statewide results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jul 2026 monthly reporting):
  - ASEPA GM Ogbonnia Okereke interview (Vanguard, 30 May 2026) —
    emergency evacuation >4,000 truckloads / >80,000 tonnes in first 4 weeks;
    annual waste collected ~650,000 tonnes in 2025 (vs ~200,000 in 2022);
    >4,000 sanitation workers across 17 LGAs; >20 heavy-duty trucks and
    >30 collection vans (from 6 trucks at start); 4 plastic recycling
    facilities; ASEPA IGR from <₦20m to >₦100m
  - Gov. Otti anniversary / media briefings — >2,000 jobs created through
    ASEPA / environmental management (Punch / TechTrends / Peoples Gazette)

Usage:
  python3 scripts/fill-environment-sector-dashboard-results.py          # dry run
  python3 scripts/fill-environment-sector-dashboard-results.py --apply
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

ENVIRONMENT_SLUG = "environment"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jul 2026"
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    "Annual waste collected": (
        650000,
        None,
        "ASEPA GM Ogbonnia Okereke (Vanguard, 30 May 2026): agency collected "
        "about 650,000 tonnes of waste in 2025, up from about 200,000 tonnes "
        "in 2022. Pegged to Jul 2026 as latest published full-year outturn.",
    ),
    "Emergency refuse evacuated (first 4 weeks)": (
        80000,
        None,
        "Same ASEPA GM interview: within four weeks of the sanitation "
        "emergency at inauguration, task force evacuated more than 80,000 "
        "tonnes of abandoned refuse across Aba and Umuahia (>4,000 truckloads).",
    ),
    "LGAs with ASEPA operations": (
        17,
        None,
        "ASEPA GM: sanitation workers now operate across all 17 local "
        "government areas (expanded from the two major towns at takeover). "
        "Target: State Plan 17.",
    ),
    "ASEPA sanitation workers": (
        4000,
        None,
        "ASEPA GM (Vanguard, May 2026): ASEPA has over 4,000 sanitation "
        "workers statewide, plus over 200 civil servants on regulation and "
        "inspection. Value uses the published “over 4,000” floor.",
    ),
    "Jobs created through ASEPA": (
        2000,
        None,
        "Gov. Alex Otti anniversary / May 2026 briefings: environmental "
        "reforms facilitated creation of more than 2,000 jobs through ASEPA "
        "(Punch / TechTrends / Peoples Gazette). Target: State Plan ≥2,000.",
    ),
    "Heavy-duty waste trucks": (
        20,
        None,
        "ASEPA GM: fleet rebuilt from only six operational trucks at takeover "
        "to over 20 heavy-duty trucks statewide (Vanguard, May 2026). Value "
        "uses the published “over 20” floor.",
    ),
    "Waste collection vans": (
        30,
        None,
        "Same interview: over 30 smaller collection vans now operate across "
        "the state alongside the heavy-duty fleet.",
    ),
    "ASEPA annual IGR": (
        100,
        None,
        "ASEPA GM: internally generated revenue increased from less than "
        "₦20 million annually to over ₦100 million last year (Vanguard, "
        "May 2026). Value uses the published “over ₦100m” floor.",
    ),
    "Plastic recycling facilities operational": (
        4,
        None,
        "ASEPA GM: Abia currently has four operational plastic recycling and "
        "conversion facilities (some supported by FBRA and partners), with "
        "sites in Umuahia and Aba converting PET/plastics (Vanguard, May 2026).",
    ),
}

LEFT_BLANK = [
    "Urban waste collection coverage",  # house-to-house rollout mid-July 2026; no published %
    "Markets meeting sanitation standard",
    "Drainage desilting completed",
    "Active erosion sites under control",
    "Monthly flood incidents",
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
    sectors = sb.select(f"sectors?select=id&slug=eq.{ENVIRONMENT_SLUG}")
    if not sectors:
        print("Environment sector not found")
        return 1
    environment_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{environment_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-environment-sector-dashboard-framework.py --apply first.")
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

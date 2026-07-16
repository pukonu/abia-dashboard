#!/usr/bin/env python3
"""Fill Infrastructure Sector Dashboard statewide results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jul 2026 monthly reporting):
  - Gov. Otti 3rd-anniversary / May 2026 media chat — 414 completed road
    projects (864.12 km); 82 roads under construction (~212 km)
    (Premium Times / Peoples Gazette / Guardian / Vanguard / THISDAY)
  - Abia Green Shuttle — >226,000 passengers as at April 2026; 70 bus
    shelters (30 Umuahia / 40 Aba); 68 operational (30 + 38); Umuahia
    Multi-Modal Transport System completed; Aba terminal expected 2027
    (Gazette / Punch / BusinessDay / Premium Times)

Usage:
  python3 scripts/fill-infrastructure-sector-dashboard-results.py          # dry run
  python3 scripts/fill-infrastructure-sector-dashboard-results.py --apply
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

INFRASTRUCTURE_SLUG = "infrastructure"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jul 2026"
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    "Completed road projects": (
        414,
        None,
        "Gov. Alex Otti 3rd-anniversary / May 2026 media chat: administration "
        "completed 414 road projects in three years (Premium Times / Peoples "
        "Gazette / Guardian / Vanguard / THISDAY). Pegged to Jul 2026 as latest "
        "published cumulative stock.",
    ),
    "Completed road length": (
        864.12,
        None,
        "Same briefing: completed roads measure about 864.12 kilometres, "
        "including street lights and drainage where reported (THISDAY / "
        "Peoples Gazette). Pegged to Jul 2026 as latest published cumulative.",
    ),
    "Road projects under construction": (
        82,
        None,
        "Gov. Otti May 2026 briefing: an additional 82 road projects currently "
        "under construction at different stages of completion (Premium Times / "
        "Peoples Gazette).",
    ),
    "Road length under construction": (
        212,
        None,
        "Same briefing: roads under construction measure about 212 kilometres "
        "(THISDAY / Peoples Gazette / Premium Times).",
    ),
    "Green Shuttle passengers": (
        226000,
        None,
        "Abia Green Shuttle Initiative: over 226,000 passengers transported as "
        "at April 2026 (Gov. Otti May media chat / Peoples Gazette / Premium "
        "Times). Cumulative since Dec 2025 launch — pegged to Jul 2026 as "
        "latest published ridership figure.",
    ),
    "Bus shelters delivered": (
        70,
        None,
        "State transport briefings: 70 bus shelters delivered — 30 in Umuahia "
        "and 40 in Aba (Commissioner Okey Kanu / Punch / BusinessDay; also "
        "cited in May 2026 anniversary briefing). Target: State Plan 70.",
    ),
    "Operational bus shelters": (
        68,
        None,
        "Commissioner for Information briefing (Punch / BusinessDay): 30 "
        "Umuahia shelters operational; 38 of 40 Aba shelters operational "
        "(2 nearing completion) — 68 operational. Target: State Plan 70.",
    ),
    "Multi-modal terminals completed": (
        1,
        None,
        "Gov. Otti May 2026: Umuahia Multi-Modal Transport System completed "
        "and in use; Aba Terminal expected 2027 (Peoples Gazette / Premium "
        "Times). Value = 1 of 2 planned terminals. Target: State Plan 2.",
    ),
}

LEFT_BLANK = [
    "Projects on schedule",  # no published % on-schedule for active portfolio
    "State roads in good condition",  # no published statewide good-condition %
    "Major corridors with street lighting",  # streetlights sustained; no corridor %
    "Population with safe water access",  # no reliable Abia SDG 6 % for this period
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
    sectors = sb.select(f"sectors?select=id&slug=eq.{INFRASTRUCTURE_SLUG}")
    if not sectors:
        print("Infrastructure sector not found")
        return 1
    infrastructure_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{infrastructure_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-infrastructure-sector-dashboard-framework.py --apply first.")
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

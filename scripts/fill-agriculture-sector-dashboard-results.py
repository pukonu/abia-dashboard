#!/usr/bin/env python3
"""Fill Agriculture Sector Dashboard statewide results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jul 2026 monthly reporting):
  - Abia Ministry of Agriculture / ADDS input flag-off (~10 Jul 2026) —
    Agbaeze / Gov. Otti: 18,634 verified farmers; 3,312 received inputs at
    flag-off; remaining distribution via LGAs; coverage across 17 LGAs and
    184 wards (Punch / Daily News Lead / state briefings)
  - Presco / Abia palm oil MoU — ~USD 200m, ~14,000–14,086 ha identified,
    ~5,000 jobs targeted (Ozuitem / Abam / Ulonna corridor)

Usage:
  python3 scripts/fill-agriculture-sector-dashboard-results.py          # dry run
  python3 scripts/fill-agriculture-sector-dashboard-results.py --apply
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

AGRICULTURE_SLUG = "agriculture"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jul 2026"
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    "Verified farmers on state database": (
        18634,
        None,
        "Abia Agricultural Dynamic Database System (ADDS) / input programme "
        "flag-off (~10 Jul 2026): Commission for Agriculture Agbaeze and Gov. "
        "Otti briefings report 18,634 verified farmers registered statewide "
        "(Punch / Daily News Lead / state media).",
    ),
    "Farmers receiving improved inputs this season": (
        18634,
        None,
        "Same ADDS flag-off: all 18,634 verified farmers are scheduled to "
        "receive free improved seeds/seedlings and fertiliser this season "
        "(3,312 at flag-off; remainder via LGA distribution). Target: State "
        "Plan = programme cohort.",
    ),
    "Farmers receiving inputs at flag-off": (
        3312,
        None,
        "Flag-off ceremony (~10 Jul 2026): 3,312 farmers received input packs "
        "on the day; remaining verified farmers to collect via LGAs "
        "(Punch / Daily News Lead).",
    ),
    "LGAs covered by input programme": (
        17,
        None,
        "Statewide input / ADDS programme covers all 17 Abia LGAs. Target: "
        "State Plan 17.",
    ),
    "Priority crop varieties supported": (
        7,
        None,
        "Input package covers cassava, rice, maize, plantain, sweet potato, "
        "pepper and tomato (plus fertilisers) — seven priority crop types "
        "cited at flag-off briefings. Target: State Plan 7.",
    ),
    "Palm oil investment MoU": (
        200,
        None,
        "Presco / Abia State palm oil MoU: about USD 200 million committed "
        "private investment for large-scale plantation development "
        "(Ozuitem / Abam / Ulonna corridor) — state and press briefings.",
    ),
    "Palm plantation land identified": (
        14086,
        None,
        "Palm oil investment corridor: approximately 14,000–14,086 hectares "
        "identified for plantation development under the Presco MoU "
        "(state / press briefings).",
    ),
    "Jobs targeted from palm oil investment": (
        5000,
        None,
        "Palm oil MoU: about 5,000 direct and indirect jobs targeted from "
        "plantation and processing investment. Target: State Plan 5,000.",
    ),
    "Wards mapped in farmer registration": (
        184,
        None,
        "ADDS / farmer registration rollout reported across 184 political "
        "wards statewide (Punch coverage of programme launch). Target: "
        "State Plan 184.",
    ),
}

LEFT_BLANK = [
    "Cassava yield",  # no reliable published Abia t/ha for this season
    "Rice paddy yield",
    "Maize yield",
    "Post-harvest losses",  # SDG 12.3 framing only; no Abia % published
    "Extension visits per farm cluster",
    "Farmers with geo-referenced farmland",
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
    sectors = sb.select(f"sectors?select=id&slug=eq.{AGRICULTURE_SLUG}")
    if not sectors:
        print("Agriculture sector not found")
        return 1
    agriculture_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{agriculture_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-agriculture-sector-dashboard-framework.py --apply first.")
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

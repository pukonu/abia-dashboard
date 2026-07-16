#!/usr/bin/env python3
"""Fill Technology Sector Dashboard statewide results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jul 2026 monthly reporting):
  - WIOCC / Abia fibre duct groundbreaking (Oct 2025) — open-access duct
    infrastructure underway (Abia State Government / Guardian /
    Nigeria CommunicationsWeek). Job claims are not recorded as results.
  - Umuahia Dedicated Internet Access / WAN flag-off (21 Mar 2025) — first
    phase digital government connectivity for MDAs (Abia State Government)
  - MTN Nigeria MoU — six focus areas incl. 100% broadband coverage target,
    device scheme, digital governance/cloud, digital mall, 4G/5G in
    Umuahia/Aba/Ohafia, digital marketplace (Punch / Exco briefing)
  - Land documents digitised — State Plan target 5 million; no verified
    statewide count entered until confirmed

Usage:
  python3 scripts/fill-technology-sector-dashboard-results.py          # dry run
  python3 scripts/fill-technology-sector-dashboard-results.py --apply
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

TECHNOLOGY_SLUG = "technology"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jul 2026"
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    "Fibre duct infrastructure projects underway": (
        1,
        None,
        "Gov. Alex Otti groundbreaking for the WIOCC Abia State Duct "
        "Infrastructure Project (Aba South, ~29 Oct 2025) — open-access "
        "underground fibre duct for statewide broadband (Abia State "
        "Government / Guardian / Nigeria CommunicationsWeek). Pegged to "
        "Jul 2026 as active major connectivity project.",
    ),
    "Priority cities for 4G/5G rollout": (
        3,
        None,
        "Abia–MTN MoU (Exco briefing / Punch): provision of 4G and 5G "
        "services in Umuahia, Aba and Ohafia before year-end — three "
        "priority cities. Target: State Plan 3.",
    ),
    "Strategic digital partnership focus areas": (
        6,
        None,
        "Same MTN MoU covers six areas: (1) 100% broadband coverage, "
        "(2) civil-servant device ownership scheme, (3) digital governance "
        "/ cloud, (4) Abia digital mall for SMEs, (5) 4G/5G in major "
        "cities, (6) digital marketplace for e-governance and e-commerce "
        "(Punch / Commissioner Okey Kanu briefing). Target: State Plan 6.",
    ),
    "Digital government WAN projects flagged off": (
        1,
        None,
        "Gov. Otti flagged off the Umuahia Dedicated Internet Access / Wide "
        "Area Network project (21 Mar 2025) at Nnamdi Azikiwe Secretariat — "
        "first phase of MDA digital connectivity and device rollout (Abia "
        "State Government / “The Digital Transformation Journey Begins”).",
    ),
}

LEFT_BLANK = [
    "Land documents digitised",  # State Plan target 5m; no verified Abia count yet
    "Broadband population coverage",  # MTN MoU targets 100%; no audited Abia % published
    "Government services available online",  # no published census of online services
    "Online service completion rate",
    "Youth trained in digital skills",
    "Startups supported by state programmes",
    "Tech-enabled SMEs onboarded",
    "Public Wi-Fi sites active",
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
    sectors = sb.select(f"sectors?select=id&slug=eq.{TECHNOLOGY_SLUG}")
    if not sectors:
        print("Technology sector not found")
        return 1
    technology_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{technology_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-technology-sector-dashboard-framework.py --apply first.")
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

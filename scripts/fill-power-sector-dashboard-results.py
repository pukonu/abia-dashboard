#!/usr/bin/env python3
"""Fill Power Sector Dashboard statewide results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jul 2026 monthly reporting):
  - Gov. Otti media chat (~Mar 2026) — Geometric 141 MW (3 turbines); 125 MW
    GE turbine identified in Netherlands → 266 MW target; 8 LGAs in Aba
    ring-fence detached from national grid; remaining ~8 still on grid;
    ~15 MW ABSU IPP planned; Umuahia environs need ~100 MW
    (THISDAY / Arise / The Source)
  - Afreximbank commissioning note — 141 MW Aba IPP; ring-fence designed for
    nine LGAs (used only as context; LGA count follows Otti “detached” figure)

Usage:
  python3 scripts/fill-power-sector-dashboard-results.py          # dry run
  python3 scripts/fill-power-sector-dashboard-results.py --apply
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

POWER_SLUG = "power"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jul 2026"
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    "Geometric installed capacity": (
        141,
        None,
        "Gov. Alex Otti media chat (~Mar 2026): Geometric Power, Aba currently "
        "has 141 MW installed capacity from three turbines (THISDAY / Arise / "
        "The Source). Matches Afreximbank-backed Aba IPP commissioning figure. "
        "Target: State Plan 266 MW after planned 125 MW addition.",
    ),
    "Geometric turbines online": (
        3,
        None,
        "Same briefing: Geometric operates three turbines generating 141 MW. "
        "Target: State Plan 4 turbines after the additional GE unit is installed.",
    ),
    "LGAs on independent / ring-fenced power": (
        8,
        None,
        "Gov. Otti (~Mar 2026): eight local governments in the Aba ring-fence "
        "area have detached from the national grid with Geometric Power "
        "operation (THISDAY / Arise). Afreximbank notes the ring-fence was "
        "designed around nine LGAs — dashboard uses the governor’s published "
        "“detached” count. Target: State Plan 17.",
    ),
    "LGAs still on national grid": (
        9,
        None,
        "Derived from Abia’s 17 LGAs minus the eight Otti reported as detached "
        "from the national grid (~Mar 2026). State is concentrating on "
        "independent power for the remaining LGAs. Target: State Plan 0.",
    ),
    "Additional turbine capacity identified": (
        125,
        None,
        "Commissioner for Power Monday Ikechukwu / Gov. Otti: a General "
        "Electric-built 125 MW gas turbine in the Netherlands identified for "
        "Geometric to acquire — would raise plant capacity to 266 MW "
        "(THISDAY / Arise / The Source). Pipeline figure, not yet installed. "
        "Target: State Plan 125.",
    ),
    "Planned ABSU independent power capacity": (
        15,
        None,
        "Gov. Otti media chat: about 15 MW independent power (gas turbines) "
        "planned; Abia State University (Uturu) may detach from the national "
        "grid when complete (THISDAY / Arise). Target: State Plan 15.",
    ),
    "Umuahia area power demand": (
        100,
        None,
        "Gov. Otti: Umuahia and environs require about 100 MW — the planned "
        "Geometric expansion is intended to extend independent supply there "
        "(THISDAY / Arise).",
    ),
}

LEFT_BLANK = [
    "Geometric daily generation output",  # no published steady-state MW/day for Jul 2026
    "Average daily supply hours",  # 24h aspirational; no audited Abia average published
    "Gas supply availability",  # disruptions reported anecdotally; no monthly %
    "Feeder uptime",
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
    sectors = sb.select(f"sectors?select=id&slug=eq.{POWER_SLUG}")
    if not sectors:
        print("Power sector not found")
        return 1
    power_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{power_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-power-sector-dashboard-framework.py --apply first.")
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

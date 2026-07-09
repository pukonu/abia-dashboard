#!/usr/bin/env python3
"""Fill Security Sector Dashboard statewide results from published sources only.

Only indicators with a clear, attributable public figure are written. Everything
else is left blank (and any previously written illustrative values for this
thematic/period are cleared on --apply).

Published sources reviewed (pegged to Jun 2026 monthly reporting):
  - Abia CP Danladi Isa press briefings (Punch / TVC, 2025) — case investigation
    stock figure for Jan–Dec 2025 (latest published; used as Jun 2026 briefing value)
  - STER / Nigeria Galleria Abia police directories — named Area Commands
  - FRSC Abia statements — trend only, no state monthly fatality totals published
  - Gov. Otti vehicle donation (20 Hilux) — event, not a current fleet census

Usage:
  python3 scripts/fill-security-sector-dashboard-results.py          # dry run
  python3 scripts/fill-security-sector-dashboard-results.py --apply
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

SECURITY_SLUG = "security"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jun 2026"
# Also clear any earlier mistaken period so the dashboard does not show Jul leftovers.
CLEAR_PERIOD_LABELS = ("Jun 2026", "Jul 2026")

# name → (abia_value, nigeria_value|None, notes)
# Keep this list short. Prefer empty over guesswork.
FILLS: dict[str, tuple[float, float | None, str]] = {
    "Cases under investigation": (
        237,
        None,
        "Abia State Police Command CP Danladi Isa briefing (Jan–Dec 2025): "
        "237 cases still under investigation out of 438 reported cases. "
        "Source: TVC News / CP press briefing. Pegged to Jun 2026 monthly reporting "
        "as the latest published stock figure — no newer monthly update found.",
    ),
    "Area commands": (
        6,
        None,
        "Counted from published Abia police directories listing named Area Commands: "
        "Umuahia, Aba, Ohafia, Isuikwuato, Isiala Ngwa (Isialangwa), and Akwete. "
        "Sources: STER police-stations directory; Nigeria Galleria Abia police stations list. "
        "Pegged to Jun 2026 monthly reporting.",
    ),
}

# Explicitly left blank — no reliable Abia figure found for the indicator as defined.
LEFT_BLANK = [
    "Violent crime incidents",
    "Kidnapping cases",
    "Armed robbery incidents",
    "Cult-related incidents",
    "Average response time",
    "Cases charged to court this month",  # CP reported 201 charged in 2025 annual total — not monthly
    "Vigilante/neighbourhood watch coverage",
    "Planned patrols completed",
    "Community security meetings held",
    "Tip-offs acted on within 24 hours",
    "Active community watch groups",
    "Police stations / divisions",  # directories exist but mix stations/posts/HQ; no official census
    "Civil Defence units",
    "Security personnel deployed",
    "LGAs with 24-hour security presence",
    "Emergency readiness score",
    "Functional emergency vehicles",  # Otti donated 20 Hilux — not a full fleet count
    "Joint security operations this month",
    "Emergency calls received this month",
    "Emergency calls resolved within SLA",
    "Critical assets under protection",
    "Asset protection coverage",
    "Asset-related incidents this month",
    "Road traffic deaths",  # FRSC says decline vs 2024 but published no Abia monthly/annual total
    "Road traffic injuries",
    "FRSC / traffic enforcement stops",
    "Road checkpoints active",
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
        print("\nDry run only. Re-run with --apply to clear illustrative values and write sourced results.")
        return 0

    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing Supabase env")
        return 1

    sb = Supabase(url, key)
    sectors = sb.select(f"sectors?select=id&slug=eq.{SECURITY_SLUG}")
    if not sectors:
        print("Security sector not found")
        return 1
    security_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{security_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        print("Run seed-security-sector-dashboard-framework.py --apply first.")
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

    # Clear statewide results for Sector Dashboard indicators across Jun (and any
    # earlier Jul leftovers) so illustrative / misplaced values do not linger.
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

    if not rows:
        print("No sourced fills to write.")
        return 0

    created = sb._call("POST", "results", rows, prefer="return=representation")
    print(f"\nWrote {len(created)} sourced statewide results for {PERIOD_LABEL}.")
    for r, name in zip(created, FILLS.keys()):
        print(f"  {name}: {r['abia_value']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

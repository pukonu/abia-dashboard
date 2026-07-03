#!/usr/bin/env python3
"""Split Health into statewide vs PHC thematic areas.

This script:
1. Renames the existing statewide Health thematic area to
   "Primary Healthcare (Statewide)"
2. Creates or updates a separate PHC facility thematic area:
   "Primary Healthcare Facilities (PHCs)"
3. Reassigns domains that contain entity-level indicators to the PHC thematic area
4. Reassigns domains without entity-level indicators to the statewide thematic area

Safe to re-run.
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

HEALTH_SECTOR_SLUG = "health"
STATEWIDE_ID = "b92bd03f-9f06-465b-bf8b-64cfb1ecedf7"
STATEWIDE_NAME = "Primary Healthcare (Statewide)"
STATEWIDE_DESC = (
    "Statewide PHC system performance, outcomes and policy indicators measured at state level."
)
PHC_NAME = "Primary Healthcare Facilities (PHCs)"
PHC_DESC = (
    "Facility-level PHC readiness, service delivery, quality, reporting and accountability indicators."
)


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"')
    return env


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
            with urllib.request.urlopen(req, context=self.ctx) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"{method} {path} -> {err.code}: {err.read().decode()}") from err

    def select(self, path: str):
        return self._call("GET", path)

    def upsert(self, table: str, rows: list[dict], on_conflict: str):
        return self._call(
            "POST",
            f"{table}?on_conflict={on_conflict}",
            rows,
            prefer="return=representation,resolution=merge-duplicates",
        )

    def patch(self, table: str, filters: str, row: dict):
        return self._call("PATCH", f"{table}?{filters}", row, prefer="return=representation")


def main() -> int:
    apply = "--apply" in sys.argv[1:]
    env = load_env()
    sb = Supabase(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    sector = sb.select(
        f"sectors?select=id,name,slug&slug=eq.{urllib.parse.quote(HEALTH_SECTOR_SLUG)}"
    )[0]
    health_sector_id = sector["id"]

    # Keep the known existing TA id as the statewide TA.
    statewide_ta = sb.patch(
        "thematic_areas",
        f"id=eq.{STATEWIDE_ID}",
        {
            "name": STATEWIDE_NAME,
            "description": STATEWIDE_DESC,
            "frequency": "quarterly",
            "sector_id": health_sector_id,
        },
    )[0]

    phc_ta = sb.upsert(
        "thematic_areas",
        [
            {
                "sector_id": health_sector_id,
                "name": PHC_NAME,
                "description": PHC_DESC,
                "frequency": "quarterly",
                "weight": 1,
            }
        ],
        on_conflict="sector_id,name",
    )[0]

    thematics = sb.select(
        f"thematic_areas?select=id,name&sector_id=eq.{health_sector_id}&order=name"
    )
    thematic_ids = ",".join(t["id"] for t in thematics)
    domains = sb.select(
        f"domains?select=id,name,thematic_area_id&thematic_area_id=in.({thematic_ids})&order=name"
    )

    moved_to_state = []
    moved_to_phc = []
    for domain in domains:
        indicators = sb.select(
            f"indicators?select=id,indicator_scope&domain_id=eq.{domain['id']}"
        )
        has_entity = any(ind["indicator_scope"] == "entity" for ind in indicators)
        target_ta_id = phc_ta["id"] if has_entity else statewide_ta["id"]
        if domain["thematic_area_id"] == target_ta_id:
            continue
        if apply:
            sb.patch(
                "domains",
                f"id=eq.{domain['id']}",
                {"thematic_area_id": target_ta_id},
            )
        (moved_to_phc if has_entity else moved_to_state).append(domain["name"])

    print("Health sector:", sector["name"], health_sector_id)
    print("Statewide TA:", statewide_ta["id"], statewide_ta["name"])
    print("PHC TA:", phc_ta["id"], phc_ta["name"])
    print()
    print("Move to statewide:", len(moved_to_state))
    for name in moved_to_state:
        print("  -", name)
    print("Move to PHC facilities:", len(moved_to_phc))
    for name in moved_to_phc:
        print("  -", name)
    if not apply:
        print("\nDry run only. Re-run with --apply to write changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

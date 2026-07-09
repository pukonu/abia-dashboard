#!/usr/bin/env python3
"""Insert demo sectors that are missing from the live database.

Creates sector rows only (no MDAs, thematic areas, indicators, or dashboards),
so clicking a sector in live mode shows the empty "No dashboard built yet" state.

Skips health, education, and security by default (already present in live).

Usage:
  python3 scripts/seed-missing-demo-sectors.py          # dry run
  python3 scripts/seed-missing-demo-sectors.py --apply
"""

from __future__ import annotations

import json
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Mirror SECTOR_SPECS in src/lib/demo-data.ts (excluding health/education/security).
SECTORS: list[dict] = [
    {
        "slug": "agriculture",
        "name": "Agriculture",
        "description": "Food production, farmer support and agribusiness value chains.",
        "icon": "🌾",
        "color": "#16a34a",
        "sort_order": 3,
    },
    {
        "slug": "infrastructure",
        "name": "Infrastructure",
        "description": "Roads, transport, water supply and power across the state.",
        "icon": "🏗️",
        "color": "#ea580c",
        "sort_order": 4,
    },
    {
        "slug": "power",
        "name": "Power",
        "description": "Electricity generation, distribution reliability, gas supply and outage response.",
        "icon": "⚡",
        "color": "#f59e0b",
        "sort_order": 5,
    },
    {
        "slug": "economy",
        "name": "Economy & Trade",
        "description": "Internally generated revenue, investment, markets and SME growth.",
        "icon": "💼",
        "color": "#0d9488",
        "sort_order": 6,
    },
    {
        "slug": "women-affairs",
        "name": "Women Affairs",
        "description": "Women empowerment, child protection, gender inclusion and social welfare.",
        "icon": "👩🏾‍🤝‍👩🏾",
        "color": "#be185d",
        "sort_order": 7,
    },
    {
        "slug": "environment",
        "name": "Environment",
        "description": "Waste management, drainage, flood control, erosion response and urban sanitation.",
        "icon": "🌿",
        "color": "#16a34a",
        "sort_order": 8,
    },
    {
        "slug": "technology",
        "name": "Technology",
        "description": "Digital government, broadband access, startup support and public-sector innovation.",
        "icon": "💻",
        "color": "#7c3aed",
        "sort_order": 9,
    },
    {
        "slug": "administration",
        "name": "Administration & Governance",
        "description": "Executive coordination, service delivery, procurement, citizen feedback and public-sector performance.",
        "icon": "🏛️",
        "color": "#475569",
        "sort_order": 10,
    },
]


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
            with urllib.request.urlopen(req, context=self.ctx, timeout=60) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"{method} {path} -> {err.code}: {err.read().decode()}") from err

    def select(self, path: str):
        return self._call("GET", path)

    def insert(self, table: str, rows: list[dict]):
        return self._call("POST", table, rows, prefer="return=representation")


def main() -> int:
    apply = "--apply" in sys.argv
    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        return 1

    sb = Supabase(url, key)
    existing = sb.select("sectors?select=id,slug,name,sort_order&order=sort_order")
    existing_slugs = {row["slug"] for row in (existing or [])}

    print("Existing live sectors:")
    for row in existing or []:
        print(f"  [{row['sort_order']}] {row['slug']} — {row['name']}")

    to_create = [s for s in SECTORS if s["slug"] not in existing_slugs]
    already = [s for s in SECTORS if s["slug"] in existing_slugs]

    if already:
        print(f"\nAlready present ({len(already)}):")
        for s in already:
            print(f"  - {s['slug']}")

    if not to_create:
        print("\nNothing to insert — all demo sectors (except health/education/security) already exist.")
        return 0

    print(f"\nWill insert {len(to_create)} empty sector(s):")
    for s in to_create:
        print(f"  [{s['sort_order']}] {s['slug']} — {s['name']}")

    if not apply:
        print("\nDry run only. Re-run with --apply to insert.")
        return 0

    created = sb.insert("sectors", to_create)
    print(f"\nInserted {len(created or [])} sector(s):")
    for row in created or []:
        print(f"  {row['id']}  {row['slug']} — {row['name']}")

    final = sb.select("sectors?select=slug,name,sort_order&order=sort_order")
    print(f"\nLive sectors now ({len(final or [])}):")
    for row in final or []:
        print(f"  [{row['sort_order']}] {row['slug']} — {row['name']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

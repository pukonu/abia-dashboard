#!/usr/bin/env python3
"""Create the Infrastructure "Sector Dashboard" thematic framework + executive dashboard.

Adds a monthly, statewide thematic area under Infrastructure with executive-facing
domains/indicators (road delivery, urban transport, network condition, water access).
Values are left empty for the companion fill script.

Usage:
  python3 scripts/seed-infrastructure-sector-dashboard-framework.py          # dry run
  python3 scripts/seed-infrastructure-sector-dashboard-framework.py --apply
  python3 scripts/seed-infrastructure-sector-dashboard-framework.py --apply --replace
"""

from __future__ import annotations

import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def q(value: str) -> str:
    return urllib.parse.quote(value, safe="")


ROOT = Path(__file__).resolve().parents[1]

INFRASTRUCTURE_SLUG = "infrastructure"
THEMATIC_NAME = "Sector Dashboard"
THEMATIC_DESCRIPTION = (
    "Monthly executive infrastructure indicators for the sector dashboard — "
    "road delivery, urban transport, network condition and water access."
)
DASHBOARD_NAME = "Infrastructure Executive Dashboard"
DASHBOARD_DESCRIPTION = (
    "Simple executive Infrastructure view from the Sector Dashboard thematic area — "
    "road delivery, mass transit, and priority coverage scores."
)

DOMAINS: list[dict] = [
    {
        "name": "Road Delivery",
        "description": "Completed and ongoing state road projects and kilometre delivery.",
        "indicators": [
            {
                "name": "Completed road projects",
                "unit": "projects",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Completed road length",
                "unit": "km",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Road projects under construction",
                "unit": "projects",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Road length under construction",
                "unit": "km",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Projects on schedule",
                "unit": "%",
                "direction": "higher_is_better",
                "value_type": "percentage",
                "target": 90,
                "target_source": "State Plan",
            },
        ],
    },
    {
        "name": "Urban Transport",
        "description": "Green Shuttle mass transit, bus shelters and multi-modal terminals.",
        "indicators": [
            {
                "name": "Green Shuttle passengers",
                "unit": "passengers",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Bus shelters delivered",
                "unit": "shelters",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 70,
                "target_source": "State Plan",
            },
            {
                "name": "Operational bus shelters",
                "unit": "shelters",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 70,
                "target_source": "State Plan",
            },
            {
                "name": "Multi-modal terminals completed",
                "unit": "terminals",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 2,
                "target_source": "State Plan",
            },
        ],
    },
    {
        "name": "Network Condition",
        "description": "Condition of the state road network and street lighting.",
        "indicators": [
            {
                "name": "State roads in good condition",
                "unit": "%",
                "direction": "higher_is_better",
                "value_type": "percentage",
                "target": 80,
                "target_source": "State Plan",
            },
            {
                "name": "Major corridors with street lighting",
                "unit": "%",
                "direction": "higher_is_better",
                "value_type": "percentage",
                "target": 100,
                "target_source": "State Plan",
            },
        ],
    },
    {
        "name": "Water Access",
        "description": "Safe water access for households and communities.",
        "indicators": [
            {
                "name": "Population with safe water access",
                "unit": "%",
                "direction": "higher_is_better",
                "value_type": "percentage",
                "target": 90,
                "target_source": "SDG 6",
            },
        ],
    },
]

INDICATOR_BRIEFINGS: dict[str, str] = {
    "Completed road projects": "Cumulative road projects completed under the current administration.",
    "Completed road length": "Total kilometres of roads completed (with street lights and drainage where reported).",
    "Road projects under construction": "Road projects currently under construction at various stages.",
    "Road length under construction": "Kilometres of road currently under construction.",
    "Projects on schedule": "Share of active road projects progressing on the approved schedule.",
    "Green Shuttle passengers": "Cumulative passengers carried by the Abia Green Shuttle mass-transit service.",
    "Bus shelters delivered": "Bus shelters built for Green Shuttle / urban transit (Umuahia and Aba).",
    "Operational bus shelters": "Bus shelters already open for passenger use.",
    "Multi-modal terminals completed": "Completed multi-modal transport terminals (Umuahia; Aba terminal in progress).",
    "State roads in good condition": "Share of the state road network assessed as good / motorable.",
    "Major corridors with street lighting": "Share of priority urban/highway corridors with functional street lighting.",
    "Population with safe water access": "Share of the population with access to safely managed drinking water (SDG 6).",
}

WIDGETS = [
    {
        "chart_type": "stat",
        "title": "Executive briefing — road delivery",
        "indicator_names": [
            "Completed road projects",
            "Completed road length",
            "Road projects under construction",
            "Road length under construction",
        ],
        "span": 2,
        "position": 0,
    },
    {
        "chart_type": "stat",
        "title": "Executive briefing — urban transport",
        "indicator_names": [
            "Green Shuttle passengers",
            "Bus shelters delivered",
            "Operational bus shelters",
            "Multi-modal terminals completed",
        ],
        "span": 2,
        "position": 1,
    },
    {
        "chart_type": "bar",
        "title": "Priority coverage scores",
        "indicator_names": [
            "Bus shelters delivered",
            "Operational bus shelters",
            "Multi-modal terminals completed",
        ],
        "span": 2,
        "position": 2,
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
            with urllib.request.urlopen(req, context=self.ctx, timeout=120) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"{method} {path} -> {err.code}: {err.read().decode()}") from err

    def select(self, path: str):
        return self._call("GET", path)

    def insert(self, table: str, rows: list[dict]):
        return self._call("POST", table, rows, prefer="return=representation")

    def upsert(self, table: str, rows: list[dict], on_conflict: str):
        return self._call(
            "POST",
            f"{table}?on_conflict={on_conflict}",
            rows,
            prefer="return=representation,resolution=merge-duplicates",
        )

    def update(self, table: str, filters: str, row: dict):
        return self._call("PATCH", f"{table}?{filters}", row, prefer="return=representation")

    def delete(self, path: str):
        return self._call("DELETE", path, prefer="return=representation")


def indicator_row(domain_id: str, spec: dict) -> dict:
    return {
        "domain_id": domain_id,
        "name": spec["name"],
        "description": INDICATOR_BRIEFINGS.get(spec["name"]) or spec.get("description"),
        "indicator_scope": "state",
        "value_type": spec["value_type"],
        "unit": spec["unit"],
        "direction": spec["direction"],
        "weight": 1,
        "target_value": spec.get("target"),
        "target_source": spec.get("target_source"),
        "frequency": "monthly",
        "is_published": True,
    }


def print_plan() -> int:
    total = sum(len(d["indicators"]) for d in DOMAINS)
    print(f"Thematic area: {THEMATIC_NAME} (monthly)")
    print(f"Domains: {len(DOMAINS)} | Indicators: {total}")
    for d in DOMAINS:
        print(f"\n  {d['name']} ({len(d['indicators'])})")
        for ind in d["indicators"]:
            tgt = ind.get("target")
            tgt_s = f" target={tgt}" if tgt is not None else ""
            print(f"    - {ind['name']} [{ind['unit']}, {ind['direction']}]{tgt_s}")
    print(f"\nDashboard: {DASHBOARD_NAME} ({len(WIDGETS)} widgets)")
    for w in WIDGETS:
        print(f"  [{w['chart_type']}] {w['title']} → {len(w['indicator_names'])} inds")
    return total


def ensure_framework(sb: Supabase, sector_id: str, replace: bool) -> tuple[dict, dict[str, str]]:
    existing = sb.select(
        f"thematic_areas?select=id,name&sector_id=eq.{sector_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if existing and replace:
        print(f"  deleting existing thematic area {THEMATIC_NAME} ({existing[0]['id']})")
        sb.delete(f"thematic_areas?id=eq.{existing[0]['id']}")
        existing = []

    if existing:
        thematic = existing[0]
        print(f"  using existing thematic area {thematic['id']}")
        sb.upsert(
            "thematic_areas",
            [
                {
                    "id": thematic["id"],
                    "sector_id": sector_id,
                    "name": THEMATIC_NAME,
                    "description": THEMATIC_DESCRIPTION,
                    "frequency": "monthly",
                    "weight": 1,
                    "is_sector_dashboard": True,
                }
            ],
            "id",
        )
    else:
        rows = sb.insert(
            "thematic_areas",
            [
                {
                    "sector_id": sector_id,
                    "name": THEMATIC_NAME,
                    "description": THEMATIC_DESCRIPTION,
                    "frequency": "monthly",
                    "weight": 1,
                    "is_sector_dashboard": True,
                }
            ],
        )
        thematic = rows[0]
        print(f"  + thematic area {THEMATIC_NAME} ({thematic['id']})")

    name_to_id: dict[str, str] = {}
    for dspec in DOMAINS:
        domains = sb.select(
            f"domains?select=id,name&thematic_area_id=eq.{thematic['id']}&name=eq.{q(dspec['name'])}"
        )
        if domains:
            domain = domains[0]
            print(f"  · domain exists: {domain['name']}")
        else:
            created = sb.insert(
                "domains",
                [
                    {
                        "thematic_area_id": thematic["id"],
                        "name": dspec["name"],
                        "description": dspec["description"],
                        "weight": 1,
                        "is_published": True,
                    }
                ],
            )
            domain = created[0]
            print(f"  + domain: {domain['name']} ({domain['id']})")

        for ispec in dspec["indicators"]:
            found = sb.select(
                "indicators?select=id,name"
                f"&domain_id=eq.{domain['id']}&name=eq.{q(ispec['name'])}&indicator_scope=eq.state"
            )
            if found:
                ind = found[0]
                sb.upsert(
                    "indicators",
                    [{**indicator_row(domain["id"], ispec), "id": ind["id"]}],
                    "id",
                )
                name_to_id[ispec["name"]] = ind["id"]
            else:
                created = sb.insert("indicators", [indicator_row(domain["id"], ispec)])
                ind = created[0]
                name_to_id[ispec["name"]] = ind["id"]
                print(f"      + {ispec['name']}")

        all_inds = sb.select(
            f"indicators?select=id,name&domain_id=eq.{domain['id']}&indicator_scope=eq.state&limit=200"
        )
        for ind in all_inds:
            name_to_id[ind["name"]] = ind["id"]

    return thematic, name_to_id


def ensure_dashboard(sb: Supabase, sector_id: str, name_to_id: dict[str, str], replace: bool) -> None:
    missing = []
    for w in WIDGETS:
        for n in w["indicator_names"]:
            if n not in name_to_id:
                missing.append(n)
    if missing:
        raise RuntimeError(f"Widget indicators not found: {missing}")

    existing = sb.select(
        f"dashboards?select=id,name&sector_id=eq.{sector_id}&name=eq.{q(DASHBOARD_NAME)}"
    )
    if existing and replace:
        print(f"  deleting dashboard {DASHBOARD_NAME} ({existing[0]['id']})")
        sb.delete(f"dashboards?id=eq.{existing[0]['id']}")
        existing = []
    if existing:
        dash = existing[0]
        print(f"  dashboard already exists: {dash['id']} (recreating widgets)")
        sb.delete(f"dashboard_widgets?dashboard_id=eq.{dash['id']}")
        dash_id = dash["id"]
        sb.update(
            "dashboards",
            f"id=eq.{dash_id}",
            {
                "name": DASHBOARD_NAME,
                "description": DASHBOARD_DESCRIPTION,
                "published": True,
                "sort_order": 0,
            },
        )
    else:
        others = sb.select(f"dashboards?select=id,sort_order&sector_id=eq.{sector_id}")
        for d in others or []:
            sb.update(
                "dashboards",
                f"id=eq.{d['id']}",
                {"sort_order": int(d.get("sort_order") or 0) + 1},
            )
        created = sb.insert(
            "dashboards",
            [
                {
                    "name": DASHBOARD_NAME,
                    "description": DASHBOARD_DESCRIPTION,
                    "scope": "sector",
                    "sector_id": sector_id,
                    "published": True,
                    "sort_order": 0,
                }
            ],
        )
        dash_id = created[0]["id"]
        print(f"  + dashboard {DASHBOARD_NAME} ({dash_id})")

    widgets = []
    for w in WIDGETS:
        widgets.append(
            {
                "dashboard_id": dash_id,
                "chart_type": w["chart_type"],
                "title": w["title"],
                "indicator_ids": [name_to_id[n] for n in w["indicator_names"]],
                "span": w["span"],
                "show_change": False,
                "position": w["position"],
            }
        )
    created_w = sb.insert("dashboard_widgets", widgets)
    for w in created_w:
        print(f"      widget [{w['chart_type']}] {w.get('title')} ({len(w['indicator_ids'])} inds)")


def main() -> int:
    apply_flag = "--apply" in sys.argv
    replace = "--replace" in sys.argv

    print_plan()
    if not apply_flag:
        print("\nDry run only. Re-run with --apply to write (add --replace to recreate thematic/dashboard).")
        return 0

    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        return 1

    sb = Supabase(url, key)
    sectors = sb.select(f"sectors?select=id,name,slug&slug=eq.{INFRASTRUCTURE_SLUG}")
    if not sectors:
        print("Infrastructure sector not found")
        return 1
    sector = sectors[0]
    print(f"\nApplying to Infrastructure ({sector['id']})…\n")

    _, name_to_id = ensure_framework(sb, sector["id"], replace=replace)
    print(f"\nResolved {len(name_to_id)} indicators in {THEMATIC_NAME}")
    print("\nCreating executive dashboard…")
    ensure_dashboard(sb, sector["id"], name_to_id, replace=replace)

    print("\nDone. Open /sectors/infrastructure in Live mode.")
    print("Enter monthly results via fill-infrastructure-sector-dashboard-results.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Create the Agriculture "Sector Dashboard" thematic framework + executive dashboard.

Adds a monthly, statewide thematic area under Agriculture with executive-facing
domains/indicators (farmer support, crop production, agribusiness investment,
extension & data). Values are left empty for the companion fill script.

Usage:
  python3 scripts/seed-agriculture-sector-dashboard-framework.py          # dry run
  python3 scripts/seed-agriculture-sector-dashboard-framework.py --apply
  python3 scripts/seed-agriculture-sector-dashboard-framework.py --apply --replace
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

AGRICULTURE_SLUG = "agriculture"
THEMATIC_NAME = "Sector Dashboard"
THEMATIC_DESCRIPTION = (
    "Monthly executive agriculture indicators for the sector dashboard — "
    "farmer support, crop production, agribusiness investment, and extension data systems."
)
DASHBOARD_NAME = "Agriculture Executive Dashboard"
DASHBOARD_DESCRIPTION = (
    "Simple executive Agriculture view from the Sector Dashboard thematic area — "
    "farmer support, commercial investment, and priority coverage scores."
)

DOMAINS: list[dict] = [
    {
        "name": "Farmer Support",
        "description": "Verified farmers, input distribution and geographic coverage.",
        "indicators": [
            {
                "name": "Verified farmers on state database",
                "unit": "farmers",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Farmers receiving improved inputs this season",
                "unit": "farmers",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 18634,
                "target_source": "State Plan",
            },
            {
                "name": "Farmers receiving inputs at flag-off",
                "unit": "farmers",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "LGAs covered by input programme",
                "unit": "LGAs",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 17,
                "target_source": "State Plan",
            },
            {
                "name": "Priority crop varieties supported",
                "unit": "crops",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 7,
                "target_source": "State Plan",
            },
        ],
    },
    {
        "name": "Crop Production",
        "description": "Yields for priority staple and cash crops.",
        "indicators": [
            {
                "name": "Cassava yield",
                "unit": "t/ha",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 20,
                "target_source": "State Plan",
            },
            {
                "name": "Rice paddy yield",
                "unit": "t/ha",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 4,
                "target_source": "State Plan",
            },
            {
                "name": "Maize yield",
                "unit": "t/ha",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 3,
                "target_source": "State Plan",
            },
        ],
    },
    {
        "name": "Agribusiness & Investment",
        "description": "Commercial agriculture investment and job creation pipelines.",
        "indicators": [
            {
                "name": "Palm oil investment MoU",
                "unit": "USD million",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Palm plantation land identified",
                "unit": "hectares",
                "direction": "higher_is_better",
                "value_type": "number",
            },
            {
                "name": "Jobs targeted from palm oil investment",
                "unit": "jobs",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 5000,
                "target_source": "State Plan",
            },
            {
                "name": "Post-harvest losses",
                "unit": "%",
                "direction": "lower_is_better",
                "value_type": "percentage",
                "target": 15,
                "target_source": "FAO/SDG 12.3",
            },
        ],
    },
    {
        "name": "Extension & Data Systems",
        "description": "Farmer registration coverage and extension reach.",
        "indicators": [
            {
                "name": "Wards mapped in farmer registration",
                "unit": "wards",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 184,
                "target_source": "State Plan",
            },
            {
                "name": "Extension visits per farm cluster",
                "unit": "visits/month",
                "direction": "higher_is_better",
                "value_type": "number",
                "target": 4,
                "target_source": "FAO",
            },
            {
                "name": "Farmers with geo-referenced farmland",
                "unit": "%",
                "direction": "higher_is_better",
                "value_type": "percentage",
                "target": 100,
                "target_source": "State Plan",
            },
        ],
    },
]

INDICATOR_BRIEFINGS: dict[str, str] = {
    "Verified farmers on state database": "Farmers registered and verified on the Abia Agricultural Dynamic Database System (ADDS).",
    "Farmers receiving improved inputs this season": "Verified farmers scheduled to receive free improved seeds, seedlings and fertiliser this season.",
    "Farmers receiving inputs at flag-off": "Farmers who collected inputs at the state flag-off ceremony.",
    "LGAs covered by input programme": "Local governments included in statewide input distribution.",
    "Priority crop varieties supported": "Crop types covered by the input package (cassava, rice, maize, plantain, etc.).",
    "Cassava yield": "Average cassava yield on supported farms.",
    "Rice paddy yield": "Average rice paddy yield on supported farms.",
    "Maize yield": "Average maize yield on supported farms.",
    "Palm oil investment MoU": "Committed private investment under the palm oil MoU.",
    "Palm plantation land identified": "Hectares identified for large-scale palm plantation development.",
    "Jobs targeted from palm oil investment": "Direct and indirect jobs targeted from the palm oil investment.",
    "Post-harvest losses": "Share of produce lost after harvest — SDG 12.3 priority.",
    "Wards mapped in farmer registration": "Political wards covered during farmer registration / ADDS rollout.",
    "Extension visits per farm cluster": "Average extension visits reaching farm clusters.",
    "Farmers with geo-referenced farmland": "Share of supported farmers mapped to identifiable farmland.",
}

WIDGETS = [
    {
        "chart_type": "stat",
        "title": "Executive briefing — farmer support",
        "indicator_names": [
            "Verified farmers on state database",
            "Farmers receiving improved inputs this season",
            "Farmers receiving inputs at flag-off",
            "LGAs covered by input programme",
        ],
        "span": 2,
        "position": 0,
    },
    {
        "chart_type": "stat",
        "title": "Executive briefing — commercial agriculture",
        "indicator_names": [
            "Palm oil investment MoU",
            "Palm plantation land identified",
            "Jobs targeted from palm oil investment",
            "Priority crop varieties supported",
        ],
        "span": 2,
        "position": 1,
    },
    {
        "chart_type": "bar",
        "title": "Priority coverage scores",
        "indicator_names": [
            "Farmers receiving improved inputs this season",
            "LGAs covered by input programme",
            "Wards mapped in farmer registration",
            "Jobs targeted from palm oil investment",
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
    sectors = sb.select(f"sectors?select=id,name,slug&slug=eq.{AGRICULTURE_SLUG}")
    if not sectors:
        print("Agriculture sector not found")
        return 1
    sector = sectors[0]
    print(f"\nApplying to Agriculture ({sector['id']})…\n")

    _, name_to_id = ensure_framework(sb, sector["id"], replace=replace)
    print(f"\nResolved {len(name_to_id)} indicators in {THEMATIC_NAME}")
    print("\nCreating executive dashboard…")
    ensure_dashboard(sb, sector["id"], name_to_id, replace=replace)

    print("\nDone. Open /sectors/agriculture in Live mode.")
    print("Enter monthly results via fill-agriculture-sector-dashboard-results.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

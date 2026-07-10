#!/usr/bin/env python3
"""Create the Security "Sector Dashboard" thematic framework + executive dashboard.

Adds a monthly, statewide thematic area under Security with executive-facing
domains/indicators (crime, community policing, emergency response, assets,
road safety). Values are left empty for manual entry or the fill script.
Also creates a published sector dashboard whose widgets pull from this thematic.

Does not modify the existing Public Safety / Emergency Preparedness thematic areas.

Usage:
  python3 scripts/seed-security-sector-dashboard-framework.py          # dry run
  python3 scripts/seed-security-sector-dashboard-framework.py --apply
  python3 scripts/seed-security-sector-dashboard-framework.py --apply --replace
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
    """Percent-encode a PostgREST filter value (spaces, en-dashes, etc.)."""
    return urllib.parse.quote(value, safe="")


ROOT = Path(__file__).resolve().parents[1]

SECURITY_SLUG = "security"
THEMATIC_NAME = "Sector Dashboard"
THEMATIC_DESCRIPTION = (
    "Monthly executive security indicators for the sector dashboard — "
    "crime reduction, community policing, emergency response, critical assets and road safety."
)
DASHBOARD_NAME = "Security Executive Dashboard"
DASHBOARD_DESCRIPTION = (
    "Simple executive Security view from the Sector Dashboard thematic area — "
    "briefing numbers, incident mix, and priority coverage scores."
)

DOMAINS: list[dict] = [
    {
        "name": "Crime Reduction",
        "description": "Weekly/monthly crime volume and response performance.",
        "indicators": [
            {"name": "Violent crime incidents", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 40, "target_source": "State Plan"},
            {"name": "Kidnapping cases", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 2, "target_source": "State Plan"},
            {"name": "Armed robbery incidents", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 15, "target_source": "State Plan"},
            {"name": "Cult-related incidents", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 5, "target_source": "State Plan"},
            {"name": "Average response time", "unit": "minutes", "direction": "lower_is_better", "value_type": "number", "target": 15, "target_source": "State Plan"},
            {"name": "Cases under investigation", "unit": "cases", "direction": "lower_is_better", "value_type": "number"},
            {"name": "Cases charged to court this month", "unit": "cases", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "Community Policing",
        "description": "Patrol tempo, vigilante coverage and community intelligence.",
        "indicators": [
            {"name": "Vigilante/neighbourhood watch coverage", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "State Plan"},
            {"name": "Planned patrols completed", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
            {"name": "Community security meetings held", "unit": "meetings", "direction": "higher_is_better", "value_type": "number", "target": 120, "target_source": "State Plan"},
            {"name": "Tip-offs acted on within 24 hours", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 85, "target_source": "State Plan"},
            {"name": "Active community watch groups", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "Security Network",
        "description": "Size and disposition of the state security footprint.",
        "indicators": [
            {"name": "Police stations / divisions", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Area commands", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Civil Defence units", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Security personnel deployed", "unit": "persons", "direction": "higher_is_better", "value_type": "number"},
            {"name": "LGAs with 24-hour security presence", "unit": "count", "direction": "higher_is_better", "value_type": "number", "target": 17, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Emergency Response",
        "description": "Vehicles, joint operations and emergency readiness.",
        "indicators": [
            {"name": "Emergency readiness score", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 85, "target_source": "State Plan"},
            {"name": "Functional emergency vehicles", "unit": "count", "direction": "higher_is_better", "value_type": "number", "target": 40, "target_source": "State Plan"},
            {"name": "Joint security operations this month", "unit": "operations", "direction": "higher_is_better", "value_type": "number", "target": 12, "target_source": "State Plan"},
            {"name": "Emergency calls received this month", "unit": "calls", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Emergency calls resolved within SLA", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Critical Asset Protection",
        "description": "Protection of government, economic and community assets.",
        "indicators": [
            {"name": "Critical assets under protection", "unit": "count", "direction": "higher_is_better", "value_type": "number", "target": 120, "target_source": "State Plan"},
            {"name": "Asset protection coverage", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
            {"name": "Asset-related incidents this month", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 0, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Road Safety",
        "description": "Traffic deaths, injuries and enforcement activity.",
        "indicators": [
            {"name": "Road traffic deaths", "unit": "deaths", "direction": "lower_is_better", "value_type": "number", "target": 5, "target_source": "SDG 3.6"},
            {"name": "Road traffic injuries", "unit": "injuries", "direction": "lower_is_better", "value_type": "number", "target": 40, "target_source": "State Plan"},
            {"name": "FRSC / traffic enforcement stops", "unit": "stops", "direction": "higher_is_better", "value_type": "number", "target": 800, "target_source": "State Plan"},
            {"name": "Road checkpoints active", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
]

INDICATOR_BRIEFINGS: dict[str, str] = {
    "Violent crime incidents": "Reported violent crime cases in the reporting period.",
    "Kidnapping cases": "Kidnapping incidents reported — keep near zero.",
    "Armed robbery incidents": "Armed robbery cases reported across the state.",
    "Cult-related incidents": "Cult / gang-related incidents requiring joint response.",
    "Average response time": "Mean time from alert to first security presence on scene.",
    "Vigilante/neighbourhood watch coverage": "Share of wards with active community watch structures.",
    "Planned patrols completed": "Share of scheduled patrols completed as planned.",
    "Tip-offs acted on within 24 hours": "Community tip-offs followed up within one day.",
    "Police stations / divisions": "Police service points and divisions in the state network.",
    "Area commands": "Major area commands coordinating multi-LGA operations.",
    "Civil Defence units": "NSCDC / civil-defence units supporting asset and community safety.",
    "Emergency readiness score": "Composite readiness across vehicles, protocols and joint ops.",
    "Functional emergency vehicles": "Serviceable vehicles available for emergency response.",
    "Joint security operations this month": "Coordinated multi-agency operations completed.",
    "Critical assets under protection": "Priority assets with active protection arrangements.",
    "Asset protection coverage": "Share of priority assets under protection.",
    "Road traffic deaths": "Road traffic fatalities in the reporting month.",
}

WIDGETS = [
    {
        "chart_type": "stat",
        "title": "Executive briefing — incidents & response",
        "indicator_names": [
            "Violent crime incidents",
            "Kidnapping cases",
            "Average response time",
            "Planned patrols completed",
        ],
        "span": 2,
        "position": 0,
    },
    {
        "chart_type": "stat",
        "title": "Executive briefing — network & readiness",
        "indicator_names": [
            "Police stations / divisions",
            "Civil Defence units",
            "Functional emergency vehicles",
            "Critical assets under protection",
        ],
        "span": 2,
        "position": 1,
    },
    {
        "chart_type": "pie",
        "title": "Incident mix this period",
        "indicator_names": [
            "Violent crime incidents",
            "Kidnapping cases",
            "Armed robbery incidents",
            "Cult-related incidents",
        ],
        "span": 1,
        "position": 2,
    },
    {
        "chart_type": "pie",
        "title": "Security network mix",
        "indicator_names": [
            "Police stations / divisions",
            "Area commands",
            "Civil Defence units",
        ],
        "span": 1,
        "position": 3,
    },
    {
        "chart_type": "bar",
        "title": "Priority coverage scores",
        "indicator_names": [
            "Vigilante/neighbourhood watch coverage",
            "Planned patrols completed",
            "Tip-offs acted on within 24 hours",
            "Emergency readiness score",
            "Asset protection coverage",
            "Emergency calls resolved within SLA",
        ],
        "span": 2,
        "position": 4,
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


def ensure_framework(sb: Supabase, security_id: str, replace: bool) -> tuple[dict, dict[str, str]]:
    existing = sb.select(
        f"thematic_areas?select=id,name&sector_id=eq.{security_id}&name=eq.{q(THEMATIC_NAME)}"
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
                    "sector_id": security_id,
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
                    "sector_id": security_id,
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


def ensure_dashboard(sb: Supabase, security_id: str, name_to_id: dict[str, str], replace: bool) -> None:
    missing = []
    for w in WIDGETS:
        for n in w["indicator_names"]:
            if n not in name_to_id:
                missing.append(n)
    if missing:
        raise RuntimeError(f"Widget indicators not found: {missing}")

    existing = sb.select(
        f"dashboards?select=id,name&sector_id=eq.{security_id}&name=eq.{q(DASHBOARD_NAME)}"
    )
    if existing and replace:
        print(f"  deleting dashboard {DASHBOARD_NAME} ({existing[0]['id']})")
        sb.delete(f"dashboards?id=eq.{existing[0]['id']}")
        existing = []
    if existing:
        dash = existing[0]
        print(f"  dashboard already exists: {dash['id']} (use --replace to recreate widgets)")
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
        others = sb.select(f"dashboards?select=id,sort_order&sector_id=eq.{security_id}")
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
                    "sector_id": security_id,
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
    sectors = sb.select(f"sectors?select=id,name,slug&slug=eq.{SECURITY_SLUG}")
    if not sectors:
        print("Security sector not found")
        return 1
    security = sectors[0]
    print(f"\nApplying to Security ({security['id']})…\n")

    _, name_to_id = ensure_framework(sb, security["id"], replace=replace)
    print(f"\nResolved {len(name_to_id)} indicators in {THEMATIC_NAME}")
    print("\nCreating executive dashboard…")
    ensure_dashboard(sb, security["id"], name_to_id, replace=replace)

    others = sb.select(
        f"dashboards?select=id,name&sector_id=eq.{security['id']}&name=neq.{q(DASHBOARD_NAME)}"
    )
    for d in others or []:
        sb.update("dashboards", f"id=eq.{d['id']}", {"published": False})
        print(f"  unpublished other dashboard: {d['name']}")

    print("\nDone. Open /sectors/security in Live mode.")
    print("Enter monthly results via /manage or run fill-security-sector-dashboard-results.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

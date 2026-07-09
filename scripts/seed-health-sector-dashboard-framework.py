#!/usr/bin/env python3
"""Create the Health "Sector Dashboard" thematic framework + executive dashboard.

Adds a monthly, statewide thematic area under Health with executive-facing
domains/indicators (demo-style outcomes + facility/utilisation totals).
Values are left empty for manual entry. Also creates a published sector
dashboard whose widgets pull only from this thematic area.

Does not modify the Phase-1 assessment thematic areas or their dashboards.

Usage:
  python3 scripts/seed-health-sector-dashboard-framework.py          # dry run
  python3 scripts/seed-health-sector-dashboard-framework.py --apply
  python3 scripts/seed-health-sector-dashboard-framework.py --apply --replace
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

HEALTH_SLUG = "health"
THEMATIC_NAME = "Sector Dashboard"
THEMATIC_DESCRIPTION = (
    "Monthly executive health indicators for the sector dashboard — "
    "facility network, utilisation, maternal & child health, infectious disease, "
    "workforce, emergency referral and finance."
)
DASHBOARD_NAME = "Health Executive Dashboard"
DASHBOARD_DESCRIPTION = (
    "Simple executive Health view from the Sector Dashboard thematic area — "
    "briefing numbers with context, facility/workforce mix, and priority coverage scores."
)

# domain name → list of indicator specs
# Each indicator: name, unit, direction, value_type, target?, target_source?, description?
DOMAINS: list[dict] = [
    {
        "name": "Facility Network",
        "description": "Size and readiness of the public health facility network.",
        "indicators": [
            {"name": "Total primary healthcare centres", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Active / functional PHCs", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "PHCs closed or non-functional", "unit": "count", "direction": "lower_is_better", "value_type": "number", "target": 0, "target_source": "State Plan"},
            {"name": "General hospitals", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Specialist / tertiary hospitals", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Functional health facilities rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 85, "target_source": "State Plan"},
            {"name": "PHCs offering 24-hour services", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "PHCs with reliable power", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "State Plan"},
            {"name": "PHCs with clean water on site", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Service Utilisation",
        "description": "Monthly patient flow, admissions, deliveries and referrals.",
        "indicators": [
            {"name": "Total OPD visits this month", "unit": "visits", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Total inpatient admissions this month", "unit": "admissions", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Bed occupancy rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 75, "target_source": "State Plan"},
            {"name": "Average length of stay", "unit": "days", "direction": "lower_is_better", "value_type": "number"},
            {"name": "Emergency / casualty presentations", "unit": "cases", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Referrals made this month", "unit": "referrals", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Referral completion rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "Facility deliveries this month", "unit": "deliveries", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "Maternal & Child Health",
        "description": "ANC, skilled birth, immunisation and mortality outcomes.",
        "indicators": [
            {"name": "Antenatal care (ANC) first visits", "unit": "visits", "direction": "higher_is_better", "value_type": "number"},
            {"name": "ANC 4+ contacts coverage", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "WHO"},
            {"name": "Skilled birth attendance", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "SDG 3"},
            {"name": "Facility-based delivery rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "Postnatal care within 48 hours", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "WHO"},
            {"name": "Immunization coverage (Penta-3)", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "WHO"},
            {"name": "Full immunisation coverage (12–23 months)", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "WHO"},
            {"name": "Under-5 mortality rate", "unit": "per 1,000 live births", "direction": "lower_is_better", "value_type": "number", "target": 25, "target_source": "SDG 3.2"},
            {"name": "Maternal mortality ratio", "unit": "per 100,000 live births", "direction": "lower_is_better", "value_type": "number", "target": 70, "target_source": "SDG 3.1"},
            {"name": "Stillbirth rate", "unit": "per 1,000 births", "direction": "lower_is_better", "value_type": "number"},
            {"name": "Low birth weight rate", "unit": "%", "direction": "lower_is_better", "value_type": "percentage"},
        ],
    },
    {
        "name": "Infectious Disease & Surveillance",
        "description": "Malaria, TB, HIV and outbreak-prone disease surveillance.",
        "indicators": [
            {"name": "Malaria cases this month", "unit": "cases", "direction": "lower_is_better", "value_type": "number"},
            {"name": "Malaria incidence", "unit": "per 1,000", "direction": "lower_is_better", "value_type": "number", "target": 100, "target_source": "WHO GTS"},
            {"name": "Malaria test positivity rate", "unit": "%", "direction": "lower_is_better", "value_type": "percentage"},
            {"name": "TB cases notified this month", "unit": "cases", "direction": "higher_is_better", "value_type": "number"},
            {"name": "TB treatment success rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "WHO"},
            {"name": "New HIV diagnoses this month", "unit": "cases", "direction": "lower_is_better", "value_type": "number"},
            {"name": "People living with HIV on ART", "unit": "persons", "direction": "higher_is_better", "value_type": "number"},
            {"name": "HIV viral load suppression rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "UNAIDS"},
            {"name": "Cholera / AWD cases this month", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 0, "target_source": "State Plan"},
            {"name": "Measles cases this month", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 0, "target_source": "State Plan"},
            {"name": "Lassa fever / VHF suspected cases", "unit": "cases", "direction": "lower_is_better", "value_type": "number", "target": 0, "target_source": "State Plan"},
            {"name": "Disease outbreak alerts investigated on time", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 100, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Health Workforce",
        "description": "Doctors, nurses, CHEWs, density and attendance.",
        "indicators": [
            {"name": "Total doctors", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Total nurses / midwives", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Total CHEWs / JCHEWs", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Doctors per 10,000 population", "unit": "per 10,000", "direction": "higher_is_better", "value_type": "number", "target": 4.5, "target_source": "WHO"},
            {"name": "Nurses & midwives per 10,000", "unit": "per 10,000", "direction": "higher_is_better", "value_type": "number", "target": 25, "target_source": "WHO"},
            {"name": "Clinical staff attendance", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
            {"name": "Health worker vacancies", "unit": "count", "direction": "lower_is_better", "value_type": "number"},
            {"name": "Staff trained this month (CPD / clinical)", "unit": "persons", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "Emergency & Referral",
        "description": "Ambulance capacity, response time and referral closure.",
        "indicators": [
            {"name": "Functional ambulances", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Ambulance dispatches this month", "unit": "trips", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Average emergency response time", "unit": "minutes", "direction": "lower_is_better", "value_type": "number", "target": 15, "target_source": "State Plan"},
            {"name": "Emergency obstetric referrals", "unit": "referrals", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Emergency referral closure rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 85, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Finance & Access",
        "description": "Budget release, BHCPF and insurance / free-care utilisation.",
        "indicators": [
            {"name": "Health budget released this month", "unit": "NGN", "direction": "higher_is_better", "value_type": "number"},
            {"name": "BHCPF / DFF disbursed to facilities", "unit": "NGN", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Patients covered by state health insurance", "unit": "persons", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Free maternal / under-5 services utilisation", "unit": "visits", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
]

# Short executive briefing text shown under each stat card.
INDICATOR_BRIEFINGS: dict[str, str] = {
    "Total primary healthcare centres": "Public PHCs registered in the state network this month.",
    "Active / functional PHCs": "PHCs open and delivering services — the working frontline footprint.",
    "PHCs closed or non-functional": "Facilities offline this month; keep this near zero.",
    "Total doctors": "Practising doctors available across the public health system.",
    "Total nurses / midwives": "Nurses and midwives supporting delivery and clinical care.",
    "Total OPD visits this month": "Outpatient demand across public facilities this month.",
    "Total inpatient admissions this month": "Patients admitted for inpatient care this month.",
    "Facility deliveries this month": "Births attended in public facilities this month.",
    "Malaria cases this month": "Confirmed or treated malaria cases reported this month.",
    "New HIV diagnoses this month": "Newly identified HIV cases in the reporting month.",
    "Immunization coverage (Penta-3)": "Share of children completing Penta-3 / DPT3 — core immunisation performance.",
    "Skilled birth attendance": "Births attended by a skilled health professional.",
    "Functional health facilities rate": "Share of facilities meeting the functional readiness standard.",
    "Clinical staff attendance": "Clinical staff present during duty hours.",
    "TB treatment success rate": "TB patients completing treatment successfully.",
    "Emergency referral closure rate": "Emergency referrals completed with a recorded outcome.",
}

# Simple executive dashboard: briefing stats, then pie + bar from Sector Dashboard domains.
WIDGETS = [
    {
        "chart_type": "stat",
        "title": "Executive briefing — network & people",
        "indicator_names": [
            "Total primary healthcare centres",
            "Active / functional PHCs",
            "Total doctors",
            "Total nurses / midwives",
        ],
        "span": 2,
        "position": 0,
    },
    {
        "chart_type": "stat",
        "title": "Executive briefing — this month’s activity",
        "indicator_names": [
            "Total OPD visits this month",
            "Total inpatient admissions this month",
            "Facility deliveries this month",
            "Malaria cases this month",
        ],
        "span": 2,
        "position": 1,
    },
    {
        "chart_type": "pie",
        "title": "Facility network mix",
        "indicator_names": [
            "Active / functional PHCs",
            "PHCs closed or non-functional",
            "General hospitals",
            "Specialist / tertiary hospitals",
        ],
        "span": 1,
        "position": 2,
    },
    {
        "chart_type": "pie",
        "title": "Workforce mix",
        "indicator_names": [
            "Total doctors",
            "Total nurses / midwives",
            "Total CHEWs / JCHEWs",
        ],
        "span": 1,
        "position": 3,
    },
    {
        "chart_type": "bar",
        "title": "Priority coverage scores",
        "indicator_names": [
            "Immunization coverage (Penta-3)",
            "Skilled birth attendance",
            "Functional health facilities rate",
            "Clinical staff attendance",
            "TB treatment success rate",
            "Emergency referral closure rate",
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
    row = {
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
    return row


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


def ensure_framework(sb: Supabase, health_id: str, replace: bool) -> tuple[dict, dict[str, str]]:
    """Create thematic + domains + indicators. Returns (thematic, name→id map)."""
    existing = sb.select(
        f"thematic_areas?select=id,name&sector_id=eq.{health_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if existing and replace:
        print(f"  deleting existing thematic area {THEMATIC_NAME} ({existing[0]['id']})")
        sb.delete(f"thematic_areas?id=eq.{existing[0]['id']}")
        existing = []

    if existing:
        thematic = existing[0]
        print(f"  using existing thematic area {thematic['id']}")
        # refresh description/frequency
        sb.upsert(
            "thematic_areas",
            [
                {
                    "id": thematic["id"],
                    "sector_id": health_id,
                    "name": THEMATIC_NAME,
                    "description": THEMATIC_DESCRIPTION,
                    "frequency": "monthly",
                    "weight": 1,
                }
            ],
            "id",
        )
    else:
        rows = sb.insert(
            "thematic_areas",
            [
                {
                    "sector_id": health_id,
                    "name": THEMATIC_NAME,
                    "description": THEMATIC_DESCRIPTION,
                    "frequency": "monthly",
                    "weight": 1,
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
                # update metadata
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

        # load any we might have skipped printing
        all_inds = sb.select(
            f"indicators?select=id,name&domain_id=eq.{domain['id']}&indicator_scope=eq.state&limit=200"
        )
        for ind in all_inds:
            name_to_id[ind["name"]] = ind["id"]

    return thematic, name_to_id


def ensure_dashboard(sb: Supabase, health_id: str, name_to_id: dict[str, str], replace: bool) -> None:
    missing = []
    for w in WIDGETS:
        for n in w["indicator_names"]:
            if n not in name_to_id:
                missing.append(n)
    if missing:
        raise RuntimeError(f"Widget indicators not found: {missing}")

    existing = sb.select(
        f"dashboards?select=id,name&sector_id=eq.{health_id}&name=eq.{q(DASHBOARD_NAME)}"
    )
    if existing and replace:
        print(f"  deleting dashboard {DASHBOARD_NAME} ({existing[0]['id']})")
        sb.delete(f"dashboards?id=eq.{existing[0]['id']}")
        existing = []
    if existing:
        dash = existing[0]
        print(f"  dashboard already exists: {dash['id']} (use --replace to recreate widgets)")
        # clear widgets and recreate
        sb.delete(f"dashboard_widgets?dashboard_id=eq.{dash['id']}")
        dash_id = dash["id"]
        # bump sort order to top of sector dashboards
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
        # shift existing health dashboards down
        others = sb.select(f"dashboards?select=id,sort_order&sector_id=eq.{health_id}")
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
                    "sector_id": health_id,
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
    sectors = sb.select(f"sectors?select=id,name,slug&slug=eq.{HEALTH_SLUG}")
    if not sectors:
        print("Health sector not found")
        return 1
    health = sectors[0]
    print(f"\nApplying to Health ({health['id']})…\n")

    _, name_to_id = ensure_framework(sb, health["id"], replace=replace)
    print(f"\nResolved {len(name_to_id)} indicators in {THEMATIC_NAME}")
    print("\nCreating executive dashboard…")
    ensure_dashboard(sb, health["id"], name_to_id, replace=replace)

    # Keep the live Health page focused on the Sector Dashboard executive view.
    others = sb.select(
        f"dashboards?select=id,name&sector_id=eq.{health['id']}&name=neq.{q(DASHBOARD_NAME)}"
    )
    for d in others or []:
        sb.update("dashboards", f"id=eq.{d['id']}", {"published": False})
        print(f"  unpublished assessment dashboard: {d['name']}")

    print("\nDone. Open /sectors/health in Live mode.")
    print("Enter monthly results via /manage for the Sector Dashboard indicators.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

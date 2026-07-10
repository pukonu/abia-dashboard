#!/usr/bin/env python3
"""Create the Education "Sector Dashboard" thematic framework + executive dashboard.

Adds a monthly, statewide thematic area under Education with executive-facing
domains/indicators tailored to Abia State basic and secondary education
(school network, enrolment, learning outcomes, teachers, infrastructure,
equity and finance). Values are left empty for manual entry (or the companion
fill script). Also creates a published sector dashboard whose widgets pull
only from this thematic area.

Does not modify the existing Access & Participation / Quality & Standards
thematic areas.

Usage:
  python3 scripts/seed-education-sector-dashboard-framework.py          # dry run
  python3 scripts/seed-education-sector-dashboard-framework.py --apply
  python3 scripts/seed-education-sector-dashboard-framework.py --apply --replace
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

EDUCATION_SLUG = "education"
THEMATIC_NAME = "Sector Dashboard"
THEMATIC_DESCRIPTION = (
    "Monthly executive education indicators for the sector dashboard — "
    "school network, enrolment & access, learning outcomes, teachers, "
    "infrastructure, equity & inclusion, and finance & programmes."
)
DASHBOARD_NAME = "Education Executive Dashboard"
DASHBOARD_DESCRIPTION = (
    "Simple executive Education view from the Sector Dashboard thematic area — "
    "briefing numbers with context, school/teacher mix, and priority coverage scores."
)

# domain name → list of indicator specs
# Each indicator: name, unit, direction, value_type, target?, target_source?, description?
DOMAINS: list[dict] = [
    {
        "name": "School Network",
        "description": "Size and readiness of the public school network across Abia LGAs.",
        "indicators": [
            {"name": "Total public primary schools", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Total public secondary schools", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Technical / vocational colleges", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Schools open and functional", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Schools closed or non-functional", "unit": "count", "direction": "lower_is_better", "value_type": "number", "target": 0, "target_source": "State Plan"},
            {"name": "Functional schools rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
            {"name": "Smart schools live", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Smart schools in rollout", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Schools covered by annual census", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "Enrolment & Access",
        "description": "Getting every Abia child into school under free basic education.",
        "indicators": [
            {"name": "Total public school enrolment", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Primary enrolment", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Junior secondary enrolment", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Senior secondary enrolment", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Net primary enrolment rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 100, "target_source": "SDG 4"},
            {"name": "Net secondary enrolment rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "SDG 4"},
            {"name": "Gender parity index (primary)", "unit": "index", "direction": "higher_is_better", "value_type": "number", "target": 1, "target_source": "SDG 4.5"},
            {"name": "Out-of-school children rate", "unit": "%", "direction": "lower_is_better", "value_type": "percentage", "target": 5, "target_source": "SDG 4"},
            {"name": "Primary completion rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "SDG 4"},
            {"name": "Transition rate primary to JSS", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Learning Outcomes",
        "description": "External exam performance and foundational literacy/numeracy.",
        "indicators": [
            {"name": "WAEC 5 credits incl. Eng & Maths", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 70, "target_source": "State Plan"},
            {"name": "NECO 5 credits incl. Eng & Maths", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 75, "target_source": "State Plan"},
            {"name": "BECE / JSCE pass rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "P4 pupils meeting literacy benchmark", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "P4 pupils meeting numeracy benchmark", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "JAMB UTME average score (Abia candidates)", "unit": "score", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Candidates sitting WAEC this year", "unit": "candidates", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Candidates sitting NECO this year", "unit": "candidates", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "Teachers & Workforce",
        "description": "Teacher stock, qualifications, attendance and continuous development.",
        "indicators": [
            {"name": "Total teaching staff", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Primary teachers", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Secondary teachers", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Qualified teachers", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
            {"name": "Pupil-teacher ratio (primary)", "unit": "pupils/teacher", "direction": "lower_is_better", "value_type": "number", "target": 35, "target_source": "UNESCO"},
            {"name": "Pupil-teacher ratio (secondary)", "unit": "pupils/teacher", "direction": "lower_is_better", "value_type": "number", "target": 40, "target_source": "UNESCO"},
            {"name": "Teacher attendance rate", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
            {"name": "Teacher vacancies", "unit": "count", "direction": "lower_is_better", "value_type": "number"},
            {"name": "Teachers trained this month (CPD / digital)", "unit": "persons", "direction": "higher_is_better", "value_type": "number"},
            {"name": "STEM subject teachers", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "School Infrastructure",
        "description": "Classrooms, WASH, power, labs and furniture readiness.",
        "indicators": [
            {"name": "Classrooms needing major rehabilitation", "unit": "count", "direction": "lower_is_better", "value_type": "number"},
            {"name": "Schools with adequate toilets", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "State Plan"},
            {"name": "Schools with clean water on site", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 95, "target_source": "State Plan"},
            {"name": "Schools with reliable power", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "Schools with functional science laboratory", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 70, "target_source": "State Plan"},
            {"name": "Schools with adequate furniture", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 85, "target_source": "State Plan"},
            {"name": "Schools with perimeter fencing", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "Classroom blocks renovated this month", "unit": "blocks", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
    {
        "name": "Equity & Inclusion",
        "description": "Girl-child, special needs, rural access and adult literacy.",
        "indicators": [
            {"name": "Girl-child share of enrolment", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 50, "target_source": "SDG 4.5"},
            {"name": "Learners with special needs enrolled", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Schools with inclusive education provision", "unit": "count", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Rural schools with full teacher complement", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 80, "target_source": "State Plan"},
            {"name": "Adult / non-formal education learners", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Adult literacy rate (15+)", "unit": "%", "direction": "higher_is_better", "value_type": "percentage", "target": 90, "target_source": "State Plan"},
        ],
    },
    {
        "name": "Finance & Programmes",
        "description": "Budget release, UBEC matching, feeding, textbooks and digital programmes.",
        "indicators": [
            {"name": "Education budget released this month", "unit": "NGN", "direction": "higher_is_better", "value_type": "number"},
            {"name": "UBEC / UBE matching grant utilised", "unit": "NGN", "direction": "higher_is_better", "value_type": "number"},
            {"name": "School feeding beneficiaries", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Textbooks / learning materials distributed", "unit": "units", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Learners reached by smart-school programme", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
            {"name": "Free education beneficiaries (primary & JSS)", "unit": "learners", "direction": "higher_is_better", "value_type": "number"},
        ],
    },
]

# Short executive briefing text shown under each stat card.
INDICATOR_BRIEFINGS: dict[str, str] = {
    "Total public primary schools": "Public primary schools in the ASUBEB network this month.",
    "Total public secondary schools": "Public junior and senior secondary schools under the Ministry.",
    "Schools open and functional": "Schools open and delivering instruction — the working footprint.",
    "Schools closed or non-functional": "Schools offline this month; keep this near zero.",
    "Smart schools live": "Schools with digital classrooms, connectivity and trained operators.",
    "Total public school enrolment": "Learners enrolled across public primary and secondary schools.",
    "Primary enrolment": "Pupils enrolled in public primary schools.",
    "Junior secondary enrolment": "Students enrolled in public junior secondary schools.",
    "Senior secondary enrolment": "Students enrolled in public senior secondary schools.",
    "Out-of-school children rate": "Share of school-age children not in school — free education priority.",
    "WAEC 5 credits incl. Eng & Maths": "Share of WAEC candidates with five credits including English and Maths.",
    "NECO 5 credits incl. Eng & Maths": "Share of NECO candidates with five credits including English and Maths — Abia often leads nationally.",
    "P4 pupils meeting literacy benchmark": "Primary 4 pupils meeting the state literacy benchmark.",
    "Total teaching staff": "Teachers on the public payroll across basic and secondary schools.",
    "Qualified teachers": "Share of teachers with the minimum professional qualification (NCE / B.Ed).",
    "Pupil-teacher ratio (primary)": "Average pupils per teacher in public primary schools.",
    "Teacher attendance rate": "Teachers present during duty hours this month.",
    "Schools with adequate toilets": "Share of schools meeting the WASH toilet standard.",
    "Schools with clean water on site": "Share of schools with a functional on-site water source.",
    "Girl-child share of enrolment": "Girls as a share of total public school enrolment.",
    "Free education beneficiaries (primary & JSS)": "Learners covered by the state free basic education policy.",
    "School feeding beneficiaries": "Learners receiving school meals under state or federal programmes.",
    "Learners reached by smart-school programme": "Students currently benefiting from smart-school interventions.",
}

# Simple executive dashboard: briefing stats, then pie + bar from Sector Dashboard domains.
WIDGETS = [
    {
        "chart_type": "stat",
        "title": "Executive briefing — network & people",
        "indicator_names": [
            "Total public primary schools",
            "Total public secondary schools",
            "Total teaching staff",
            "Smart schools live",
        ],
        "span": 2,
        "position": 0,
    },
    {
        "chart_type": "stat",
        "title": "Executive briefing — enrolment & access",
        "indicator_names": [
            "Total public school enrolment",
            "Primary enrolment",
            "Junior secondary enrolment",
            "Out-of-school children rate",
        ],
        "span": 2,
        "position": 1,
    },
    {
        "chart_type": "pie",
        "title": "School network mix",
        "indicator_names": [
            "Total public primary schools",
            "Total public secondary schools",
            "Technical / vocational colleges",
            "Smart schools live",
        ],
        "span": 1,
        "position": 2,
    },
    {
        "chart_type": "pie",
        "title": "Enrolment mix",
        "indicator_names": [
            "Primary enrolment",
            "Junior secondary enrolment",
            "Senior secondary enrolment",
        ],
        "span": 1,
        "position": 3,
    },
    {
        "chart_type": "bar",
        "title": "Priority coverage scores",
        "indicator_names": [
            "NECO 5 credits incl. Eng & Maths",
            "WAEC 5 credits incl. Eng & Maths",
            "Net primary enrolment rate",
            "Qualified teachers",
            "Functional schools rate",
            "Teacher attendance rate",
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


def ensure_framework(sb: Supabase, education_id: str, replace: bool) -> tuple[dict, dict[str, str]]:
    """Create thematic + domains + indicators. Returns (thematic, name→id map)."""
    existing = sb.select(
        f"thematic_areas?select=id,name&sector_id=eq.{education_id}&name=eq.{q(THEMATIC_NAME)}"
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
                    "sector_id": education_id,
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
                    "sector_id": education_id,
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


def ensure_dashboard(sb: Supabase, education_id: str, name_to_id: dict[str, str], replace: bool) -> None:
    missing = []
    for w in WIDGETS:
        for n in w["indicator_names"]:
            if n not in name_to_id:
                missing.append(n)
    if missing:
        raise RuntimeError(f"Widget indicators not found: {missing}")

    existing = sb.select(
        f"dashboards?select=id,name&sector_id=eq.{education_id}&name=eq.{q(DASHBOARD_NAME)}"
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
        others = sb.select(f"dashboards?select=id,sort_order&sector_id=eq.{education_id}")
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
                    "sector_id": education_id,
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
    sectors = sb.select(f"sectors?select=id,name,slug&slug=eq.{EDUCATION_SLUG}")
    if not sectors:
        print("Education sector not found")
        return 1
    education = sectors[0]
    print(f"\nApplying to Education ({education['id']})…\n")

    _, name_to_id = ensure_framework(sb, education["id"], replace=replace)
    print(f"\nResolved {len(name_to_id)} indicators in {THEMATIC_NAME}")
    print("\nCreating executive dashboard…")
    ensure_dashboard(sb, education["id"], name_to_id, replace=replace)

    print("\nDone. Open /sectors/education in Live mode.")
    print("Enter monthly results via /manage for the Sector Dashboard indicators.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

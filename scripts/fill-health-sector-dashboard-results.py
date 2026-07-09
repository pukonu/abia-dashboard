#!/usr/bin/env python3
"""Fill Sector Dashboard statewide results from published Abia sources.

Only indicators with a clear Abia-specific (or clearly attributable) public
figure are written. Monthly operational counts without a published source
are left blank.

Primary sources:
  - NDHS 2023-24 Key Indicators Report (PR157) — Abia state rows
  - Abia State Government / Governor Otti statements on PHC network
  - ABSACA / Guardian (Jul 2025) — HIV on ART
  - Abia Health Insurance Scheme press (2025–2026) — enrolment
  - Peer-reviewed Abia health system description — hospital counts

Usage:
  python3 scripts/fill-health-sector-dashboard-results.py          # dry run
  python3 scripts/fill-health-sector-dashboard-results.py --apply
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

HEALTH_SLUG = "health"
THEMATIC_NAME = "Sector Dashboard"
# Anchor survey/stock figures to the latest monthly period we created.
PERIOD_LABEL = "Jul 2026"

# name → (abia_value, nigeria_value|None, notes)
# nigeria_value is national NDHS 2023-24 where available for context.
FILLS: dict[str, tuple[float, float | None, str]] = {
    # --- Facility Network ---
    "Total primary healthcare centres": (
        948,
        None,
        "Abia State Government / Gov. Otti: commitment to functionalise all 948 PHCs across the state (Project Ekwueme coverage statements).",
    ),
    "General hospitals": (
        22,
        None,
        "Abia State project listing: reconstruction of 7 of 22 general hospitals across the state (Factsheet / Gov. Otti project list).",
    ),
    "Specialist / tertiary hospitals": (
        2,
        None,
        "Published Abia health-system description: 2 tertiary hospitals (plus specialist facilities under upgrade). BMC Health Economics Review / related Abia SHI studies.",
    ),
    # --- Maternal & Child Health (NDHS 2023-24 Key Indicators, Abia row) ---
    "ANC 4+ contacts coverage": (
        79.1,
        52.0,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 12 — Abia: women with 4+ ANC visits = 79.1%. National ≈ 52%.",
    ),
    "Skilled birth attendance": (
        95.2,
        46.0,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 12 — Abia: live births delivered by a skilled provider = 95.2%. National ≈ 46%.",
    ),
    "Facility-based delivery rate": (
        86.0,
        43.0,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 12 — Abia: live births delivered in a health facility = 86.0%. National ≈ 43%.",
    ),
    "Postnatal care within 48 hours": (
        66.4,
        42.0,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 12 — Abia: postnatal check during the first 2 days after birth = 66.4%. National ≈ 42%.",
    ),
    "Immunization coverage (Penta-3)": (
        79.7,
        53.3,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 15 — Abia: DPT-HepB-Hib 3 (Penta-3) among children 12–23 months = 79.7%. National Penta-3 ≈ 53.3% (NCSAP citing NDHS).",
    ),
    "Full immunisation coverage (12–23 months)": (
        38.0,
        39.0,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 15 — Abia: fully vaccinated against basic antigens (12–23 months) = 38.0% (small state sample n≈43). National ≈ 39%.",
    ),
    "Under-5 mortality rate": (
        69.0,
        110.0,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 11 — Abia under-5 mortality = 69 per 1,000 live births. National under-5 mortality cited ≈ 110 in NCSAP (NDHS 2023-24).",
    ),
    # --- Infectious disease / HIV ---
    "People living with HIV on ART": (
        46788,
        None,
        "ABSACA (Dr Uloaku Emma-Ukaegbu), reported in The Guardian, 24 Jul 2025: 46,788 persons on HIV treatment in Abia; prevalence 2.1% (2024).",
    ),
    # --- Finance & Access ---
    "Patients covered by state health insurance": (
        157462,
        None,
        "Abia State Health Insurance Scheme enrolment reported at 157,462 (Guardian / National Ambassador, 2026 coverage updates).",
    ),
}

# Explicitly left blank (no reliable Abia monthly/public figure found):
LEFT_BLANK = [
    "Active / functional PHCs",  # Project Ekwueme completed ~200 but inauguration/staffing still in progress — not a clean 'active' count
    "PHCs closed or non-functional",
    "Functional health facilities rate",
    "PHCs offering 24-hour services",
    "PHCs with reliable power",
    "PHCs with clean water on site",
    "Total OPD visits this month",
    "Total inpatient admissions this month",
    "Bed occupancy rate",
    "Average length of stay",
    "Emergency / casualty presentations",
    "Referrals made this month",
    "Referral completion rate",
    "Facility deliveries this month",
    "Antenatal care (ANC) first visits",  # NDHS gives coverage %, not monthly visit counts
    "Maternal mortality ratio",  # NDHS MMR is national, not Abia-specific in KIR
    "Stillbirth rate",
    "Low birth weight rate",
    "Malaria cases this month",
    "Malaria incidence",  # NMIS gives child prevalence, not incidence per 1,000 population
    "Malaria test positivity rate",
    "TB cases notified this month",
    "TB treatment success rate",  # only single-facility study found, not statewide
    "New HIV diagnoses this month",
    "HIV viral load suppression rate",
    "Cholera / AWD cases this month",
    "Measles cases this month",
    "Lassa fever / VHF suspected cases",
    "Disease outbreak alerts investigated on time",
    "Total doctors",
    "Total nurses / midwives",
    "Total CHEWs / JCHEWs",
    "Doctors per 10,000 population",
    "Nurses & midwives per 10,000",
    "Clinical staff attendance",
    "Health worker vacancies",
    "Staff trained this month (CPD / clinical)",
    "Functional ambulances",
    "Ambulance dispatches this month",
    "Average emergency response time",
    "Emergency obstetric referrals",
    "Emergency referral closure rate",
    "Health budget released this month",
    "BHCPF / DFF disbursed to facilities",
    "Free maternal / under-5 services utilisation",
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

    def upsert(self, table: str, rows: list[dict], on_conflict: str):
        return self._call(
            "POST",
            f"{table}?on_conflict={on_conflict}",
            rows,
            prefer="return=representation,resolution=merge-duplicates",
        )


def main() -> int:
    apply_flag = "--apply" in sys.argv
    print(f"Will fill {len(FILLS)} indicators; leave {len(LEFT_BLANK)} blank.\n")
    print("FILL:")
    for name, (abia, ng, notes) in FILLS.items():
        ng_s = f", NG={ng}" if ng is not None else ""
        print(f"  ✓ {name} = {abia}{ng_s}")
        print(f"      {notes[:100]}…")
    print("\nLEAVE BLANK:")
    for name in LEFT_BLANK:
        print(f"  · {name}")

    if not apply_flag:
        print("\nDry run only. Re-run with --apply to write Jul 2026 statewide results.")
        return 0

    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing Supabase env")
        return 1

    sb = Supabase(url, key)
    sectors = sb.select(f"sectors?select=id&slug=eq.{HEALTH_SLUG}")
    health_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id&sector_id=eq.{health_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        return 1
    ta_id = tas[0]["id"]

    periods = sb.select(
        f"time_periods?select=id,label&frequency=eq.monthly&label=eq.{q(PERIOD_LABEL)}"
    )
    if not periods:
        print(f"Time period not found: {PERIOD_LABEL}")
        return 1
    period_id = periods[0]["id"]

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

    # PostgREST unique upsert needs a constraint. results may not have a unique
    # on (indicator_id, time_period_id, entity_id). Delete existing then insert.
    for row in rows:
        existing = sb.select(
            "results?select=id"
            f"&indicator_id=eq.{row['indicator_id']}"
            f"&time_period_id=eq.{period_id}"
            "&entity_id=is.null"
        )
        if existing:
            sb._call("DELETE", f"results?id=eq.{existing[0]['id']}", prefer="return=minimal")

    created = sb._call("POST", "results", rows, prefer="return=representation")
    print(f"\nWrote {len(created)} statewide results for {PERIOD_LABEL}.")
    for r, name in zip(created, FILLS.keys()):
        print(f"  {name}: {r['abia_value']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

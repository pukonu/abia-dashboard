#!/usr/bin/env python3
"""Fill Health Sector Dashboard statewide results from published sources.

Only indicators with a clear Abia-specific (or clearly attributable) public
figure are written. Monthly operational counts without a published source
are left blank.

Primary sources:
  - NDHS 2023-24 Key Indicators Report (PR157) — Abia state rows
  - FMOH / NHSRII Quarterly Performance Dialogue Q1 2026 (DHIS2 / SWAp)
  - Abia State Government / Project Ekwueme PHC & hospital statements
  - ABSACA — HIV on ART
  - FMOH / state briefings — ABSHIS enrolment (Jul 2026)

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
FILLS: dict[str, tuple[float, float | None, str]] = {
    # --- Facility Network ---
    "Total primary healthcare centres": (
        948,
        None,
        "Abia State Government / Gov. Otti: commitment to functionalise all 948 PHCs across the state (Project Ekwueme coverage statements).",
    ),
    "Active / functional PHCs": (
        136,
        None,
        "Jul 2026 stock: 136 active/functional PHCs. Series: Mar/Q1≈90 (Uche prior count); Apr=110 (EXCO/NAN); May=121 (Otti 3rd-anniversary scorecard); Jun≈135 (Invest Lagos 3.0, 8 Jun 2026).",
    ),
    "Functional health facilities rate": (
        14.3,
        None,
        "Derived: 136 functional PHCs ÷ 948 total PHCs × 100. Reflects Project Ekwueme PHC functionalisation share of the registered PHC network (not all facility types).",
    ),
    "General hospitals": (
        22,
        None,
        "Abia State / FMINO: 22 secondary healthcare centres / general hospitals across the 17 LGAs (Gov. Otti media engagement; Health Commissioner interviews).",
    ),
    "Specialist / tertiary hospitals": (
        3,
        None,
        "State Health Commissioner / Gov. Otti: three tertiary/referral facilities — ABSUTH (Aba), Amachara Specialist Hospital (Umuahia), Umunnato Specialist Hospital (Bende) — one per senatorial district.",
    ),
    # --- Maternal & Child Health ---
    # Survey baselines (NDHS) for Abia vs Nigeria comparability
    "ANC 4+ contacts coverage": (
        79.1,
        52.0,
        "NDHS 2023-24 Key Indicators Report (PR157), maternal care table — Abia: women with 4+ ANC visits = 79.1%. National = 52%. Target: WHO ≥80%.",
    ),
    "Skilled birth attendance": (
        90.0,
        86.0,
        "FMOH NHSRII / SWAp Quarterly Performance Dialogue Q1 2026 (DHIS2): Abia skilled birth attendance = 90%; national = 86%. (NDHS 2023-24 Abia survey baseline was 95.2% / national 46%.) Target: SDG 3 / state plan ≥90%.",
    ),
    "Facility-based delivery rate": (
        86.0,
        43.0,
        "NDHS 2023-24 Key Indicators Report (PR157) — Abia: live births delivered in a health facility = 86.0%. National ≈ 43%.",
    ),
    "Postnatal care within 48 hours": (
        66.4,
        42.0,
        "NDHS 2023-24 Key Indicators Report (PR157) — Abia: postnatal check during the first 2 days after birth = 66.4%. National ≈ 42%. Target: WHO ≥80%.",
    ),
    "Immunization coverage (Penta-3)": (
        76.0,
        53.3,
        "FMOH NHSRII Q1 2026 scorecard: Abia Penta-3 coverage = 76% (down from 81% in Q4 2025). Nigeria column uses NDHS 2023-24 national Penta-3 ≈ 53.3% for survey context. Target: WHO ≥95%.",
    ),
    "Full immunisation coverage (12–23 months)": (
        112.0,
        80.0,
        "FMOH NHSRII Q1 2026 (DHIS2, NPC population denominators): Abia fully immunised coverage = 112% (admin coverage can exceed 100%); national fully immunised = 80% in Q1 2026. NDHS 2023-24 survey baseline Abia basic antigens = 38% / national 39%.",
    ),
    "Under-5 mortality rate": (
        69.0,
        110.0,
        "NDHS 2023-24 Key Indicators Report (PR157), Table 10 — Abia under-5 mortality = 69 per 1,000 live births. National under-5 = 110. Target: SDG 3.2 ≤25 per 1,000.",
    ),
    # --- Infectious disease / HIV ---
    "People living with HIV on ART": (
        50879,
        None,
        "ABSACA (Dr Uloaku Emma-Ukaegbu), National Ambassador reporting on Jul 2025 WDC sensitisation: 50,879 people in Abia receiving HIV treatment; prevalence 2.1% (2024). Earlier ABSACA figure (Jan/Jul 2025 press) cited 46,788.",
    ),
    # --- Finance & Access ---
    "Patients covered by state health insurance": (
        225581,
        None,
        "Federal Ministry of Health Quarterly Performance Dialogue briefing (reported Jul 2026): Abia State Health Insurance Scheme enrolment rose from 40,000 (Dec 2024) to 225,581 (as of Jul 2026).",
    ),
}

# Explicitly left blank (no reliable Abia monthly/public figure found):
LEFT_BLANK = [
    "PHCs closed or non-functional",  # residual of 948−151 not equivalent to closed/non-functional
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
    "Antenatal care (ANC) first visits",  # NDHS/Q1 give coverage ratios, not monthly visit counts
    "Maternal mortality ratio",  # Q1 reports death counts (Abia=1), not MMR per 100,000
    "Stillbirth rate",
    "Low birth weight rate",
    "Malaria cases this month",
    "Malaria incidence",  # NMIS gives child prevalence, not incidence per 1,000 population
    "Malaria test positivity rate",
    "TB cases notified this month",
    "TB treatment success rate",  # only facility/hospital studies found, not statewide
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
        print(f"      {notes[:120]}…")
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

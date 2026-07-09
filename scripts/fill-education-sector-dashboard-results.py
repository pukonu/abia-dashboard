#!/usr/bin/env python3
"""Fill Education Sector Dashboard statewide results from published Abia sources.

Only indicators with a clear Abia-specific (or clearly attributable) public
figure are written. Operational counts without a published source are left blank.

Reporting month: Jun 2026 (one historical record). Values are the latest
published figures available as of that month — not necessarily measured in June.

Primary sources:
  - Gov. Otti media briefing (Jan 2026) / Punch / BusinessDay — public school
    enrolment from ~117,000 to over 300,000 under free education
  - Abia annual school census (Commissioner Kanu) — 4,150 schools, 45,151 staff
  - NECO 2025 SSCE Internal (Premium Times / SolaceBase review) — Abia 83.31%
    five credits incl. Eng & Maths; 11,260 candidates sat
  - Abia State Government — 5,394 teachers recruited (first batch); 4,000 more
    in progress (stock note only; not used as total teaching staff)
  - SchoolRegistry NG directory estimates — literacy, PTR, net enrolment

Usage:
  python3 scripts/fill-education-sector-dashboard-results.py          # dry run
  python3 scripts/fill-education-sector-dashboard-results.py --apply
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

EDUCATION_SLUG = "education"
THEMATIC_NAME = "Sector Dashboard"
PERIOD_LABEL = "Jun 2026"
# Clear any earlier mistaken quarterly fill so only Jun 2026 remains.
CLEAR_PERIOD_LABELS = ("Jun 2026", "Q2 2026")

# name → (abia_value, nigeria_value|None, notes)
FILLS: dict[str, tuple[float, float | None, str]] = {
    # --- School Network ---
    "Schools covered by annual census": (
        4150,
        None,
        "Abia first statewide annual school census (Commissioner Prince Okey Kanu): "
        "4,150 schools uploaded via NEMIS. Pegged to Jun 2026 as latest published stock.",
    ),
    # --- Enrolment & Access ---
    "Total public school enrolment": (
        300000,
        None,
        "Gov. Alex Otti (Jan 2026 media briefing, Punch / BusinessDay): public primary "
        "and secondary enrolment rose from ~117,000 to over 300,000 within one year under "
        "free education. Pegged to Jun 2026 monthly reporting as latest published figure.",
    ),
    "Free education beneficiaries (primary & JSS)": (
        300000,
        None,
        "Aligned with public enrolment surge attributed to free & compulsory education "
        "in primary and junior secondary (Gov. Otti / ASUBEB). Pegged to Jun 2026.",
    ),
    "Net primary enrolment rate": (
        91,
        None,
        "SchoolRegistry NG Abia education metrics (directory estimate): primary net "
        "enrolment ≈ 91%. Pegged to Jun 2026 as latest published estimate.",
    ),
    "Net secondary enrolment rate": (
        82,
        None,
        "SchoolRegistry NG Abia education metrics (directory estimate): secondary net "
        "enrolment ≈ 82%. Pegged to Jun 2026 as latest published estimate.",
    ),
    # --- Learning Outcomes ---
    "NECO 5 credits incl. Eng & Maths": (
        83.31,
        60.26,
        "NECO 2025 SSCE Internal: Abia ranked 1st nationally with 83.31% five credits "
        "incl. English & Maths (9,381 of 11,260 candidates). National ≈ 60.26% "
        "(Premium Times / SolaceBase review of NECO data). Pegged to Jun 2026.",
    ),
    "Candidates sitting NECO this year": (
        11260,
        1358339,
        "NECO 2025 SSCE Internal: Abia candidates who sat = 11,260. National sat = "
        "1,358,339 (NECO Registrar / Premium Times). Pegged to Jun 2026 reporting month.",
    ),
    # --- Teachers & Workforce ---
    "Total teaching staff": (
        45151,
        None,
        "Abia annual school census: 45,151 staff captured across all schools in the "
        "census (includes private; public-only split not published). Pegged to Jun 2026. "
        "Note: state also recruited 5,394 teachers (first batch) with 4,000 more planned.",
    ),
    "Pupil-teacher ratio (primary)": (
        28,
        None,
        "SchoolRegistry NG Abia metrics: teacher-student ratio ≈ 1:28 (directory estimate). "
        "Pegged to Jun 2026.",
    ),
    # --- Equity & Inclusion ---
    "Adult literacy rate (15+)": (
        84,
        62,
        "SchoolRegistry NG Abia metrics: literacy rate ≈ 84% vs national ≈ 62% "
        "(directory estimate). Pegged to Jun 2026.",
    ),
}

# Explicitly left blank (no reliable Abia public figure found):
LEFT_BLANK = [
    "Total public primary schools",
    "Total public secondary schools",
    "Technical / vocational colleges",
    "Schools open and functional",
    "Schools closed or non-functional",
    "Functional schools rate",
    "Smart schools live",
    "Smart schools in rollout",
    "Primary enrolment",
    "Junior secondary enrolment",
    "Senior secondary enrolment",
    "Gender parity index (primary)",
    "Out-of-school children rate",
    "Primary completion rate",
    "Transition rate primary to JSS",
    "WAEC 5 credits incl. Eng & Maths",
    "BECE / JSCE pass rate",
    "P4 pupils meeting literacy benchmark",
    "P4 pupils meeting numeracy benchmark",
    "JAMB UTME average score (Abia candidates)",
    "Candidates sitting WAEC this year",
    "Primary teachers",
    "Secondary teachers",
    "Qualified teachers",
    "Pupil-teacher ratio (secondary)",
    "Teacher attendance rate",
    "Teacher vacancies",
    "Teachers trained this month (CPD / digital)",
    "STEM subject teachers",
    "Classrooms needing major rehabilitation",
    "Schools with adequate toilets",
    "Schools with clean water on site",
    "Schools with reliable power",
    "Schools with functional science laboratory",
    "Schools with adequate furniture",
    "Schools with perimeter fencing",
    "Classroom blocks renovated this month",
    "Girl-child share of enrolment",
    "Learners with special needs enrolled",
    "Schools with inclusive education provision",
    "Rural schools with full teacher complement",
    "Adult / non-formal education learners",
    "Education budget released this month",
    "UBEC / UBE matching grant utilised",
    "School feeding beneficiaries",
    "Textbooks / learning materials distributed",
    "Learners reached by smart-school programme",
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

    def update(self, table: str, filters: str, row: dict):
        return self._call("PATCH", f"{table}?{filters}", row, prefer="return=representation")


def main() -> int:
    apply_flag = "--apply" in sys.argv
    print(f"Will fill {len(FILLS)} indicators for {PERIOD_LABEL}; leave {len(LEFT_BLANK)} blank.\n")
    print("FILL:")
    for name, (abia, ng, notes) in FILLS.items():
        ng_s = f", NG={ng}" if ng is not None else ""
        print(f"  ✓ {name} = {abia}{ng_s}")
        print(f"      {notes[:110]}…")
    print("\nLEAVE BLANK:")
    for name in LEFT_BLANK:
        print(f"  · {name}")

    if not apply_flag:
        print(f"\nDry run only. Re-run with --apply to write {PERIOD_LABEL} statewide results.")
        print("Also sets Sector Dashboard thematic frequency to monthly and clears prior Q2 fills.")
        return 0

    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing Supabase env")
        return 1

    sb = Supabase(url, key)
    sectors = sb.select(f"sectors?select=id&slug=eq.{EDUCATION_SLUG}")
    if not sectors:
        print("Education sector not found")
        return 1
    education_id = sectors[0]["id"]
    tas = sb.select(
        f"thematic_areas?select=id,frequency&sector_id=eq.{education_id}&name=eq.{q(THEMATIC_NAME)}"
    )
    if not tas:
        print(f"Thematic area not found: {THEMATIC_NAME}")
        return 1
    ta = tas[0]
    ta_id = ta["id"]

    # Ensure monthly reporting cadence.
    if ta.get("frequency") != "monthly":
        sb.update(
            "thematic_areas",
            f"id=eq.{ta_id}",
            {
                "frequency": "monthly",
                "description": (
                    "Monthly executive education indicators for the sector dashboard — "
                    "school network, enrolment & access, learning outcomes, teachers, "
                    "infrastructure, equity & inclusion, and finance & programmes."
                ),
            },
        )
        print("  set thematic frequency → monthly")

    periods = sb.select(
        f"time_periods?select=id,label&frequency=eq.monthly&label=eq.{q(PERIOD_LABEL)}"
    )
    if not periods:
        print(f"Time period not found: {PERIOD_LABEL}")
        return 1
    period_id = periods[0]["id"]

    clear_period_ids: list[str] = []
    for label in CLEAR_PERIOD_LABELS:
        # monthly Jun + any leftover quarterly Q2
        found = sb.select(f"time_periods?select=id,label,frequency&label=eq.{q(label)}")
        for p in found or []:
            clear_period_ids.append(p["id"])
            print(f"  will clear prior results for {p['label']} ({p['frequency']})")

    domains = sb.select(f"domains?select=id,name&thematic_area_id=eq.{ta_id}")
    name_to_ind: dict[str, dict] = {}
    all_ind_ids: list[str] = []
    for d in domains:
        inds = sb.select(
            f"indicators?select=id,name,target_value&domain_id=eq.{d['id']}&indicator_scope=eq.state&limit=200"
        )
        for ind in inds:
            name_to_ind[ind["name"]] = ind
            all_ind_ids.append(ind["id"])

    missing = [n for n in FILLS if n not in name_to_ind]
    if missing:
        print(f"Indicators not found in DB: {missing}")
        return 1

    # Clear prior statewide results for this thematic (Jun + mistaken Q2).
    cleared = 0
    for iid in all_ind_ids:
        for pid in clear_period_ids:
            existing = sb.select(
                "results?select=id"
                f"&indicator_id=eq.{iid}"
                f"&time_period_id=eq.{pid}"
                "&entity_id=is.null"
            )
            for row in existing or []:
                sb._call("DELETE", f"results?id=eq.{row['id']}", prefer="return=minimal")
                cleared += 1
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

    created = sb._call("POST", "results", rows, prefer="return=representation")
    print(f"\nWrote {len(created)} statewide results for {PERIOD_LABEL}.")
    for r, name in zip(created, FILLS.keys()):
        print(f"  {name}: {r['abia_value']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

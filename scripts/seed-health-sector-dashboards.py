#!/usr/bin/env python3
"""Seed live Health sector dashboards from statewide indicator results.

The dashboard builder plots state-scope indicators (entity_id IS NULL results).
This script mirrors the demo "Primary Care at a Glance" layout, but wires
widgets to the live Phase-1 statewide assessment indicators that already have
Q2 2026 values in Supabase.

Usage:
  python3 scripts/seed-health-sector-dashboards.py          # dry run
  python3 scripts/seed-health-sector-dashboards.py --apply  # write to DB
"""

from __future__ import annotations

import json
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HEALTH_SLUG = "health"
STATEWIDE_THEMATIC = "Primary Healthcare (Statewide)"

# Short codes → live indicator name prefixes (statewide assessment questions).
# These are the closest live equivalents of the demo outcome indicators.
INDICATOR_KEYS = {
    # Immunization / DPT3 (demo: Immunization coverage Penta-3)
    "dpt3_coverage": "4.1 What is the verified DPT3",
    "full_immunisation": "3.2 What is the most recent verified full-immunisation",
    "cold_chain": "3.4 Is the cold chain functional",
    # Skilled birth (demo: Skilled birth attendance)
    "skilled_birth": "5.1 What is the State's verified proportion of births",
    "bemonc_phc": "2.3 What proportion of PHCs provide Basic Emergency Obstetric",
    # Under-5 / child health (demo: Under-5 mortality)
    "imci": "1.4 Is there a functioning Integrated Management of Childhood Illness",
    "u5_register": "1.1 Does the State maintain a verified, deduplicated under-5",
    # Medicines (demo: Essential drugs availability)
    "tracer_medicines": "7.2 What proportion of facilities had no stockouts of tracer",
    "eml": "7.1 Is there a State-approved Essential Medicines List",
    # Facility readiness (demo: Functional health facilities)
    "phc_scorecard": "6.1 Is there a current PHC readiness scorecard",
    "phc_staffing": "6.2 What proportion of PHCs meet the minimum staffing",
    # Emergency / referral (live gap area — avg ~35)
    "ambulance": "8.2 Does the State operate a dispatched ambulance",
    "referral_protocol": "8.1 Is there a State-wide emergency referral protocol",
    "referral_tracking": "8.6 Are emergency referrals tracked end-to-end",
    # Workforce / budget
    "doctors_density": "11.1 What is the verified count of practising doctors",
    "health_budget_share": "9.1 What proportion of total State expenditure was allocated",
    "bhcpf": "9.4 Is the State Basic Health Care Provision Fund",
}


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

    def delete(self, path: str):
        return self._call("DELETE", path, prefer="return=representation")


def resolve_indicators(sb: Supabase, health_id: str) -> dict[str, dict]:
    """Map INDICATOR_KEYS → live state-scope indicators under Health that have results."""
    tas = sb.select(
        f"thematic_areas?select=id,name&sector_id=eq.{health_id}&order=name"
    )
    statewide = next((t for t in tas if t["name"] == STATEWIDE_THEMATIC), None)
    if not statewide:
        raise RuntimeError(f"Thematic area not found: {STATEWIDE_THEMATIC}")

    domains = sb.select(
        f"domains?select=id,name&thematic_area_id=eq.{statewide['id']}&order=name"
    )
    indicators: list[dict] = []
    for d in domains:
        rows = sb.select(
            "indicators?select=id,name,unit,direction,target_value,indicator_scope,domain_id"
            f"&domain_id=eq.{d['id']}&indicator_scope=eq.state&order=name&limit=500"
        )
        for row in rows:
            row["_domain"] = d["name"]
            indicators.append(row)

    # Only keep indicators that already have statewide results
    with_data: dict[str, dict] = {}
    for ind in indicators:
        results = sb.select(
            f"results?select=id,abia_value&indicator_id=eq.{ind['id']}&entity_id=is.null&limit=1"
        )
        if results:
            ind["_latest"] = float(results[0]["abia_value"])
            with_data[ind["id"]] = ind

    resolved: dict[str, dict] = {}
    for key, prefix in INDICATOR_KEYS.items():
        match = next(
            (
                ind
                for ind in with_data.values()
                if ind["name"].startswith(prefix) or prefix in ind["name"]
            ),
            None,
        )
        if not match:
            print(f"  ! missing (or no statewide result): {key} → {prefix!r}")
            continue
        resolved[key] = match
        print(
            f"  ✓ {key}: {match['_latest']:6.2f} | {match['name'][:72]} | {match['id']}"
        )
    return resolved


def build_dashboards(health_id: str, inds: dict[str, dict]) -> list[dict]:
    """Return dashboard + widget specs. Requires the core keys used below."""
    required = [
        "dpt3_coverage",
        "skilled_birth",
        "imci",
        "tracer_medicines",
        "full_immunisation",
        "phc_scorecard",
        "ambulance",
        "referral_protocol",
        "doctors_density",
        "health_budget_share",
        "bemonc_phc",
        "cold_chain",
        "phc_staffing",
        "eml",
        "referral_tracking",
        "bhcpf",
        "u5_register",
    ]
    missing = [k for k in required if k not in inds]
    if missing:
        raise RuntimeError(f"Cannot build dashboards; missing indicators: {missing}")

    def ids(*keys: str) -> list[str]:
        return [inds[k]["id"] for k in keys]

    return [
        {
            "dashboard": {
                "name": "Primary Care at a Glance",
                "description": (
                    "Statewide maternal, child health, immunisation and facility-readiness "
                    "indicators from the Primary Healthcare assessment (Q2 2026)."
                ),
                "scope": "sector",
                "sector_id": health_id,
                "lga_id": None,
                "published": True,
                "sort_order": 0,
            },
            "widgets": [
                {
                    "chart_type": "stat",
                    "title": "Latest statewide results",
                    "indicator_ids": ids(
                        "dpt3_coverage",
                        "skilled_birth",
                        "imci",
                        "tracer_medicines",
                    ),
                    "span": 2,
                    "position": 0,
                },
                {
                    "chart_type": "bar",
                    "title": "Distance to target — service delivery",
                    "indicator_ids": ids(
                        "dpt3_coverage",
                        "skilled_birth",
                        "full_immunisation",
                        "tracer_medicines",
                    ),
                    "span": 1,
                    "position": 1,
                },
                {
                    "chart_type": "bar",
                    "title": "Distance to target — systems readiness",
                    "indicator_ids": ids(
                        "phc_scorecard",
                        "ambulance",
                        "doctors_density",
                        "health_budget_share",
                    ),
                    "span": 1,
                    "position": 2,
                },
                {
                    "chart_type": "radar",
                    "title": "Health scorecard",
                    "indicator_ids": ids(
                        "dpt3_coverage",
                        "skilled_birth",
                        "tracer_medicines",
                        "phc_scorecard",
                        "ambulance",
                    ),
                    "span": 2,
                    "position": 3,
                },
            ],
        },
        {
            "dashboard": {
                "name": "Maternal & Child Health",
                "description": (
                    "Under-5, maternal, immunisation and skilled-birth statewide indicators."
                ),
                "scope": "sector",
                "sector_id": health_id,
                "lga_id": None,
                "published": True,
                "sort_order": 1,
            },
            "widgets": [
                {
                    "chart_type": "stat",
                    "title": "MCH headline scores",
                    "indicator_ids": ids(
                        "u5_register",
                        "imci",
                        "bemonc_phc",
                        "skilled_birth",
                    ),
                    "span": 2,
                    "position": 0,
                },
                {
                    "chart_type": "bar",
                    "title": "Immunisation system",
                    "indicator_ids": ids(
                        "dpt3_coverage",
                        "full_immunisation",
                        "cold_chain",
                    ),
                    "span": 1,
                    "position": 1,
                },
                {
                    "chart_type": "radar",
                    "title": "MCH scorecard",
                    "indicator_ids": ids(
                        "imci",
                        "skilled_birth",
                        "bemonc_phc",
                        "dpt3_coverage",
                        "full_immunisation",
                    ),
                    "span": 1,
                    "position": 2,
                },
            ],
        },
        {
            "dashboard": {
                "name": "Health Systems & Gaps",
                "description": (
                    "Facility readiness, medicines, emergency referral and workforce — "
                    "including areas where statewide scores show the largest gaps."
                ),
                "scope": "sector",
                "sector_id": health_id,
                "lga_id": None,
                "published": True,
                "sort_order": 2,
            },
            "widgets": [
                {
                    "chart_type": "stat",
                    "title": "Systems snapshot",
                    "indicator_ids": ids(
                        "phc_scorecard",
                        "tracer_medicines",
                        "ambulance",
                        "doctors_density",
                    ),
                    "span": 2,
                    "position": 0,
                },
                {
                    "chart_type": "bar",
                    "title": "Emergency referral gaps",
                    "indicator_ids": ids(
                        "referral_protocol",
                        "ambulance",
                        "referral_tracking",
                    ),
                    "span": 1,
                    "position": 1,
                },
                {
                    "chart_type": "bar",
                    "title": "Medicines & PHC readiness",
                    "indicator_ids": ids(
                        "eml",
                        "tracer_medicines",
                        "phc_scorecard",
                        "phc_staffing",
                    ),
                    "span": 1,
                    "position": 2,
                },
                {
                    "chart_type": "radar",
                    "title": "Systems scorecard",
                    "indicator_ids": ids(
                        "phc_scorecard",
                        "tracer_medicines",
                        "ambulance",
                        "doctors_density",
                        "bhcpf",
                    ),
                    "span": 2,
                    "position": 3,
                },
            ],
        },
    ]


def existing_health_dashboards(sb: Supabase, health_id: str) -> list[dict]:
    return sb.select(
        f"dashboards?select=id,name,scope,sector_id,published&sector_id=eq.{health_id}"
    )


def apply(sb: Supabase, specs: list[dict], replace: bool) -> None:
    health_id = specs[0]["dashboard"]["sector_id"]
    existing = existing_health_dashboards(sb, health_id)
    if existing and not replace:
        names = ", ".join(d["name"] for d in existing)
        raise RuntimeError(
            f"Health already has {len(existing)} dashboard(s): {names}. "
            "Re-run with --replace to delete them first."
        )
    if existing and replace:
        for d in existing:
            print(f"  deleting dashboard {d['name']} ({d['id']})")
            sb.delete(f"dashboards?id=eq.{d['id']}")

    for spec in specs:
        dash_rows = sb.insert("dashboards", [spec["dashboard"]])
        dash = dash_rows[0]
        print(f"  + dashboard: {dash['name']} ({dash['id']})")
        widgets = []
        for w in spec["widgets"]:
            widgets.append(
                {
                    "dashboard_id": dash["id"],
                    "chart_type": w["chart_type"],
                    "title": w["title"],
                    "indicator_ids": w["indicator_ids"],
                    "span": w["span"],
                    "position": w["position"],
                }
            )
        created = sb.insert("dashboard_widgets", widgets)
        for w in created:
            print(
                f"      widget [{w['chart_type']}] {w.get('title')} "
                f"({len(w['indicator_ids'])} indicators)"
            )


def main() -> int:
    apply_flag = "--apply" in sys.argv
    replace = "--replace" in sys.argv
    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env")
        return 1

    sb = Supabase(url, key)
    sectors = sb.select(f"sectors?select=id,name,slug&slug=eq.{HEALTH_SLUG}")
    if not sectors:
        print("Health sector not found in live DB")
        return 1
    health = sectors[0]
    print(f"Health sector: {health['name']} ({health['id']})\n")
    print("Resolving statewide indicators with results…")
    inds = resolve_indicators(sb, health["id"])
    print(f"\nResolved {len(inds)} / {len(INDICATOR_KEYS)} keys\n")

    specs = build_dashboards(health["id"], inds)
    print("Planned dashboards:")
    for spec in specs:
        d = spec["dashboard"]
        print(f"  • {d['name']} ({len(spec['widgets'])} widgets) — {d['description'][:70]}…")
        for w in spec["widgets"]:
            print(
                f"      [{w['chart_type']}] {w['title']} → {len(w['indicator_ids'])} inds"
            )

    existing = existing_health_dashboards(sb, health["id"])
    if existing:
        print(f"\nExisting Health dashboards: {[d['name'] for d in existing]}")

    if not apply_flag:
        print("\nDry run only. Re-run with --apply to write (add --replace to overwrite).")
        return 0

    print("\nApplying…")
    apply(sb, specs, replace=replace)
    print("\nDone. Open /sectors/health in Live mode to view.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

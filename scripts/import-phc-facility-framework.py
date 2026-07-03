#!/usr/bin/env python3
"""Import the PHC facility indicator framework into Supabase.

This workbook defines *facility/entity-level* PHC indicators. We ignore
domain 00.x ("Facility Identity & Catchment Context") and import domains
01..09 under the dedicated PHC facilities thematic area.

For each workbook row we create:
  - one state-level rollup parent indicator
  - one entity-level child indicator linked via state_indicator_id

State results can then be auto-aggregated from entity results using the
existing cascade logic in the app.

The script is safe to run repeatedly because it uses upserts.
Pass --apply to write to Supabase; otherwise it prints a dry-run summary.
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = Path("/Users/prologic/Downloads/Abia_PHC_Facility_Indicator_Framework.xlsx")

HEALTH_SECTOR_SLUG = "health"
THEMATIC_AREA_NAME = "Primary Healthcare Facilities (PHCs)"

XML_NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
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
        self.ssl_context = ssl._create_unverified_context()

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
            with urllib.request.urlopen(req, context=self.ssl_context) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"{method} {path} -> {err.code}: {err.read().decode()}") from err

    def upsert(self, table: str, rows: list[dict], on_conflict: str):
        if not rows:
            return []
        return self._call(
            "POST",
            f"{table}?on_conflict={on_conflict}",
            rows,
            prefer="return=representation,resolution=merge-duplicates",
        )

    def select(self, path: str):
        return self._call("GET", path)


def load_sheet_rows(path: Path) -> list[list[str]]:
    with ZipFile(path) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall("a:si", XML_NS):
                shared.append("".join(t.text or "" for t in si.iterfind(".//a:t", XML_NS)))

        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}

        sheet_target = None
        for sh in wb.find("a:sheets", XML_NS):
            if sh.attrib["name"] == "PHC Indicator Framework":
                rid = sh.attrib[
                    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                ]
                target = relmap[rid].lstrip("/")
                if not target.startswith("xl/"):
                    target = str(PurePosixPath("xl") / target)
                sheet_target = target
                break
        if not sheet_target:
            raise RuntimeError("Workbook sheet 'PHC Indicator Framework' was not found.")

        def cell_text(cell) -> str:
            ctype = cell.attrib.get("t")
            value = cell.find("a:v", XML_NS)
            if ctype == "inlineStr":
                return "".join(node.text or "" for node in cell.iterfind(".//a:t", XML_NS))
            if value is None:
                return ""
            raw = value.text or ""
            if ctype == "s":
                return shared[int(raw)]
            return raw

        root = ET.fromstring(zf.read(sheet_target))
        rows: list[list[str]] = []
        for row in root.findall(".//a:sheetData/a:row", XML_NS):
            rows.append([cell_text(cell).strip() for cell in row.findall("a:c", XML_NS)])
        return rows


def parse_score_options(guidance: str) -> list[dict] | None:
    parts = [part.strip().rstrip(".") for part in guidance.split(";") if part.strip()]
    options = []
    for part in parts:
        m = re.match(r"^(.*?)\s*=\s*(-?\d+(?:\.\d+)?)$", part)
        if not m:
            continue
        label = m.group(1).strip()
        value = float(m.group(2))
        options.append({"label": label, "value": value})
    if len(options) < 2:
        return None

    max_value = max(option["value"] for option in options)
    min_value = min(option["value"] for option in options)
    scale = 100 if max_value <= 1 and min_value >= 0 else 1
    normalized = []
    for idx, option in enumerate(options):
        normalized.append(
            {
                "code": chr(ord("A") + idx),
                "label": option["label"],
                "value": round(option["value"] * scale, 2),
            }
        )
    return normalized


def infer_value_type(workbook_type: str) -> str:
    value = workbook_type.strip().lower()
    if value == "score":
        return "score"
    if value == "percentage":
        return "percentage"
    if value in {"number", "currency"}:
        return "number"
    raise RuntimeError(f"Unsupported workbook value type after filtering: {workbook_type}")


def infer_unit(entry: dict) -> str:
    workbook_type = entry["workbook_value_type"].strip().lower()
    name = entry["name"].lower()
    if workbook_type in {"score", "percentage"}:
        return "%"
    if workbook_type == "currency":
        return "NGN"
    if "days" in name:
        return "days"
    if "deliver" in name:
        return "deliveries"
    if "visit" in name or "attendance" in name:
        return "visits"
    if "output" in name:
        return "cases"
    return "count"


def parse_first_number(text: str) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    return float(match.group(0)) if match else None


def infer_direction(entry: dict) -> str:
    text = " ".join(
        [
            entry["name"].lower(),
            entry["target_standard"].lower(),
            entry["guidance"].lower(),
        ]
    )
    if any(
        token in text
        for token in [
            "stock-out",
            "stock out",
            "days = 1",
            "response time",
            "less than",
            "<",
            "below",
        ]
    ):
        return "lower_is_better"
    return "higher_is_better"


def infer_target_value(entry: dict, direction: str, value_type: str) -> float | None:
    if value_type == "score":
        return 100.0

    target_text = entry["target_standard"]
    guidance = entry["guidance"]

    if value_type == "percentage":
        numbers = re.findall(r"(-?\d+(?:\.\d+)?)\s*%", target_text + " " + guidance)
        if numbers:
            if direction == "higher_is_better":
                return float(numbers[0])
            return float(numbers[-1])
        return 100.0

    target_num = parse_first_number(target_text)
    if target_num is not None:
        return target_num

    if direction == "lower_is_better":
        zeroish = re.search(r"\b0(?:\.0+)?\b", guidance)
        if zeroish:
            return 0.0

    return None


def build_description(entry: dict) -> str:
    parts = [
        f"Definition: {entry['definition']}",
        f"Operational standard: {entry['target_standard']}",
        f"Scoring guidance: {entry['guidance']}",
        f"Primary data source: {entry['source']}",
        f"Verification evidence: {entry['evidence']}",
        f"Collection frequency: {entry['frequency']}",
        f"Workbook value type: {entry['workbook_value_type']}",
    ]
    return "\n\n".join(parts)


def parse_framework(path: Path) -> list[dict]:
    rows = load_sheet_rows(path)
    header_idx = next(
        i
        for i, row in enumerate(rows)
        if row[:4]
        == [
            "Domain No.",
            "Domain",
            "Indicator No.",
            "Facility-level indicator / data field",
        ]
    )

    entries: list[dict] = []
    for row in rows[header_idx + 1 :]:
        if len(row) < 12 or not row[0] or not row[2]:
            continue
        domain_no = row[0].strip()
        if domain_no == "00":
            continue
        entry = {
            "domain_no": domain_no,
            "domain_name": row[1].strip(),
            "indicator_no": row[2].strip(),
            "name": row[3].strip(),
            "definition": row[4].strip(),
            "target_standard": row[5].strip(),
            "guidance": row[6].strip(),
            "workbook_value_type": row[7].strip(),
            "source": row[8].strip(),
            "evidence": row[9].strip(),
            "frequency": row[10].strip(),
            "weight": float(row[11] or 0),
        }
        value_type = infer_value_type(entry["workbook_value_type"])
        direction = infer_direction(entry)
        target_value = infer_target_value(entry, direction, value_type)
        entry.update(
            {
                "value_type": value_type,
                "direction": direction,
                "target_value": target_value,
                "unit": infer_unit(entry),
                "score_options": parse_score_options(entry["guidance"])
                if value_type == "score"
                else None,
                "description": build_description(entry),
            }
        )
        entries.append(entry)
    return entries


def domain_payload(entries: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], float] = defaultdict(float)
    for entry in entries:
        grouped[(entry["domain_no"], entry["domain_name"])] += entry["weight"]
    return [
        {
            "thematic_area_id": THEMATIC_AREA_ID,
            "name": f"{domain_no} — {domain_name}",
            "description": "PHC facility-level performance domain imported from the facility framework.",
            "weight": round(weight, 6),
        }
        for (domain_no, domain_name), weight in sorted(grouped.items())
    ]


def indicator_name(entry: dict) -> str:
    return f"{entry['indicator_no']} {entry['name']}"


def main() -> int:
    apply = "--apply" in sys.argv[1:]
    entries = parse_framework(XLSX_PATH)
    domains = domain_payload(entries)

    print(
        f"Parsed {len(domains)} PHC facility domains and {len(entries)} facility indicators "
        f"(excluding 00.x identity rows)."
    )
    print(
        "Value types:",
        {
            key: sum(1 for entry in entries if entry["value_type"] == key)
            for key in sorted({entry["value_type"] for entry in entries})
        },
    )

    if not apply:
        print("\nDry run only. Re-run with --apply to upsert domains and indicators.")
        for domain in domains:
            count = sum(1 for entry in entries if domain["name"].startswith(entry["domain_no"]))
            print(f"  {domain['name']}: weight {domain['weight']} · {count} indicators")
        return 0

    env = load_env()
    sb = Supabase(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    health_sector = sb.select(f"sectors?select=id,name&slug=eq.{HEALTH_SECTOR_SLUG}")[0]
    thematic_area = sb.upsert(
        "thematic_areas",
        [
            {
                "sector_id": health_sector["id"],
                "name": THEMATIC_AREA_NAME,
                "description": "Facility-level PHC readiness, service delivery, quality, reporting and accountability indicators.",
                "frequency": "quarterly",
                "weight": 1,
            }
        ],
        on_conflict="sector_id,name",
    )[0]

    domains = [
        {
            **domain,
            "thematic_area_id": thematic_area["id"],
        }
        for domain in domains
    ]
    domain_rows = sb.upsert("domains", domains, on_conflict="thematic_area_id,name")
    domain_id_by_name = {row["name"]: row["id"] for row in domain_rows}

    state_payload = []
    for entry in entries:
        domain_name = f"{entry['domain_no']} — {entry['domain_name']}"
        state_payload.append(
            {
                "domain_id": domain_id_by_name[domain_name],
                "indicator_scope": "state",
                "state_indicator_id": None,
                "name": indicator_name(entry),
                "description": entry["description"],
                "value_type": entry["value_type"],
                "score_options": entry["score_options"],
                "unit": entry["unit"],
                "direction": entry["direction"],
                "target_value": entry["target_value"],
                "target_source": "Abia PHC Facility Indicator Framework",
                "weight": entry["weight"],
            }
        )
    state_rows = sb.upsert("indicators", state_payload, on_conflict="domain_id,name,indicator_scope")
    state_id_by_key = {
        (row["domain_id"], row["name"], row["indicator_scope"]): row["id"] for row in state_rows
    }

    entity_payload = []
    for entry in entries:
        domain_name = f"{entry['domain_no']} — {entry['domain_name']}"
        domain_id = domain_id_by_name[domain_name]
        name = indicator_name(entry)
        entity_payload.append(
            {
                "domain_id": domain_id,
                "indicator_scope": "entity",
                "state_indicator_id": state_id_by_key[(domain_id, name, "state")],
                "name": name,
                "description": entry["description"],
                "value_type": entry["value_type"],
                "score_options": entry["score_options"],
                "unit": entry["unit"],
                "direction": entry["direction"],
                "target_value": entry["target_value"],
                "target_source": "Abia PHC Facility Indicator Framework",
                "weight": entry["weight"],
            }
        )
    entity_rows = sb.upsert("indicators", entity_payload, on_conflict="domain_id,name,indicator_scope")

    print(
        f"\nUpserted {len(domain_rows)} domains, {len(state_rows)} state rollup indicators, "
        f"and {len(entity_rows)} entity indicators."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

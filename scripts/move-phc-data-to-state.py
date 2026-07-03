#!/usr/bin/env python3
"""Promote PHC field responses to state-level results, then remove PHC indicators.

The Phase 1 health assessment questions are state-level in nature ("Does the
State maintain..."), so entity-level (PHC) copies do not make sense. This
script:

1. Picks the PHC with the most complete response set.
2. For every entity indicator, overwrites its linked state indicator's
   state-level result (entity_id null) with that PHC's response value
   (falling back to any other PHC's answer when the chosen one is missing).
3. Deletes all entity-scoped indicators; their entity-level results are
   removed by the ON DELETE CASCADE on results.indicator_id.

Domains are left untouched: they hold the state-level indicators.

Run with --dry-run to preview without writing.
"""

from __future__ import annotations

import json
import ssl
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRY_RUN = "--dry-run" in sys.argv


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
        with urllib.request.urlopen(req, context=self.ssl_context) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None

    def fetch_all(self, table: str, order_by: str):
        rows = []
        page_size = 1000
        for start in range(0, 1_000_000, page_size):
            end = start + page_size - 1
            headers = {
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Range-Unit": "items",
                "Range": f"{start}-{end}",
            }
            req = urllib.request.Request(
                f"{self.base}/{table}?select=*&order={urllib.parse.quote(order_by)}",
                headers=headers,
                method="GET",
            )
            with urllib.request.urlopen(req, context=self.ssl_context) as resp:
                batch = json.loads(resp.read().decode() or "[]")
            rows.extend(batch)
            if len(batch) < page_size:
                break
        return rows

    def select(self, path: str):
        return self._call("GET", path)

    def patch(self, table: str, match: str, body: dict):
        return self._call("PATCH", f"{table}?{match}", body, prefer="return=representation")

    def insert(self, table: str, rows: list[dict]):
        return self._call("POST", table, rows, prefer="return=representation")

    def delete(self, table: str, match: str):
        return self._call("DELETE", f"{table}?{match}", prefer="return=representation")


def main():
    env = load_env()
    sb = Supabase(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    indicators = sb.fetch_all("indicators", "name")
    results = sb.fetch_all("results", "id")
    entities = {e["id"]: e["name"] for e in sb.fetch_all("entities", "name")}

    entity_indicators = [
        i for i in indicators if i.get("indicator_scope") == "entity" and i.get("state_indicator_id")
    ]
    entity_indicator_ids = {i["id"] for i in entity_indicators}
    parent_by_child = {i["id"]: i["state_indicator_id"] for i in entity_indicators}

    # entity results keyed by (indicator, period) -> {entity_id: value}
    responses: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    per_entity_counts: dict[str, int] = defaultdict(int)
    for r in results:
        if r["indicator_id"] in entity_indicator_ids and r.get("entity_id"):
            responses[(r["indicator_id"], r["time_period_id"])][r["entity_id"]] = float(r["abia_value"])
            per_entity_counts[r["entity_id"]] += 1

    if not responses:
        print("No entity-level responses found; nothing to do.")
        return

    # Most complete PHC wins; name as deterministic tie-break.
    source_entity = max(per_entity_counts, key=lambda e: (per_entity_counts[e], entities.get(e, "")))
    print("Response counts per PHC:")
    for eid, count in sorted(per_entity_counts.items(), key=lambda x: -x[1]):
        marker = "  <-- source" if eid == source_entity else ""
        print(f"  {entities.get(eid, eid):<28}{count:>4}{marker}")

    # state results keyed by (indicator, period) -> result id
    state_result_id: dict[tuple[str, str], str] = {}
    for r in results:
        if r.get("entity_id") is None:
            state_result_id[(r["indicator_id"], r["time_period_id"])] = r["id"]

    moved = fallback = inserted = 0
    for (child_id, period_id), by_entity in responses.items():
        parent_id = parent_by_child[child_id]
        if source_entity in by_entity:
            value = by_entity[source_entity]
            note = f"State-level response recorded via {entities.get(source_entity, 'PHC')} field assessment."
        else:
            other = sorted(by_entity, key=lambda e: entities.get(e, ""))[0]
            value = by_entity[other]
            note = f"State-level response recorded via {entities.get(other, 'PHC')} field assessment."
            fallback += 1

        key = (parent_id, period_id)
        if DRY_RUN:
            moved += 1
            continue
        if key in state_result_id:
            sb.patch("results", f"id=eq.{state_result_id[key]}", {"abia_value": value, "notes": note})
        else:
            sb.insert("results", [{
                "indicator_id": parent_id,
                "time_period_id": period_id,
                "entity_id": None,
                "abia_value": value,
                "notes": note,
            }])
            inserted += 1
        moved += 1

    print(f"\nState results updated: {moved} ({inserted} newly created, {fallback} from fallback PHCs)")

    if DRY_RUN:
        print(f"[dry run] would delete {len(entity_indicators)} entity indicators")
        return

    deleted = sb.delete("indicators", "indicator_scope=eq.entity")
    print(f"Deleted {len(deleted or [])} entity-scoped indicators (entity results removed by cascade).")


if __name__ == "__main__":
    main()

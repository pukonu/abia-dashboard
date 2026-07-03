#!/usr/bin/env python3
"""Split mixed indicators into entity indicators + linked state indicators.

For any indicator that already has entity-level results:
- mark the existing indicator as entity-level
- create a same-name state-level indicator in the same domain
- link the entity indicator to the state indicator
- move any existing state rows (entity_id null) to the state indicator
- recompute state rows from entity rows for every affected time period
"""

from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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
        for start in range(0, 1000000, page_size):
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

    def patch(self, table: str, match: str, body: dict):
        return self._call("PATCH", f"{table}?{match}", body, prefer="return=representation")

    def upsert(self, table: str, rows: list[dict], on_conflict: str):
        return self._call(
            "POST",
            f"{table}?on_conflict={on_conflict}",
            rows,
            prefer="return=representation,resolution=merge-duplicates",
        )

    def select(self, path: str):
        return self._call("GET", path)


def main():
    env = load_env()
    sb = Supabase(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    indicators = sb.fetch_all("indicators", "name")
    results = sb.fetch_all("results", "id")

    results_by_indicator = defaultdict(list)
    for r in results:
        results_by_indicator[r["indicator_id"]].append(r)

    migrated = 0
    for ind in indicators:
        rows = results_by_indicator.get(ind["id"], [])
        entity_rows = [r for r in rows if r.get("entity_id") is not None]
        if not entity_rows:
            continue
        if ind.get("state_indicator_id"):
            continue

        sb.patch("indicators", f"id=eq.{ind['id']}", {"indicator_scope": "entity"})
        parent = sb.upsert(
            "indicators",
            [
                {
                    "domain_id": ind["domain_id"],
                    "indicator_scope": "state",
                    "name": ind["name"],
                    "description": ind.get("description"),
                    "unit": ind.get("unit"),
                    "direction": ind.get("direction"),
                    "target_value": ind.get("target_value"),
                    "target_source": ind.get("target_source"),
                    "weight": ind.get("weight"),
                }
            ],
            on_conflict="domain_id,name,indicator_scope",
        )[0]

        sb.patch("indicators", f"id=eq.{ind['id']}", {"state_indicator_id": parent["id"]})
        sb.patch(
            "results",
            f"indicator_id=eq.{ind['id']}&entity_id=is.null",
            {"indicator_id": parent["id"]},
        )

        by_period = defaultdict(list)
        for r in entity_rows:
            by_period[r["time_period_id"]].append(float(r["abia_value"]))
        for period_id, values in by_period.items():
            mean = round(sum(values) / len(values), 2)
            existing = sb.select(
                f"results?select=id&indicator_id=eq.{parent['id']}&time_period_id=eq.{period_id}&entity_id=is.null"
            )
            payload = {
                "abia_value": mean,
                "nigeria_value": None,
                "target_value": None,
                "notes": "Auto-aggregated from linked entity-level indicator results.",
            }
            if existing:
                sb.patch("results", f"id=eq.{existing[0]['id']}", payload)
            else:
                sb._call(
                    "POST",
                    "results",
                    [
                        {
                            "indicator_id": parent["id"],
                            "time_period_id": period_id,
                            "entity_id": None,
                            **payload,
                        }
                    ],
                    prefer="return=representation",
                )
        migrated += 1
        print(f"migrated {ind['name']} -> state parent {parent['id']}")

    print(f"done; migrated {migrated} indicator(s)")


if __name__ == "__main__":
    main()

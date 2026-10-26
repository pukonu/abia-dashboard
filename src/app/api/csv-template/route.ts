import { NextRequest } from "next/server";
import { loadDashboardData } from "@/lib/datasource";
import { collectedAt } from "@/lib/indicator-collection";
import { formatScoreOptionsText } from "@/lib/indicator-input";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Downloadable CSV template for bulk result upload, prefilled with every
 * indicator and its current reporting period. Users fill abia_value
 * (and optionally nigeria_value / target_value / notes) and upload the
 * file back on /manage/results.
 *
 * One template per collection level:
 *   ?scope=state     statewide indicators (default)
 *   ?scope=lgas      LGA-collected indicators, one row per LGA
 *   ?scope=entities  facility-collected indicators, one row per facility in
 *                    the indicator's sector
 * Statewide overrides of LGA/facility indicators go in the state template
 * with an override_note.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("scope");
  const scope = raw === "entities" ? "entities" : raw === "lgas" ? "lgas" : "state";
  const level = scope === "entities" ? "facility" : scope === "lgas" ? "lga" : "state";
  const data = await loadDashboardData();

  const domainById = new Map(data.domains.map((d) => [d.id, d]));
  const thematicById = new Map(data.thematicAreas.map((t) => [t.id, t]));
  const sectorById = new Map(data.sectors.map((s) => [s.id, s]));
  const lgaById = new Map(data.lgas.map((l) => [l.id, l]));
  const mdaById = new Map(data.mdas.map((m) => [m.id, m]));

  // Latest period per frequency
  const latestByFreq = new Map<string, (typeof data.timePeriods)[number]>();
  for (const p of data.timePeriods) {
    const current = latestByFreq.get(p.frequency);
    if (!current || p.start_date > current.start_date) latestByFreq.set(p.frequency, p);
  }

  const header = [
    "indicator_id", "indicator_name", "value_type", "score_options", "unit", "direction", "sector",
    "time_period_id", "period_label",
    "entity_id", "entity_name", "lga_id", "lga",
    "abia_value", "nigeria_value", "target_value", "notes", "override_note",
  ];
  const lines: string[] = [header.join(",")];

  for (const ind of data.indicators) {
    if (collectedAt(ind) !== level) continue;
    const domain = domainById.get(ind.domain_id);
    const thematic = domain ? thematicById.get(domain.thematic_area_id) : undefined;
    const sector = thematic ? sectorById.get(thematic.sector_id) : undefined;
    const period = thematic ? latestByFreq.get(thematic.frequency) : undefined;
    if (!thematic || !sector || !period) continue;

    const base = [
      ind.id, ind.name, ind.value_type, formatScoreOptionsText(ind.score_options), ind.unit, ind.direction, sector.name,
      period.id, period.label,
    ];

    if (scope === "state") {
      lines.push([...base, "", "(whole state)", "", "", "", "", ind.target_value ?? "", "", ""].map(csvCell).join(","));
    } else if (scope === "lgas") {
      for (const lga of data.lgas) {
        lines.push(
          [...base, "", "", lga.id, lga.name, "", "", ind.lga_target_value ?? ind.target_value ?? "", "", ""]
            .map(csvCell)
            .join(",")
        );
      }
    } else {
      const sectorEntities = data.entities.filter(
        (e) => mdaById.get(e.mda_id)?.sector_id === sector.id
      );
      for (const ent of sectorEntities) {
        lines.push(
          [...base, ent.id, ent.name, ent.lga_id, lgaById.get(ent.lga_id)?.name ?? "", "", "", ind.facility_target_value ?? ind.target_value ?? "", "", ""]
            .map(csvCell)
            .join(",")
        );
      }
    }
  }

  const filename = `abia-results-template-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

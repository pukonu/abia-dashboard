import type { Computed } from "./scoring";
import type { DashboardData, Sector } from "./types";

const MIX_COLORS = ["#14683c", "#2563eb", "#e11d48", "#d97706", "#7c3aed", "#0891b2"];

export interface ExecutiveStat {
  label: string;
  value: string;
  caption: string;
}

export interface MixSlice {
  label: string;
  value: number;
  color: string;
}

function fmt(value: number, digits = 0): string {
  return value.toLocaleString("en-NG", { maximumFractionDigits: digits });
}

function pluralizeType(type: string, count: number): string {
  if (count === 1) return type;
  if (/[sxz]$/i.test(type)) return `${type}es`;
  if (/y$/i.test(type)) return `${type.slice(0, -1)}ies`;
  return `${type}s`;
}

export function entityMix(data: DashboardData, sectorId?: string): MixSlice[] {
  const mdaIds = new Set(
    data.mdas.filter((mda) => !sectorId || mda.sector_id === sectorId).map((mda) => mda.id)
  );
  const counts = new Map<string, number>();
  for (const entity of data.entities) {
    if (!mdaIds.has(entity.mda_id)) continue;
    counts.set(entity.entity_type, (counts.get(entity.entity_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: MIX_COLORS[index % MIX_COLORS.length] }));
}

export function stateExecutiveStats(data: DashboardData, c: Computed): ExecutiveStat[] {
  const lgasWithReadings = c.lgaScores.filter((lga) => lga.score != null).length;
  const measuredEntities = data.entities.length;
  const resultRows = data.results.length;
  const trackedIndicators = data.indicators.length;

  return [
    {
      label: "Sectors tracked",
      value: fmt(data.sectors.length),
      caption: "Health, education, security and other priority areas as they are added.",
    },
    {
      label: "Measured entities",
      value: fmt(measuredEntities),
      caption: "Facilities, schools, commands, projects and service points feeding the dashboard.",
    },
    {
      label: "Indicators configured",
      value: fmt(trackedIndicators),
      caption: "State and entity-level datapoints that can be updated each reporting cycle.",
    },
    {
      label: "LGAs with readings",
      value: `${fmt(lgasWithReadings)} / ${fmt(data.lgas.length)}`,
      caption: "Local government coverage available for ranking and drill-down.",
    },
    {
      label: "Recorded results",
      value: fmt(resultRows),
      caption: "Individual values currently powering the demo and live dashboards.",
    },
  ];
}

export function abiaFootprintStats(data: DashboardData): ExecutiveStat[] {
  // Statewide / sector roll-up indicators only — not facility-level entity readings.
  const sectorIndicatorCount = data.indicators.filter(
    (indicator) => indicator.indicator_scope !== "entity"
  ).length;

  const counts = new Map<string, number>();
  for (const entity of data.entities) {
    counts.set(entity.entity_type, (counts.get(entity.entity_type) ?? 0) + 1);
  }

  const preferred = [
    ["General Hospital", "General hospitals", "Secondary-care hospitals serving LGA and zonal needs."],
    ["Specialist Hospital", "Specialist hospitals", "Higher-level referral assets for complex care."],
    ["Primary School", "Primary schools", "Basic education access points across local communities."],
    ["Secondary School", "Secondary schools", "Post-primary schools supporting skills and progression."],
    ["Road Project", "Road projects", "Visible infrastructure works that connect commerce and services."],
    ["Primary Health Centre", "Primary healthcare centres", "Frontline PHCs where residents meet the health system first."],
  ] as const;

  const assetStats = preferred
    .map(([type, label, caption]) => ({ label, value: counts.get(type) ?? 0, caption }))
    .filter((stat) => stat.value > 0)
    .map((stat) => ({ ...stat, value: fmt(stat.value) }));

  const used = new Set<string>(preferred.map(([type]) => type));
  const fallback = [...counts.entries()]
    .filter(([type]) => !used.has(type))
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      label: pluralizeType(type, count),
      value: fmt(count),
      caption: "Measured Abia service or project asset.",
    }));

  const assets = [...assetStats, ...fallback].slice(0, 5);

  return [
    {
      label: "Sector indicators",
      value: fmt(sectorIndicatorCount),
      caption:
        "Statewide measures rolled up by sector on the executive dashboard — excludes facility-level entity readings.",
    },
    ...assets,
  ];
}

export function sectorIndicatorMix(data: DashboardData): MixSlice[] {
  const domainById = new Map(data.domains.map((domain) => [domain.id, domain]));
  const thematicById = new Map(data.thematicAreas.map((thematic) => [thematic.id, thematic]));
  const counts = new Map<string, number>();

  for (const indicator of data.indicators) {
    if (indicator.indicator_scope === "entity") continue;
    const domain = domainById.get(indicator.domain_id);
    const thematic = domain ? thematicById.get(domain.thematic_area_id) : undefined;
    if (!thematic) continue;
    counts.set(thematic.sector_id, (counts.get(thematic.sector_id) ?? 0) + 1);
  }

  return data.sectors
    .map((sector, index) => ({
      label: sector.name,
      value: counts.get(sector.id) ?? 0,
      color: sector.color || MIX_COLORS[index % MIX_COLORS.length],
    }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function sectorExecutiveStats(data: DashboardData, c: Computed, sector: Sector): ExecutiveStat[] {
  const mdas = data.mdas.filter((mda) => mda.sector_id === sector.id);
  const mdaIds = new Set(mdas.map((mda) => mda.id));
  const entities = data.entities.filter((entity) => mdaIds.has(entity.mda_id));
  const stateIndicators = c.indicators.filter(
    (item) => item.sector.id === sector.id && item.indicator.indicator_scope !== "entity"
  );
  const entityIndicators = data.indicators.filter((indicator) => {
    const domain = data.domains.find((d) => d.id === indicator.domain_id);
    const thematic = domain ? data.thematicAreas.find((t) => t.id === domain.thematic_area_id) : null;
    return thematic?.sector_id === sector.id && indicator.indicator_scope === "entity";
  });
  const bestThematic = data.thematicAreas
    .filter((thematic) => thematic.sector_id === sector.id)
    .map((thematic) => ({ thematic, score: c.thematicScores.get(thematic.id)?.score ?? null }))
    .filter((item) => item.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const topEntity = c.entityScores
    .filter((entity) => entity.sector.id === sector.id && entity.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return [
    {
      label: "Delivery footprint",
      value: fmt(entities.length),
      caption: `${mdas.length} MDA${mdas.length === 1 ? "" : "s"} overseeing measured service points.`,
    },
    {
      label: "Sector indicators",
      value: fmt(stateIndicators.length + entityIndicators.length),
      caption: `${stateIndicators.length} statewide and ${entityIndicators.length} facility-level measures.`,
    },
    {
      label: "Strongest theme",
      value: bestThematic ? `${fmt(bestThematic.score ?? 0, 1)}%` : "-",
      caption: bestThematic?.thematic.name ?? "No thematic results recorded yet.",
    },
    {
      label: "Leading entity",
      value: topEntity ? `${fmt(topEntity.score ?? 0, 1)}%` : "-",
      caption: topEntity ? `${topEntity.entity.name}, ${topEntity.lga.name}` : "Entity readings will appear here.",
    },
  ];
}

export function entityFactStats(mix: MixSlice[]): ExecutiveStat[] {
  return mix.slice(0, 4).map((slice) => ({
    label: pluralizeType(slice.label, slice.value),
    value: fmt(slice.value),
    caption: "Measured service point",
  }));
}

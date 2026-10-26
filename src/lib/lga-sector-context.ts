import type { Computed, EntityComputed, LgaIndicatorValue, ScorePair } from "./scoring";
import { weightedMean } from "./scoring";
import type { DashboardData, Lga, Mda, Sector } from "./types";

const MIX_COLORS = ["#14683c", "#2563eb", "#e11d48", "#d97706", "#7c3aed", "#0891b2"];

export interface LgaSectorMda {
  mda: Mda;
  score: number | null;
  prevScore: number | null;
  entityCount: number;
}

/** Latest values of the sector's LGA- and facility-collected indicators in one LGA. */
export function sectorIndicatorsForLga(c: Computed, sector: Sector, lga: Lga): LgaIndicatorValue[] {
  return c.lgaIndicators.filter((v) => v.lga.id === lga.id && v.ic.sector.id === sector.id);
}

/** A sector's score inside an LGA: its LGA returns and facility roll-ups there. */
export function sectorPairForLga(c: Computed, sector: Sector, lga: Lga): ScorePair {
  const values = sectorIndicatorsForLga(c, sector, lga);
  return {
    score: weightedMean(values.map((v) => ({ score: v.score, weight: v.ic.indicator.weight }))),
    prevScore: weightedMean(values.map((v) => ({ score: v.prevScore, weight: v.ic.indicator.weight }))),
  };
}

export function sectorEntitiesForLga(c: Computed, sector: Sector, lga: Lga): EntityComputed[] {
  return c.entityScores.filter((item) => item.sector.id === sector.id && item.lga.id === lga.id);
}

export function sectorMixForLga(entities: EntityComputed[]) {
  const counts = new Map<string, number>();
  for (const item of entities) {
    counts.set(item.entity.entity_type, (counts.get(item.entity.entity_type) ?? 0) + 1);
  }
  return Array.from(counts, ([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
    .map((item, index) => ({ ...item, color: MIX_COLORS[index % MIX_COLORS.length] }));
}

export function sectorMdasForLga(data: DashboardData, entities: EntityComputed[]): LgaSectorMda[] {
  const byMda = new Map<string, EntityComputed[]>();
  for (const item of entities) {
    const list = byMda.get(item.mda.id) ?? [];
    list.push(item);
    byMda.set(item.mda.id, list);
  }

  return Array.from(byMda, ([mdaId, items]) => {
    const mda = data.mdas.find((candidate) => candidate.id === mdaId) ?? items[0].mda;
    return {
      mda,
      score: weightedMean(items.map((item) => ({ score: item.score, weight: 1 }))),
      prevScore: weightedMean(items.map((item) => ({ score: item.prevScore, weight: 1 }))),
      entityCount: items.length,
    };
  }).sort((a, b) => a.mda.name.localeCompare(b.mda.name, undefined, { numeric: true, sensitivity: "base" }));
}

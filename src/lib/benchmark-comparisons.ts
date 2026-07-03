import type { Domain } from "@/lib/types";
import {
  benchmarkScore,
  type Computed,
  scoreValue,
  weightedMean,
} from "@/lib/scoring";

export function domainNigeriaScore(c: Computed, domain: Domain): number | null {
  const direct = weightedMean(
    c.indicators
      .filter((i) => i.domain.id === domain.id && i.indicator.indicator_scope !== "entity")
      .map((i) => ({
        score:
          i.latest?.nigeria != null
            ? scoreValue(
                i.latest.nigeria,
                i.latest?.target ?? i.indicator.target_value,
                i.indicator.direction
              )
            : null,
        weight: i.indicator.weight,
      }))
  );

  if (direct != null) return direct;
  return benchmarkScore(domain.benchmark_nigeria, domain.benchmark_target);
}

export function sectorNigeriaScore(c: Computed, sectorId: string): number | null {
  const thematicIds = new Set(
    c.data.thematicAreas.filter((t) => t.sector_id === sectorId).map((t) => t.id)
  );
  return weightedMean(
    c.data.domains
      .filter((d) => thematicIds.has(d.thematic_area_id))
      .map((d) => ({
        score: domainNigeriaScore(c, d),
        weight: d.weight,
      }))
  );
}

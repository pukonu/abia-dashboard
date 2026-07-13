import type {
  DashboardData,
  Direction,
  Domain,
  Entity,
  Indicator,
  Lga,
  Mda,
  Result,
  Sector,
  ThematicArea,
  TimePeriod,
} from "./types";
import { indicatorFrequency } from "./indicator-frequency";
import { isIndicatorPublic } from "./visibility";

/* ------------------------------------------------------------------ */
/* Score normalization                                                 */
/*                                                                     */
/* Every raw result is converted to a 0–100 performance score against  */
/* its target, so scores can be composited across units and sectors:   */
/*   higher_is_better : score = 100 × value / target   (capped at 100) */
/*   lower_is_better  : score = 100 × target / value   (capped at 100) */
/* ------------------------------------------------------------------ */

export function scoreValue(
  value: number,
  target: number | null,
  direction: Direction
): number | null {
  if (target == null || target <= 0) return null;
  if (value < 0) return null;
  if (direction === "higher_is_better") {
    return Math.min(100, (value / target) * 100);
  }
  if (value <= target) return 100;
  return Math.min(100, (target / value) * 100);
}

export interface RatingBand {
  label: string;
  color: string; // hex used for chart accents / presentation on dark bg
  textClass: string;
  bgClass: string;
}

/**
 * Traffic bands vs target (score is already 0–100 % of expectation):
 * - Excellent (~100%): sky blue
 * - Meets / just passes: green
 * - Close: orange
 * - Off track: red
 */
export function ratingFor(score: number | null): RatingBand {
  if (score == null)
    return {
      label: "No data",
      color: "#ef4444",
      textClass: "text-red-800 dark:text-red-300",
      bgClass: "border border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-950/60",
    };
  if (score >= 95)
    return {
      label: "Excellent",
      color: "#38bdf8", // sky-400 — readable on dark presentation bg
      textClass: "text-sky-800 dark:text-sky-300",
      bgClass: "bg-sky-50 dark:bg-sky-950",
    };
  if (score >= 70)
    return {
      label: "Meets expectation",
      color: "#22c55e", // green-500
      textClass: "text-green-800 dark:text-green-300",
      bgClass: "bg-green-50 dark:bg-green-950",
    };
  if (score >= 50)
    return {
      label: "Close",
      color: "#f97316", // orange-500
      textClass: "text-orange-800 dark:text-orange-300",
      bgClass: "bg-orange-50 dark:bg-orange-950",
    };
  return {
    label: "Off track",
    color: "#ef4444", // red-500
    textClass: "text-red-800 dark:text-red-300",
    bgClass: "bg-red-50 dark:bg-red-950",
  };
}

export function weightedMean(items: Array<{ score: number | null; weight: number }>): number | null {
  let sum = 0;
  let wsum = 0;
  for (const it of items) {
    if (it.score == null) continue;
    sum += it.score * it.weight;
    wsum += it.weight;
  }
  return wsum > 0 ? sum / wsum : null;
}

export function parseBenchmarkValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const m = String(value)
    .replaceAll(",", "")
    .match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function benchmarkDirection(target: string | null | undefined): Direction {
  return /[<≤]/.test(target ?? "") ? "lower_is_better" : "higher_is_better";
}

export function benchmarkScore(
  nigeria: string | number | null | undefined,
  target: string | number | null | undefined,
  direction?: Direction | null
): number | null {
  const nigeriaValue = parseBenchmarkValue(nigeria);
  const targetValue = parseBenchmarkValue(target);
  if (nigeriaValue == null || targetValue == null) return null;
  return scoreValue(nigeriaValue, targetValue, direction ?? benchmarkDirection(String(target ?? "")));
}

/* ------------------------------------------------------------------ */
/* Computed model                                                      */
/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  period: TimePeriod;
  abia: number;
  nigeria: number | null;
  target: number | null;
  score: number | null;
}

export interface IndicatorComputed {
  indicator: Indicator;
  domain: Domain;
  thematicArea: ThematicArea;
  sector: Sector;
  /** state-level results in chronological order */
  series: SeriesPoint[];
  latest: SeriesPoint | null;
  previous: SeriesPoint | null;
  score: number | null;
  prevScore: number | null;
}

export interface ScorePair {
  score: number | null;
  prevScore: number | null;
}

export interface LgaComputed extends ScorePair {
  lga: Lga;
  /** number of entity-level indicator readings feeding the composite */
  readings: number;
  entityIds: string[];
}

export interface MdaComputed extends ScorePair {
  mda: Mda;
  sector: Sector;
  entityCount: number;
}

export interface EntityComputed extends ScorePair {
  entity: Entity;
  mda: Mda;
  lga: Lga;
  sector: Sector;
  readings: number;
}

export interface TrendPoint {
  label: string;
  date: string;
  state: number | null;
  /** sector slug → composite score as of this date */
  sectors: Record<string, number | null>;
}

export interface Computed {
  data: DashboardData;
  indicators: IndicatorComputed[];
  indicatorById: Map<string, IndicatorComputed>;
  domainScores: Map<string, ScorePair>;
  thematicScores: Map<string, ScorePair>;
  sectorScores: Map<string, ScorePair>;
  stateScore: ScorePair;
  lgaScores: LgaComputed[];
  mdaScores: MdaComputed[];
  entityScores: EntityComputed[];
  /** quarterly composite trend for the state and each sector */
  trend: TrendPoint[];
}

/* ------------------------------------------------------------------ */

export function computeDashboard(data: DashboardData): Computed {
  const periodById = new Map(data.timePeriods.map((p) => [p.id, p]));
  const domainById = new Map(data.domains.map((d) => [d.id, d]));
  const thematicById = new Map(data.thematicAreas.map((t) => [t.id, t]));
  const sectorById = new Map(data.sectors.map((s) => [s.id, s]));
  const indicatorById = new Map(data.indicators.map((i) => [i.id, i]));
  const mdaById = new Map(data.mdas.map((m) => [m.id, m]));
  const lgaById = new Map(data.lgas.map((l) => [l.id, l]));
  const isStateIndicator = (ind: Indicator) => ind.indicator_scope !== "entity";
  const isEntityIndicator = (ind: Indicator) => ind.indicator_scope === "entity";

  // Group results
  const stateResults = new Map<string, Result[]>(); // indicator id → results
  const entityResults = new Map<string, Result[]>(); // `${indicator}|${entity}` → results
  for (const r of data.results) {
    if (r.entity_id == null) {
      const list = stateResults.get(r.indicator_id) ?? [];
      list.push(r);
      stateResults.set(r.indicator_id, list);
    } else {
      const key = `${r.indicator_id}|${r.entity_id}`;
      const list = entityResults.get(key) ?? [];
      list.push(r);
      entityResults.set(key, list);
    }
  }

  const byStart = (a: Result, b: Result) => {
    const pa = periodById.get(a.time_period_id);
    const pb = periodById.get(b.time_period_id);
    return (pa?.start_date ?? "").localeCompare(pb?.start_date ?? "");
  };
  stateResults.forEach((list) => list.sort(byStart));
  entityResults.forEach((list) => list.sort(byStart));

  /* ---------- indicator level ---------- */

  const indicatorsComputed: IndicatorComputed[] = [];
  for (const ind of data.indicators) {
    const domain = domainById.get(ind.domain_id);
    const thematicArea = domain ? thematicById.get(domain.thematic_area_id) : undefined;
    const sector = thematicArea ? sectorById.get(thematicArea.sector_id) : undefined;
    if (!domain || !thematicArea || !sector) continue;
    // Unpublished domain or indicator — omit from public rollups / Present / Sector Dashboard.
    if (!isIndicatorPublic(ind, domainById)) continue;

    const expectedFrequency = indicatorFrequency(ind, thematicArea);
    const series: SeriesPoint[] = (stateResults.get(ind.id) ?? [])
      .map((r) => {
        const period = periodById.get(r.time_period_id);
        if (!period || period.frequency !== expectedFrequency) return null;
        const target = r.target_value ?? ind.target_value;
        return {
          period,
          abia: r.abia_value,
          nigeria: r.nigeria_value,
          target,
          score: scoreValue(r.abia_value, target, ind.direction),
        };
      })
      .filter((pt): pt is SeriesPoint => pt != null)
      .sort((a, b) => a.period.start_date.localeCompare(b.period.start_date));

    const latest = series.at(-1) ?? null;
    const previous = series.at(-2) ?? null;
    indicatorsComputed.push({
      indicator: ind,
      domain,
      thematicArea,
      sector,
      series,
      latest,
      previous,
      score: latest?.score ?? null,
      prevScore: previous?.score ?? null,
    });
  }
  const indicatorComputedById = new Map(indicatorsComputed.map((i) => [i.indicator.id, i]));

  /* ---------- rollups: domain → thematic → sector → state ---------- */

  const domainScores = new Map<string, ScorePair>();
  for (const d of data.domains) {
    const items = indicatorsComputed.filter((i) => i.domain.id === d.id && isStateIndicator(i.indicator));
    domainScores.set(d.id, {
      score: weightedMean(items.map((i) => ({ score: i.score, weight: i.indicator.weight }))),
      prevScore: weightedMean(items.map((i) => ({ score: i.prevScore, weight: i.indicator.weight }))),
    });
  }

  const thematicScores = new Map<string, ScorePair>();
  for (const t of data.thematicAreas) {
    const items = data.domains
      .filter((d) => d.thematic_area_id === t.id)
      .map((d) => ({ pair: domainScores.get(d.id), weight: d.weight }));
    thematicScores.set(t.id, {
      score: weightedMean(items.map((x) => ({ score: x.pair?.score ?? null, weight: x.weight }))),
      prevScore: weightedMean(items.map((x) => ({ score: x.pair?.prevScore ?? null, weight: x.weight }))),
    });
  }

  const sectorScores = new Map<string, ScorePair>();
  for (const s of data.sectors) {
    const items = data.thematicAreas
      .filter((t) => t.sector_id === s.id)
      .map((t) => ({ pair: thematicScores.get(t.id), weight: t.weight }));
    sectorScores.set(s.id, {
      score: weightedMean(items.map((x) => ({ score: x.pair?.score ?? null, weight: x.weight }))),
      prevScore: weightedMean(items.map((x) => ({ score: x.pair?.prevScore ?? null, weight: x.weight }))),
    });
  }

  const stateScore: ScorePair = {
    score: weightedMean(
      data.sectors.map((s) => ({ score: sectorScores.get(s.id)?.score ?? null, weight: 1 }))
    ),
    prevScore: weightedMean(
      data.sectors.map((s) => ({ score: sectorScores.get(s.id)?.prevScore ?? null, weight: 1 }))
    ),
  };

  /* ---------- entity / MDA / LGA composites ---------- */

  interface EntityAgg {
    latest: Array<{ score: number | null; weight: number }>;
    prev: Array<{ score: number | null; weight: number }>;
  }
  const entityAgg = new Map<string, EntityAgg>();
  entityResults.forEach((list, key) => {
    const [indicatorId, entityId] = key.split("|");
    const ind = indicatorById.get(indicatorId);
    if (!ind || !isEntityIndicator(ind)) return;
    const domain = domainById.get(ind.domain_id);
    const thematic = domain ? thematicById.get(domain.thematic_area_id) : undefined;
    const expectedFrequency = indicatorFrequency(ind, thematic ?? null);
    const matching = list.filter((r) => periodById.get(r.time_period_id)?.frequency === expectedFrequency);
    const latest = matching.at(-1);
    const prev = matching.at(-2);
    const agg = entityAgg.get(entityId) ?? { latest: [], prev: [] };
    if (latest) {
      agg.latest.push({
        score: scoreValue(latest.abia_value, latest.target_value ?? ind.target_value, ind.direction),
        weight: ind.weight,
      });
    }
    if (prev) {
      agg.prev.push({
        score: scoreValue(prev.abia_value, prev.target_value ?? ind.target_value, ind.direction),
        weight: ind.weight,
      });
    }
    entityAgg.set(entityId, agg);
  });

  const entityScores: EntityComputed[] = [];
  for (const e of data.entities) {
    const agg = entityAgg.get(e.id);
    const mda = mdaById.get(e.mda_id);
    const lga = lgaById.get(e.lga_id);
    const sector = mda ? sectorById.get(mda.sector_id) : undefined;
    if (!mda || !lga || !sector) continue;
    entityScores.push({
      entity: e,
      mda,
      lga,
      sector,
      readings: agg?.latest.length ?? 0,
      score: agg ? weightedMean(agg.latest) : null,
      prevScore: agg ? weightedMean(agg.prev) : null,
    });
  }
  entityScores.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const mdaScores: MdaComputed[] = [];
  for (const m of data.mdas) {
    const sector = sectorById.get(m.sector_id);
    if (!sector) continue;
    const ents = entityScores.filter((e) => e.mda.id === m.id);
    mdaScores.push({
      mda: m,
      sector,
      entityCount: ents.length,
      score: weightedMean(ents.map((e) => ({ score: e.score, weight: 1 }))),
      prevScore: weightedMean(ents.map((e) => ({ score: e.prevScore, weight: 1 }))),
    });
  }
  mdaScores.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const lgaScores: LgaComputed[] = [];
  for (const l of data.lgas) {
    const ents = entityScores.filter((e) => e.lga.id === l.id);
    lgaScores.push({
      lga: l,
      entityIds: ents.map((e) => e.entity.id),
      readings: ents.reduce((n, e) => n + e.readings, 0),
      score: weightedMean(ents.map((e) => ({ score: e.score, weight: 1 }))),
      prevScore: weightedMean(ents.map((e) => ({ score: e.prevScore, weight: 1 }))),
    });
  }
  lgaScores.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  /* ---------- composite trend (quarterly, carry-forward as-of) ---------- */

  const quarters = data.timePeriods
    .filter((p) => p.frequency === "quarterly")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const trend: TrendPoint[] = quarters.map((q) => {
    // score of each indicator "as of" the quarter end (latest result on or before it)
    const asOfScores = new Map<string, number | null>();
    for (const ic of indicatorsComputed) {
      let score: number | null = null;
      for (const pt of ic.series) {
        if (pt.period.end_date <= q.end_date && pt.score != null) score = pt.score;
      }
      asOfScores.set(ic.indicator.id, score);
    }

    const sectorAsOf = (sectorId: string): number | null => {
      // simple weighted mean of indicator scores within the sector
      const items = indicatorsComputed
        .filter((i) => i.sector.id === sectorId && isStateIndicator(i.indicator))
        .map((i) => ({ score: asOfScores.get(i.indicator.id) ?? null, weight: i.indicator.weight }));
      return weightedMean(items);
    };

    const sectors: Record<string, number | null> = {};
    for (const s of data.sectors) sectors[s.slug] = sectorAsOf(s.id);
    const state = weightedMean(
      data.sectors.map((s) => ({ score: sectors[s.slug], weight: 1 }))
    );
    return { label: q.label, date: q.end_date, state, sectors };
  });

  return {
    data,
    indicators: indicatorsComputed,
    indicatorById: indicatorComputedById,
    domainScores,
    thematicScores,
    sectorScores,
    stateScore,
    lgaScores,
    mdaScores,
    entityScores,
    trend,
  };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return rounded.toLocaleString("en-NG", { maximumFractionDigits: digits });
}

export function fmtValue(value: number | null | undefined, unit: string): string {
  if (value == null) return "—";
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  const base = fmt(value, digits);
  if (unit === "%") return `${base}%`;
  return `${base} ${unit}`;
}

export function delta(pair: { score: number | null; prevScore: number | null }): number | null {
  if (pair.score == null || pair.prevScore == null) return null;
  return pair.score - pair.prevScore;
}

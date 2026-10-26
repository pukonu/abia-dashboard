import type {
  CollectedAt,
  DashboardData,
  Direction,
  Domain,
  Entity,
  Indicator,
  Lga,
  Mda,
  Result,
  RollupMethod,
  Sector,
  ThematicArea,
  TimePeriod,
} from "./types";
import {
  collectedAt,
  combineValues,
  isAdditiveMethod,
  meetsCountCondition,
  rollupMethod,
  type Coverage,
  type RollupSummary,
  type ValueSource,
} from "./indicator-collection";
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
      // Neutral, not red: missing data is a reporting gap, not poor performance.
      label: "Not yet reported",
      color: "#a1a1aa",
      textClass: "text-zinc-600 dark:text-zinc-300",
      bgClass: "border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800",
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
/*                                                                     */
/* Indicators are collected at the state, LGA or facility level (see   */
/* indicator-collection.ts). LGA and facility records roll up into     */
/* per-LGA values and a statewide value using each indicator's roll-up */
/* method; a statewide result on an LGA- or facility-collected         */
/* indicator is a manual override and always wins for its period.      */
/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  period: TimePeriod;
  /** the statewide value used for scoring (entered, override or roll-up) */
  abia: number;
  nigeria: number | null;
  target: number | null;
  score: number | null;
  /** where the statewide value came from */
  source: ValueSource;
  /** the LGA/facility roll-up for this period — kept even when an override wins */
  rollup: RollupSummary | null;
  enteredBy: string | null;
  updatedAt: string | null;
  overrideNote: string | null;
}

export interface IndicatorComputed {
  indicator: Indicator;
  domain: Domain;
  thematicArea: ThematicArea;
  sector: Sector;
  collectedAt: CollectedAt;
  rollupMethod: RollupMethod;
  /** has a statewide figure (state-collected or rolled up) — counts toward scores */
  reportsAtState: boolean;
  /** statewide values in chronological order */
  series: SeriesPoint[];
  latest: SeriesPoint | null;
  previous: SeriesPoint | null;
  score: number | null;
  prevScore: number | null;
}

/** An LGA- or facility-collected indicator's latest value in one LGA. */
export interface LgaIndicatorValue {
  ic: IndicatorComputed;
  lga: Lga;
  period: TimePeriod;
  value: number;
  target: number | null;
  score: number | null;
  prevPeriod: TimePeriod | null;
  prevValue: number | null;
  prevScore: number | null;
  /** LGA return, or rolled up from the LGA's facilities */
  source: "lga" | "facility";
  /** facilities reporting / expected in this LGA (1 of 1 for LGA returns) */
  coverage: Coverage;
}

export interface ScorePair {
  score: number | null;
  prevScore: number | null;
}

export interface LgaComputed extends ScorePair {
  lga: Lga;
  /** number of LGA-level indicator values feeding the composite */
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
  /** latest value of every LGA/facility-collected indicator in each LGA */
  lgaIndicators: LgaIndicatorValue[];
  /** quarterly composite trend for the state and each sector */
  trend: TrendPoint[];
}

/* ------------------------------------------------------------------ */

type ByPeriod<T> = Map<string, T>;

function latestWins(a: Result | undefined, b: Result): Result {
  if (!a) return b;
  return (b.updated_at ?? "") >= (a.updated_at ?? "") ? b : a;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

export function computeDashboard(data: DashboardData): Computed {
  const periodById = new Map(data.timePeriods.map((p) => [p.id, p]));
  const domainById = new Map(data.domains.map((d) => [d.id, d]));
  const thematicById = new Map(data.thematicAreas.map((t) => [t.id, t]));
  const sectorById = new Map(data.sectors.map((s) => [s.id, s]));
  const mdaById = new Map(data.mdas.map((m) => [m.id, m]));
  const lgaById = new Map(data.lgas.map((l) => [l.id, l]));
  const entityById = new Map(data.entities.map((e) => [e.id, e]));
  const totalPopulation = data.lgas.reduce((sum, l) => sum + (l.population > 0 ? l.population : 0), 0);

  // Group results by location: statewide, LGA return, or facility record.
  const stateRows = new Map<string, ByPeriod<Result>>();
  const lgaRows = new Map<string, ByPeriod<Map<string, Result>>>();
  const facilityRows = new Map<string, ByPeriod<Map<string, Result>>>();
  for (const r of data.results) {
    if (r.entity_id) {
      const byPeriod = facilityRows.get(r.indicator_id) ?? new Map();
      const byEntity = byPeriod.get(r.time_period_id) ?? new Map();
      byEntity.set(r.entity_id, latestWins(byEntity.get(r.entity_id), r));
      byPeriod.set(r.time_period_id, byEntity);
      facilityRows.set(r.indicator_id, byPeriod);
    } else if (r.lga_id) {
      const byPeriod = lgaRows.get(r.indicator_id) ?? new Map();
      const byLga = byPeriod.get(r.time_period_id) ?? new Map();
      byLga.set(r.lga_id, latestWins(byLga.get(r.lga_id), r));
      byPeriod.set(r.time_period_id, byLga);
      lgaRows.set(r.indicator_id, byPeriod);
    } else {
      const byPeriod = stateRows.get(r.indicator_id) ?? new Map();
      byPeriod.set(r.time_period_id, latestWins(byPeriod.get(r.time_period_id), r));
      stateRows.set(r.indicator_id, byPeriod);
    }
  }

  // Facilities expected to report a facility-collected indicator: those of
  // its responsible MDA when set, otherwise every facility in its sector.
  const expectedCache = new Map<string, Entity[]>();
  const expectedFacilities = (ind: Indicator, sector: Sector): Entity[] => {
    const key = ind.responsible_mda_id ? `mda:${ind.responsible_mda_id}` : `sector:${sector.id}`;
    let list = expectedCache.get(key);
    if (!list) {
      list = data.entities.filter((e) =>
        ind.responsible_mda_id
          ? e.mda_id === ind.responsible_mda_id
          : mdaById.get(e.mda_id)?.sector_id === sector.id
      );
      expectedCache.set(key, list);
    }
    return list;
  };

  /* ---------- indicator level ---------- */

  const indicatorsComputed: IndicatorComputed[] = [];
  // per indicator: chronological per-LGA values, used for LGA pages and scores
  type LgaPoint = {
    period: TimePeriod;
    value: number;
    target: number | null;
    score: number | null;
    source: "lga" | "facility";
    coverage: Coverage;
  };
  const lgaSeries = new Map<string, Map<string, LgaPoint[]>>();
  // per indicator + facility: chronological facility scores (entity composites)
  type FacilityPoints = { indicator: Indicator; entityId: string; points: Array<{ period: TimePeriod; score: number | null }> };
  const facilitySeries = new Map<string, FacilityPoints[]>();

  for (const ind of data.indicators) {
    const domain = domainById.get(ind.domain_id);
    const thematicArea = domain ? thematicById.get(domain.thematic_area_id) : undefined;
    const sector = thematicArea ? sectorById.get(thematicArea.sector_id) : undefined;
    if (!domain || !thematicArea || !sector) continue;
    // Unpublished domain or indicator — omit from public rollups / Present / Sector Dashboard.
    if (!isIndicatorPublic(ind, domainById)) continue;

    const level = collectedAt(ind);
    const method = rollupMethod(ind);
    const expectedFrequency = indicatorFrequency(ind, thematicArea);
    const periodFor = (periodId: string): TimePeriod | null => {
      const period = periodById.get(periodId);
      return period && period.frequency === expectedFrequency ? period : null;
    };
    const additive = isAdditiveMethod(method);
    const lgaTarget = (lga: Lga): number | null => {
      if (ind.lga_target_value != null) return ind.lga_target_value;
      if (ind.target_value == null) return null;
      if (!additive) return ind.target_value;
      return totalPopulation > 0 && lga.population > 0 ? (ind.target_value * lga.population) / totalPopulation : null;
    };
    const facilityTarget = ind.facility_target_value ?? (additive ? null : ind.target_value);
    const facilityScore = (value: number): number | null =>
      method === "count"
        ? meetsCountCondition(ind, value)
          ? 100
          : 0
        : scoreValue(value, facilityTarget, ind.direction);

    // Roll-ups per period: per-LGA values and the statewide figure.
    const rollupByPeriod = new Map<string, RollupSummary>();
    const perLga = new Map<string, LgaPoint[]>();
    const pushLga = (lgaId: string, entry: LgaPoint) => {
      const list = perLga.get(lgaId) ?? [];
      list.push(entry);
      perLga.set(lgaId, list);
    };

    if (level === "lga") {
      for (const [periodId, byLga] of lgaRows.get(ind.id) ?? []) {
        const period = periodFor(periodId);
        if (!period) continue;
        const values: number[] = [];
        const weights: number[] = [];
        for (const [lgaId, row] of byLga) {
          const lga = lgaById.get(lgaId);
          if (!lga) continue;
          values.push(row.abia_value);
          weights.push(lga.population);
          const target = lgaTarget(lga);
          pushLga(lgaId, {
            period,
            value: row.abia_value,
            target,
            score: scoreValue(row.abia_value, target, ind.direction),
            source: "lga",
            coverage: { reported: 1, expected: 1 },
          });
        }
        const value = combineValues(ind, method, values, weights);
        if (value != null) {
          rollupByPeriod.set(periodId, {
            value,
            method,
            level: "lga",
            coverage: { reported: values.length, expected: data.lgas.length },
          });
        }
      }
    }

    if (level === "facility") {
      const expected = expectedFacilities(ind, sector);
      const perEntity = new Map<string, Array<{ period: TimePeriod; score: number | null }>>();
      for (const [periodId, byEntity] of facilityRows.get(ind.id) ?? []) {
        const period = periodFor(periodId);
        if (!period) continue;
        const all: number[] = [];
        const byLga = new Map<string, { values: number[]; scores: number[] }>();
        for (const [entityId, row] of byEntity) {
          const entity = entityById.get(entityId);
          if (!entity) continue;
          const score = facilityScore(row.abia_value);
          all.push(row.abia_value);
          const bucket = byLga.get(entity.lga_id) ?? { values: [], scores: [] };
          bucket.values.push(row.abia_value);
          if (score != null) bucket.scores.push(score);
          byLga.set(entity.lga_id, bucket);
          const points = perEntity.get(entityId) ?? [];
          points.push({ period, score });
          perEntity.set(entityId, points);
        }
        const lgaAverages: number[] = [];
        const lgaWeights: number[] = [];
        for (const [lgaId, bucket] of byLga) {
          const lga = lgaById.get(lgaId);
          if (!lga) continue;
          const coverage = {
            reported: bucket.values.length,
            expected: Math.max(bucket.values.length, expected.filter((e) => e.lga_id === lgaId).length),
          };
          if (method === "none") {
            // Facility-only indicator: the LGA view averages facility scores.
            const value = mean(bucket.values);
            if (value != null) {
              pushLga(lgaId, { period, value, target: facilityTarget, score: mean(bucket.scores), source: "facility", coverage });
            }
            continue;
          }
          const value = combineValues(ind, method === "weighted_average" ? "average" : method, bucket.values);
          if (value == null) continue;
          lgaAverages.push(value);
          lgaWeights.push(lga.population);
          const target = lgaTarget(lga);
          pushLga(lgaId, { period, value, target, score: scoreValue(value, target, ind.direction), source: "facility", coverage });
        }
        const value =
          method === "weighted_average"
            ? combineValues(ind, method, lgaAverages, lgaWeights)
            : combineValues(ind, method, all);
        if (value != null) {
          rollupByPeriod.set(periodId, {
            value,
            method,
            level: "facility",
            coverage: { reported: all.length, expected: Math.max(all.length, expected.length) },
          });
        }
      }
      facilitySeries.set(
        ind.id,
        [...perEntity].map(([entityId, points]) => ({
          indicator: ind,
          entityId,
          points: points.sort((a, b) => a.period.start_date.localeCompare(b.period.start_date)),
        }))
      );
    }

    // Statewide series: a statewide row wins (entered or override), else the roll-up.
    const manualRows = stateRows.get(ind.id) ?? new Map<string, Result>();
    const periodIds = new Set<string>([...manualRows.keys(), ...(level === "state" ? [] : rollupByPeriod.keys())]);
    const series: SeriesPoint[] = [];
    for (const periodId of periodIds) {
      const period = periodFor(periodId);
      if (!period) continue;
      const manual = manualRows.get(periodId);
      const rollup = level === "state" ? null : (rollupByPeriod.get(periodId) ?? null);
      if (manual) {
        const target = manual.target_value ?? ind.target_value;
        series.push({
          period,
          abia: manual.abia_value,
          nigeria: manual.nigeria_value,
          target,
          score: scoreValue(manual.abia_value, target, ind.direction),
          source: level === "state" ? "entered" : "override",
          rollup,
          enteredBy: manual.entered_by ?? null,
          updatedAt: manual.updated_at ?? null,
          overrideNote: manual.override_note ?? null,
        });
      } else if (rollup) {
        series.push({
          period,
          abia: rollup.value,
          nigeria: null,
          target: ind.target_value,
          score: scoreValue(rollup.value, ind.target_value, ind.direction),
          source: "rollup",
          rollup,
          enteredBy: null,
          updatedAt: null,
          overrideNote: null,
        });
      }
    }
    series.sort((a, b) => a.period.start_date.localeCompare(b.period.start_date));

    const latest = series.at(-1) ?? null;
    const previous = series.at(-2) ?? null;
    indicatorsComputed.push({
      indicator: ind,
      domain,
      thematicArea,
      sector,
      collectedAt: level,
      rollupMethod: method,
      reportsAtState: level === "state" || method !== "none",
      series,
      latest,
      previous,
      score: latest?.score ?? null,
      prevScore: previous?.score ?? null,
    });
    if (perLga.size > 0) {
      for (const list of perLga.values()) {
        list.sort((a, b) => a.period.start_date.localeCompare(b.period.start_date));
      }
      lgaSeries.set(ind.id, perLga);
    }
  }
  const indicatorComputedById = new Map(indicatorsComputed.map((i) => [i.indicator.id, i]));

  /* ---------- rollups: domain → thematic → sector → state ---------- */

  const domainScores = new Map<string, ScorePair>();
  for (const d of data.domains) {
    const items = indicatorsComputed.filter((i) => i.domain.id === d.id && i.reportsAtState);
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

  /* ---------- LGA indicator values ---------- */

  const lgaIndicators: LgaIndicatorValue[] = [];
  for (const [indicatorId, perLga] of lgaSeries) {
    const ic = indicatorComputedById.get(indicatorId);
    if (!ic) continue;
    for (const [lgaId, list] of perLga) {
      const lga = lgaById.get(lgaId);
      const latest = list.at(-1);
      if (!lga || !latest) continue;
      const prev = list.at(-2) ?? null;
      lgaIndicators.push({
        ic,
        lga,
        period: latest.period,
        value: latest.value,
        target: latest.target,
        score: latest.score,
        prevPeriod: prev?.period ?? null,
        prevValue: prev?.value ?? null,
        prevScore: prev?.score ?? null,
        source: latest.source,
        coverage: latest.coverage,
      });
    }
  }

  /* ---------- entity / MDA / LGA composites ---------- */

  type ScoreItems = Array<{ score: number | null; weight: number }>;
  const entityAgg = new Map<string, { latest: ScoreItems; prev: ScoreItems }>();
  for (const list of facilitySeries.values()) {
    for (const item of list) {
      const latest = item.points.at(-1);
      const prev = item.points.at(-2);
      const agg = entityAgg.get(item.entityId) ?? { latest: [], prev: [] };
      if (latest) agg.latest.push({ score: latest.score, weight: item.indicator.weight });
      if (prev) agg.prev.push({ score: prev.score, weight: item.indicator.weight });
      entityAgg.set(item.entityId, agg);
    }
  }

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

  // An LGA's composite is the weighted mean of every LGA- or facility-
  // collected indicator measured there (LGA returns and facility roll-ups).
  const lgaScores: LgaComputed[] = [];
  for (const l of data.lgas) {
    const values = lgaIndicators.filter((v) => v.lga.id === l.id);
    lgaScores.push({
      lga: l,
      entityIds: entityScores.filter((e) => e.lga.id === l.id && e.readings > 0).map((e) => e.entity.id),
      readings: values.length,
      score: weightedMean(values.map((v) => ({ score: v.score, weight: v.ic.indicator.weight }))),
      prevScore: weightedMean(values.map((v) => ({ score: v.prevScore, weight: v.ic.indicator.weight }))),
    });
  }
  lgaScores.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  /* ---------- composite trend (quarterly, carry-forward as-of) ---------- */

  const quarters = data.timePeriods
    .filter((p) => p.frequency === "quarterly")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const trend: TrendPoint[] = quarters.map((q) => {
    // score of each indicator "as of" the quarter end (latest value on or before it)
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
        .filter((i) => i.sector.id === sectorId && i.reportsAtState)
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
    lgaIndicators,
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

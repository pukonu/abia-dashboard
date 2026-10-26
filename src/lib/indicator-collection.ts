import type { CollectedAt, CountOperator, Indicator, RollupMethod } from "./types";

/*
 * Indicator collection levels and roll-up rules, shared by the webapp, PWA
 * and native app (keep the three copies identical).
 *
 * Every indicator is collected at one level — state, LGA or facility — and
 * LGA/facility indicators say how their records combine into LGA and
 * statewide figures. A statewide result on an LGA- or facility-collected
 * indicator is a manual override and always wins for its period.
 */

export const COLLECTED_AT_OPTIONS: Array<{ value: CollectedAt; label: string; hint: string }> = [
  { value: "state", label: "State", hint: "One statewide figure per period" },
  { value: "lga", label: "LGA", hint: "One return per LGA per period, rolled up to the state" },
  { value: "facility", label: "Facility", hint: "One record per facility, rolled up to LGAs and the state" },
];

export const ROLLUP_METHOD_OPTIONS: Array<{ value: RollupMethod; label: string; hint: string }> = [
  { value: "average", label: "Average", hint: "Mean of all reported values" },
  {
    value: "weighted_average",
    label: "Population-weighted average",
    hint: "LGA values weighted by LGA population — best for rates",
  },
  { value: "sum", label: "Sum", hint: "Total of all reported values — for counts" },
  { value: "count", label: "Count", hint: "How many records meet a condition" },
  { value: "max", label: "Ceil (highest)", hint: "The highest reported value" },
  { value: "min", label: "Floor (lowest)", hint: "The lowest reported value" },
  { value: "none", label: "Don't roll up", hint: "Shown on LGA/facility pages only, not in statewide scores" },
];

export const COUNT_OPERATOR_OPTIONS: Array<{ value: CountOperator; label: string }> = [
  { value: "gte", label: "≥" },
  { value: "gt", label: ">" },
  { value: "eq", label: "=" },
  { value: "lte", label: "≤" },
  { value: "lt", label: "<" },
];

export function collectedAt(indicator: Pick<Indicator, "collected_at" | "indicator_scope">): CollectedAt {
  if (indicator.collected_at) return indicator.collected_at;
  // Databases before migration 18 only distinguish state vs entity.
  return indicator.indicator_scope === "entity" ? "facility" : "state";
}

export function rollupMethod(
  indicator: Pick<Indicator, "collected_at" | "indicator_scope" | "rollup_method">
): RollupMethod {
  if (indicator.rollup_method) return indicator.rollup_method;
  // Pre-migration entity indicators never fed the statewide score.
  return indicator.indicator_scope === "entity" ? "none" : "average";
}

export function isStateCollected(indicator: Pick<Indicator, "collected_at" | "indicator_scope">): boolean {
  return collectedAt(indicator) === "state";
}

export function isLgaCollected(indicator: Pick<Indicator, "collected_at" | "indicator_scope">): boolean {
  return collectedAt(indicator) === "lga";
}

export function isFacilityCollected(indicator: Pick<Indicator, "collected_at" | "indicator_scope">): boolean {
  return collectedAt(indicator) === "facility";
}

/**
 * Whether the indicator has a statewide figure: state-collected, or rolled
 * up from LGAs/facilities. These are the indicators that make up domain,
 * sector and state scores and appear in statewide lists.
 */
export function reportsAtState(
  indicator: Pick<Indicator, "collected_at" | "indicator_scope" | "rollup_method">
): boolean {
  return isStateCollected(indicator) || rollupMethod(indicator) !== "none";
}

/** A record counts for a `count` roll-up when it meets the indicator's condition. */
export function meetsCountCondition(
  indicator: Pick<Indicator, "count_operator" | "count_threshold" | "count_values">,
  value: number
): boolean {
  if (indicator.count_values && indicator.count_values.length > 0) {
    return indicator.count_values.some((qualifying) => qualifying === value);
  }
  const threshold = indicator.count_threshold;
  if (threshold == null) return value > 0; // default: any positive / "Yes" answer
  switch (indicator.count_operator ?? "gte") {
    case "gt":
      return value > threshold;
    case "eq":
      return value === threshold;
    case "lte":
      return value <= threshold;
    case "lt":
      return value < threshold;
    default:
      return value >= threshold;
  }
}

export function describeCountCondition(
  indicator: Pick<Indicator, "count_operator" | "count_threshold" | "count_values">
): string {
  if (indicator.count_values && indicator.count_values.length > 0) {
    return `value is ${indicator.count_values.join(" or ")}`;
  }
  if (indicator.count_threshold == null) return "value is above 0";
  const op = COUNT_OPERATOR_OPTIONS.find((o) => o.value === (indicator.count_operator ?? "gte"))?.label ?? "≥";
  return `value ${op} ${indicator.count_threshold}`;
}

/**
 * Combines LGA or facility values with the indicator's roll-up method.
 * `weights` (LGA populations) are used only by weighted_average.
 * Returns null when nothing was reported or the method is `none`.
 */
export function combineValues(
  indicator: Pick<Indicator, "count_operator" | "count_threshold" | "count_values">,
  method: RollupMethod,
  values: number[],
  weights?: number[]
): number | null {
  if (values.length === 0 || method === "none") return null;
  switch (method) {
    case "sum":
      return values.reduce((sum, v) => sum + v, 0);
    case "count":
      return values.filter((v) => meetsCountCondition(indicator, v)).length;
    case "max":
      return Math.max(...values);
    case "min":
      return Math.min(...values);
    case "weighted_average": {
      let sum = 0;
      let wsum = 0;
      values.forEach((v, i) => {
        const w = weights?.[i] ?? 1;
        if (!(w > 0)) return;
        sum += v * w;
        wsum += w;
      });
      return wsum > 0 ? sum / wsum : values.reduce((s, v) => s + v, 0) / values.length;
    }
    default:
      return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}

/** Sum and count roll-ups grow with the number of records, so targets scale. */
export function isAdditiveMethod(method: RollupMethod): boolean {
  return method === "sum" || method === "count";
}

/** Where a statewide figure came from, for badges, tooltips and reports. */
export type ValueSource = "entered" | "override" | "rollup";

export interface Coverage {
  /** LGAs or facilities that reported this period */
  reported: number;
  /** LGAs or facilities expected to report */
  expected: number;
}

export interface RollupSummary {
  value: number;
  method: RollupMethod;
  level: "lga" | "facility";
  coverage: Coverage;
}

export function rollupMethodLabel(method: RollupMethod): string {
  return ROLLUP_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
}

export function coverageLabel(level: "lga" | "facility", coverage: Coverage): string {
  const noun = level === "lga" ? "LGA" : "facilit";
  const plural = level === "lga" ? (coverage.expected === 1 ? "" : "s") : coverage.expected === 1 ? "y" : "ies";
  return `${coverage.reported} of ${coverage.expected} ${noun}${plural}`;
}

/**
 * One-line provenance for a statewide figure, e.g.
 *   "Manual override · A. Okafor · 3 Jul 2026 — LGA returns incomplete"
 *   "Rolled up (average) from 12 of 17 LGAs"
 *   "Entered"
 * Reports, slides and the apps all use this so overrides are never shown
 * as if they were rolled up.
 */
export function describeSource(point: {
  source?: ValueSource;
  rollup?: RollupSummary | null;
  enteredBy?: string | null;
  updatedAt?: string | null;
  overrideNote?: string | null;
}): string {
  if (point.source === "override") {
    const who = point.enteredBy ? ` · ${point.enteredBy}` : "";
    const when = point.updatedAt ? ` · ${formatShortDate(point.updatedAt)}` : "";
    const why = point.overrideNote ? ` — ${point.overrideNote}` : "";
    return `Manual override${who}${when}${why}`;
  }
  if (point.source === "rollup" && point.rollup) {
    return `Rolled up (${rollupMethodLabel(point.rollup.method).toLowerCase()}) from ${coverageLabel(
      point.rollup.level,
      point.rollup.coverage
    )}`;
  }
  return "Entered";
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const numOrNull = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

/**
 * Normalizes the collection-level columns of a raw indicator row (Supabase,
 * the bulk snapshot API or an offline cache). Databases that predate
 * migration 18 fall back to their legacy state/entity scope.
 */
export function normalizeCollectionFields(row: Record<string, unknown>): Pick<
  Indicator,
  | "collected_at"
  | "rollup_method"
  | "count_operator"
  | "count_threshold"
  | "count_values"
  | "lga_target_value"
  | "facility_target_value"
> {
  const legacy = { indicator_scope: row.indicator_scope as Indicator["indicator_scope"] };
  return {
    collected_at: (row.collected_at as CollectedAt | undefined) ?? collectedAt(legacy),
    rollup_method: (row.rollup_method as RollupMethod | undefined) ?? rollupMethod(legacy),
    count_operator: (row.count_operator as CountOperator | null | undefined) ?? null,
    count_threshold: numOrNull(row.count_threshold),
    count_values: Array.isArray(row.count_values) ? row.count_values.map(Number) : null,
    lga_target_value: numOrNull(row.lga_target_value),
    facility_target_value: numOrNull(row.facility_target_value),
  };
}

/**
 * Checks where a result is being saved against where the indicator is
 * collected. A statewide value on an LGA- or facility-collected indicator is
 * a manual override and must say why. Returns an error message or null.
 */
export function resultLocationError(
  indicator: Pick<Indicator, "name" | "collected_at" | "indicator_scope">,
  location: { entity_id: string | null; lga_id: string | null; override_note: string | null }
): string | null {
  const level = collectedAt(indicator);
  const name = indicator.name || "This indicator";
  if (location.entity_id && location.lga_id) return "A result belongs to one LGA or one facility, not both.";
  if (level === "state") {
    if (location.entity_id || location.lga_id) return `${name} is collected statewide — leave the LGA and facility empty.`;
    return null;
  }
  if (level === "lga" && location.entity_id) return `${name} is collected per LGA, not per facility.`;
  if (level === "facility" && location.lga_id) return `${name} is collected per facility, not per LGA.`;
  const statewide = !location.entity_id && !location.lga_id;
  if (statewide && !location.override_note?.trim()) {
    return `${name} is rolled up from ${level === "lga" ? "LGA returns" : "facility records"}. Give a reason to enter a statewide override.`;
  }
  return null;
}

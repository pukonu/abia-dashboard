import type { Computed } from "./scoring";
import { scoreValue, weightedMean } from "./scoring";
import { indicatorFrequency } from "./indicator-frequency";
import type {
  CustomDashboard,
  DashboardChartType,
  DashboardData,
  DashboardWidget,
  Direction,
} from "./types";

/* ------------------------------------------------------------------ */
/* Custom dashboards: admin-built chart layouts shown on sector and    */
/* LGA pages. Widgets reference indicators; this module resolves each  */
/* indicator into a serializable series for the selected scope.        */
/* ------------------------------------------------------------------ */

export const CHART_TYPES: Array<{
  value: DashboardChartType;
  label: string;
  description: string;
  minIndicators: number;
}> = [
  { value: "stat", label: "Stat cards", description: "Latest value, score and short briefing text per indicator", minIndicators: 1 },
  { value: "trend", label: "Trend line", description: "Values over time (scores when comparing several)", minIndicators: 1 },
  { value: "bar", label: "Bar chart", description: "Latest scores side by side", minIndicators: 1 },
  { value: "pie", label: "Pie chart", description: "Share of latest values across 2+ indicators", minIndicators: 2 },
  { value: "radar", label: "Radar", description: "Scorecard across 3+ indicators", minIndicators: 3 },
];

export interface WidgetSeriesPoint {
  periodId?: string;
  label: string;
  value: number | null;
  nigeria: number | null;
  score: number | null;
}

export interface WidgetEditPeriod {
  id: string;
  label: string;
  startDate: string;
}

export interface WidgetPeriodValue {
  value: number | null;
  nigeria: number | null;
  notes: string | null;
}

/** Everything a widget needs to plot one indicator, serializable for client components. */
export interface WidgetIndicatorDatum {
  id: string;
  name: string;
  unit: string;
  description: string | null;
  direction: Direction;
  target: number | null;
  latestValue: number | null;
  prevValue: number | null;
  latestScore: number | null;
  prevScore: number | null;
  nigeriaScore: number | null;
  series: WidgetSeriesPoint[];
  /** Period of the latest statewide reading, if any. */
  latestPeriodId: string | null;
  latestPeriodLabel: string | null;
  latestNigeria: number | null;
  latestNotes: string | null;
  /**
   * Default period when opening the edit modal — newest period matching the
   * indicator frequency (so retrospective entry can still pick older months).
   */
  editPeriodId: string | null;
  editPeriodLabel: string | null;
  /** Reporting frequency used to filter editable periods. */
  frequency: string;
  /** All periods of this indicator's frequency, oldest → newest. */
  editPeriods: WidgetEditPeriod[];
  /** Existing statewide readings keyed by time_period_id. */
  periodValues: Record<string, WidgetPeriodValue>;
}

export interface IndicatorOption {
  id: string;
  name: string;
  unit: string;
  group: string;
  hasData: boolean;
}

export function dashboardsFor(
  data: DashboardData,
  scope: "sector" | "lga",
  targetId: string,
  publishedOnly = true
): CustomDashboard[] {
  return data.dashboards
    .filter(
      (d) =>
        d.scope === scope &&
        (scope === "sector" ? d.sector_id === targetId : d.lga_id === targetId) &&
        (!publishedOnly || d.published)
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function widgetsOf(data: DashboardData, dashboardId: string): DashboardWidget[] {
  return data.dashboardWidgets
    .filter((w) => w.dashboard_id === dashboardId)
    .sort((a, b) => a.position - b.position);
}

/* ------------------------------------------------------------------ */
/* Indicator data per scope                                            */
/* ------------------------------------------------------------------ */

/**
 * Sector dashboards plot statewide indicator results for indicators
 * under the sector. LGA dashboards plot per-period averages of entity
 * results from entities located in the LGA (any sector), so they only
 * offer indicators that actually have readings in that LGA.
 */
export function dashboardIndicatorData(
  c: Computed,
  dashboard: Pick<CustomDashboard, "scope" | "sector_id" | "lga_id">
): { options: IndicatorOption[]; data: Record<string, WidgetIndicatorDatum> } {
  if (dashboard.scope === "sector") {
    return sectorIndicatorData(c, dashboard.sector_id ?? "");
  }
  return lgaIndicatorData(c, dashboard.lga_id ?? "");
}

function periodsForFrequency(
  periods: Computed["data"]["timePeriods"],
  frequency: string
): Array<{ id: string; label: string; startDate: string }> {
  return periods
    .filter((p) => p.frequency === frequency)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((p) => ({ id: p.id, label: p.label, startDate: p.start_date }));
}

function latestPeriodForFrequency(
  periods: Computed["data"]["timePeriods"],
  frequency: string
): { id: string; label: string } | null {
  const matched = periodsForFrequency(periods, frequency);
  const last = matched.at(-1);
  return last ? { id: last.id, label: last.label } : null;
}

function sectorIndicatorData(
  c: Computed,
  sectorId: string
): { options: IndicatorOption[]; data: Record<string, WidgetIndicatorDatum> } {
  const options: IndicatorOption[] = [];
  const data: Record<string, WidgetIndicatorDatum> = {};
  const resultMeta = new Map<string, { nigeria: number | null; notes: string | null }>();
  for (const r of c.data.results) {
    if (r.entity_id != null) continue;
    resultMeta.set(`${r.indicator_id}|${r.time_period_id}`, {
      nigeria: r.nigeria_value,
      notes: r.notes ?? null,
    });
  }

  for (const ic of c.indicators) {
    if (ic.sector.id !== sectorId || ic.indicator.indicator_scope === "entity") continue;
    const frequency = indicatorFrequency(ic.indicator, ic.thematicArea);
    const editPeriods = periodsForFrequency(c.data.timePeriods, frequency);
    const series: WidgetSeriesPoint[] = [...ic.series]
      .sort((a, b) => a.period.start_date.localeCompare(b.period.start_date))
      .map((pt) => ({
        periodId: pt.period.id,
        label: pt.period.label,
        value: pt.abia,
        nigeria: pt.nigeria,
        score: pt.score,
      }));
    const periodValues: Record<string, WidgetPeriodValue> = {};
    for (const pt of ic.series) {
      const meta = resultMeta.get(`${ic.indicator.id}|${pt.period.id}`);
      periodValues[pt.period.id] = {
        value: pt.abia,
        nigeria: meta?.nigeria ?? pt.nigeria,
        notes: meta?.notes ?? null,
      };
    }
    const latest = ic.latest;
    const currentPeriod = latestPeriodForFrequency(c.data.timePeriods, frequency);
    const meta =
      latest != null
        ? resultMeta.get(`${ic.indicator.id}|${latest.period.id}`)
        : undefined;
    let latestNigeria: number | null = meta?.nigeria ?? latest?.nigeria ?? null;
    if (latestNigeria == null) {
      for (const pt of [...ic.series].reverse()) {
        const ptMeta = resultMeta.get(`${ic.indicator.id}|${pt.period.id}`);
        const candidate = ptMeta?.nigeria ?? pt.nigeria;
        if (candidate != null) {
          latestNigeria = candidate;
          break;
        }
      }
    }
    data[ic.indicator.id] = {
      id: ic.indicator.id,
      name: ic.indicator.name,
      unit: ic.indicator.unit,
      description: ic.indicator.description ?? null,
      direction: ic.indicator.direction,
      target: latest?.target ?? ic.indicator.target_value,
      latestValue: latest?.abia ?? null,
      prevValue: ic.previous?.abia ?? null,
      latestScore: ic.score,
      prevScore: ic.prevScore,
      nigeriaScore:
        latest?.nigeria != null
          ? scoreValue(latest.nigeria, latest.target, ic.indicator.direction)
          : null,
      series,
      latestPeriodId: latest?.period.id ?? null,
      latestPeriodLabel: latest?.period.label ?? null,
      latestNigeria,
      latestNotes: meta?.notes ?? null,
      // Prefer the current (newest) period for this frequency so admins can
      // enter this month/quarter/year, then switch back for retrospective fills.
      editPeriodId: currentPeriod?.id ?? latest?.period.id ?? null,
      editPeriodLabel: currentPeriod?.label ?? latest?.period.label ?? null,
      frequency,
      editPeriods,
      periodValues,
    };
    options.push({
      id: ic.indicator.id,
      name: ic.indicator.name,
      unit: ic.indicator.unit,
      group: `${ic.thematicArea.name} · ${ic.domain.name}`,
      hasData: series.length > 0,
    });
  }

  options.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  return { options, data };
}

function lgaIndicatorData(
  c: Computed,
  lgaId: string
): { options: IndicatorOption[]; data: Record<string, WidgetIndicatorDatum> } {
  const entityIds = new Set(c.data.entities.filter((e) => e.lga_id === lgaId).map((e) => e.id));
  const periodById = new Map(c.data.timePeriods.map((p) => [p.id, p]));

  // indicator id → period id → readings in this LGA
  const byIndicator = new Map<string, Map<string, Array<{ value: number; score: number | null }>>>();
  for (const r of c.data.results) {
    if (!r.entity_id || !entityIds.has(r.entity_id)) continue;
    const ic = c.indicatorById.get(r.indicator_id);
    if (!ic) continue;
    const target = r.target_value ?? ic.indicator.target_value;
    const periods = byIndicator.get(r.indicator_id) ?? new Map();
    const readings = periods.get(r.time_period_id) ?? [];
    readings.push({
      value: r.abia_value,
      score: scoreValue(r.abia_value, target, ic.indicator.direction),
    });
    periods.set(r.time_period_id, readings);
    byIndicator.set(r.indicator_id, periods);
  }

  const options: IndicatorOption[] = [];
  const data: Record<string, WidgetIndicatorDatum> = {};

  byIndicator.forEach((periods, indicatorId) => {
    const ic = c.indicatorById.get(indicatorId)!;
    const expectedFrequency = indicatorFrequency(ic.indicator, ic.thematicArea);
    const points = [...periods.entries()]
      .map(([periodId, readings]) => ({ period: periodById.get(periodId), readings }))
      .filter((x) => x.period && x.period.frequency === expectedFrequency)
      .sort((a, b) => a.period!.start_date.localeCompare(b.period!.start_date));

    const series: WidgetSeriesPoint[] = points.map(({ period, readings }) => ({
      periodId: period!.id,
      label: period!.label,
      value: readings.reduce((sum, r) => sum + r.value, 0) / readings.length,
      nigeria: null,
      score: weightedMean(readings.map((r) => ({ score: r.score, weight: 1 }))),
    }));

    const latest = series.at(-1) ?? null;
    const previous = series.at(-2) ?? null;
    const latestPeriod = points.at(-1)?.period ?? null;
    const frequency = indicatorFrequency(ic.indicator, ic.thematicArea);
    data[indicatorId] = {
      id: indicatorId,
      name: ic.indicator.name,
      unit: ic.indicator.unit,
      description: ic.indicator.description ?? null,
      direction: ic.indicator.direction,
      target: ic.indicator.target_value,
      latestValue: latest?.value ?? null,
      prevValue: previous?.value ?? null,
      latestScore: latest?.score ?? null,
      prevScore: previous?.score ?? null,
      nigeriaScore: null,
      series,
      // LGA widgets average entity readings — inline statewide edit is sector-only.
      latestPeriodId: latestPeriod?.id ?? null,
      latestPeriodLabel: latestPeriod?.label ?? null,
      latestNigeria: null,
      latestNotes: null,
      editPeriodId: null,
      editPeriodLabel: null,
      frequency,
      editPeriods: [],
      periodValues: {},
    };
    options.push({
      id: indicatorId,
      name: ic.indicator.name,
      unit: ic.indicator.unit,
      group: `${ic.sector.name} · ${ic.domain.name}`,
      hasData: series.length > 0,
    });
  });

  options.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  return { options, data };
}

/** Only the indicator data actually referenced by the given widgets. */
export function widgetDataSubset(
  widgets: DashboardWidget[],
  data: Record<string, WidgetIndicatorDatum>
): Record<string, WidgetIndicatorDatum> {
  const out: Record<string, WidgetIndicatorDatum> = {};
  for (const w of widgets) {
    for (const id of w.indicator_ids) {
      if (data[id]) out[id] = data[id];
    }
  }
  return out;
}

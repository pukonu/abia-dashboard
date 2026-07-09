import type { Computed } from "./scoring";
import { scoreValue, weightedMean } from "./scoring";
import type {
  CustomDashboard,
  DashboardChartType,
  DashboardData,
  DashboardWidget,
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
  label: string;
  value: number | null;
  nigeria: number | null;
  score: number | null;
}

/** Everything a widget needs to plot one indicator, serializable for client components. */
export interface WidgetIndicatorDatum {
  id: string;
  name: string;
  unit: string;
  description: string | null;
  target: number | null;
  latestValue: number | null;
  latestScore: number | null;
  prevScore: number | null;
  nigeriaScore: number | null;
  series: WidgetSeriesPoint[];
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

function sectorIndicatorData(
  c: Computed,
  sectorId: string
): { options: IndicatorOption[]; data: Record<string, WidgetIndicatorDatum> } {
  const options: IndicatorOption[] = [];
  const data: Record<string, WidgetIndicatorDatum> = {};

  for (const ic of c.indicators) {
    if (ic.sector.id !== sectorId || ic.indicator.indicator_scope === "entity") continue;
    const series: WidgetSeriesPoint[] = ic.series.map((pt) => ({
      label: pt.period.label,
      value: pt.abia,
      nigeria: pt.nigeria,
      score: pt.score,
    }));
    const latest = ic.latest;
    data[ic.indicator.id] = {
      id: ic.indicator.id,
      name: ic.indicator.name,
      unit: ic.indicator.unit,
      description: ic.indicator.description ?? null,
      target: latest?.target ?? ic.indicator.target_value,
      latestValue: latest?.abia ?? null,
      latestScore: ic.score,
      prevScore: ic.prevScore,
      nigeriaScore:
        latest?.nigeria != null
          ? scoreValue(latest.nigeria, latest.target, ic.indicator.direction)
          : null,
      series,
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
    const points = [...periods.entries()]
      .map(([periodId, readings]) => ({ period: periodById.get(periodId), readings }))
      .filter((x) => x.period)
      .sort((a, b) => a.period!.start_date.localeCompare(b.period!.start_date));

    const series: WidgetSeriesPoint[] = points.map(({ period, readings }) => ({
      label: period!.label,
      value: readings.reduce((sum, r) => sum + r.value, 0) / readings.length,
      nigeria: null,
      score: weightedMean(readings.map((r) => ({ score: r.score, weight: 1 }))),
    }));

    const latest = series.at(-1) ?? null;
    const previous = series.at(-2) ?? null;
    data[indicatorId] = {
      id: indicatorId,
      name: ic.indicator.name,
      unit: ic.indicator.unit,
      description: ic.indicator.description ?? null,
      target: ic.indicator.target_value,
      latestValue: latest?.value ?? null,
      latestScore: latest?.score ?? null,
      prevScore: previous?.score ?? null,
      nigeriaScore: null,
      series,
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

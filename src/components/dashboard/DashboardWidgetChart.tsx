"use client";

import {
  IndicatorTrendChart,
  ScoreBarChart,
  ScoreRadarChart,
  TrendChart,
} from "@/components/charts";
import { DeltaTag, ScoreBadge } from "@/components/score";
import type { WidgetIndicatorDatum } from "@/lib/dashboards";
import { fmtValue, ratingFor } from "@/lib/scoring";
import type { DashboardChartType } from "@/lib/types";

const PALETTE = ["#14683c", "#1d4ed8", "#b45309", "#9d174d", "#0f766e", "#6d28d9"];

function shortName(name: string, max = 22): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function Note({ children }: { children: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-center text-xs text-zinc-400">
      {children}
    </div>
  );
}

function StatGrid({ indicators }: { indicators: WidgetIndicatorDatum[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {indicators.map((ind) => (
        <div key={ind.id} className="rounded-md border border-zinc-100 bg-zinc-50/60 p-3">
          <div className="line-clamp-2 text-xs font-medium text-zinc-500" title={ind.name}>
            {ind.name}
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="display text-xl font-semibold text-zinc-900">
              {fmtValue(ind.latestValue, ind.unit)}
            </span>
            <ScoreBadge score={ind.latestScore} />
          </div>
          <div className="mt-1">
            <DeltaTag
              value={
                ind.latestScore != null && ind.prevScore != null
                  ? ind.latestScore - ind.prevScore
                  : null
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendWidget({ indicators }: { indicators: WidgetIndicatorDatum[] }) {
  if (indicators.length === 1) {
    const ind = indicators[0];
    if (ind.series.length === 0) return <Note>No results recorded for this indicator yet.</Note>;
    return (
      <IndicatorTrendChart
        points={ind.series.map((p) => ({ label: p.label, Abia: p.value, Nigeria: p.nigeria }))}
        target={ind.target}
        unit={ind.unit}
        height={240}
      />
    );
  }

  // Multiple indicators with mixed units: compare 0–100 scores instead.
  const labels: string[] = [];
  const rows = new Map<string, Record<string, string | number | null>>();
  for (const ind of indicators) {
    for (const p of ind.series) {
      if (!rows.has(p.label)) {
        labels.push(p.label);
        rows.set(p.label, { label: p.label });
      }
      rows.get(p.label)![shortName(ind.name)] = p.score;
    }
  }
  if (labels.length === 0) return <Note>No results recorded for these indicators yet.</Note>;
  return (
    <TrendChart
      points={labels.map((l) => rows.get(l)!)}
      series={indicators.map((ind, i) => ({
        key: shortName(ind.name),
        name: shortName(ind.name),
        color: PALETTE[i % PALETTE.length],
      }))}
      height={240}
    />
  );
}

/** Renders one dashboard widget's chart from precomputed indicator data. */
export default function DashboardWidgetChart({
  chartType,
  indicatorIds,
  data,
}: {
  chartType: DashboardChartType;
  indicatorIds: string[];
  data: Record<string, WidgetIndicatorDatum>;
}) {
  const indicators = indicatorIds
    .map((id) => data[id])
    .filter((d): d is WidgetIndicatorDatum => Boolean(d));

  if (indicators.length === 0) {
    return (
      <Note>
        {indicatorIds.length === 0
          ? "Select at least one indicator for this widget."
          : "No data recorded yet for this widget's indicators."}
      </Note>
    );
  }

  switch (chartType) {
    case "stat":
      return <StatGrid indicators={indicators} />;
    case "trend":
      return <TrendWidget indicators={indicators} />;
    case "bar":
      return (
        <ScoreBarChart
          points={indicators.map((ind) => ({
            label: shortName(ind.name, 16),
            score: ind.latestScore,
            color: ratingFor(ind.latestScore).color,
          }))}
          height={240}
        />
      );
    case "radar":
      if (indicators.length < 3) {
        return <Note>Radar charts need at least 3 indicators.</Note>;
      }
      return (
        <ScoreRadarChart
          points={indicators.map((ind) => ({
            axis: shortName(ind.name, 20),
            result: ind.latestScore,
            nigeria: ind.nigeriaScore,
          }))}
          height={280}
        />
      );
  }
}

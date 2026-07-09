"use client";

import {
  FullPieChart,
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

function briefingText(ind: WidgetIndicatorDatum): string {
  if (ind.description?.trim()) return ind.description.trim();
  const value = fmtValue(ind.latestValue, ind.unit);
  if (ind.latestValue == null) {
    return "No monthly reading yet — enter a statewide result to brief this indicator.";
  }
  if (ind.target != null && ind.latestScore != null) {
    const gap = Math.round(100 - ind.latestScore);
    if (gap <= 0) return `${value} — at or above the target of ${fmtValue(ind.target, ind.unit)}.`;
    return `${value} against a target of ${fmtValue(ind.target, ind.unit)} (${gap} pts short of target score).`;
  }
  return `${value} recorded for the latest reporting period.`;
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
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{briefingText(ind)}</p>
          <div className="mt-1.5">
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

function PieWidget({ indicators }: { indicators: WidgetIndicatorDatum[] }) {
  const points = indicators
    .map((ind, i) => ({
      label: shortName(ind.name, 28),
      value: Math.max(0, ind.latestValue ?? 0),
      color: PALETTE[i % PALETTE.length],
    }))
    .filter((p) => p.value > 0);

  if (points.length < 2) {
    return <Note>Pie charts need at least two indicators with positive latest values.</Note>;
  }

  const total = points.reduce((sum, p) => sum + p.value, 0);
  return (
    <div>
      <FullPieChart
        points={points.map((p) => ({
          ...p,
          // FullPieChart legend shows "%" — pass share percentages for display consistency
          // while keeping absolute values in the tooltip via a custom path below.
          value: Math.round((p.value / total) * 1000) / 10,
        }))}
        height={240}
      />
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {indicators.map((ind, i) => (
          <div key={ind.id} className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate" title={ind.name}>
                {ind.name}
              </span>
            </span>
            <span className="shrink-0 font-medium text-zinc-700">
              {fmtValue(ind.latestValue, ind.unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
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
    case "pie":
      return <PieWidget indicators={indicators} />;
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

"use client";

import { useTheme } from "@/components/ThemeProvider";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MUTED = "#a1a1aa"; // zinc-400 — comparisons
const ACCENT = "#14683c"; // abia green — the default data color

function useChartTheme() {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return {
    axis: { fontSize: 11, fill: dark ? "#a1a1aa" : "#71717a" },
    angleTick: { fontSize: 11, fill: dark ? "#a1a1aa" : "#52525b" },
    grid: dark ? "#3f3f46" : "#e4e4e7",
    tooltip: {
      borderRadius: 10,
      border: dark ? "1px solid #3f3f46" : "1px solid #e4e4e7",
      fontSize: 12,
      backgroundColor: dark ? "#18181b" : "#ffffff",
      color: dark ? "#fafafa" : "#18181b",
    },
    cursorFill: dark ? "rgba(161,161,170,0.12)" : "rgba(161,161,170,0.08)",
    target: dark ? "#fbbf24" : "#92400e",
  };
}

export interface TrendSeries {
  key: string;
  name: string;
  color: string;
}

/** Composite-score trend (0–100) for one or more series. */
export function TrendChart({
  points,
  series,
  height = 260,
}: {
  points: Array<Record<string, string | number | null>>;
  series: TrendSeries[];
  height?: number;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={theme.axis}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          interval="preserveStartEnd"
        />
        <YAxis domain={[0, 100]} tick={theme.axis} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
          contentStyle={theme.tooltip}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Raw indicator values: Abia vs Nigeria with a target reference line. */
export function IndicatorTrendChart({
  points,
  target,
  unit,
  height = 280,
  forceDark = false,
}: {
  points: Array<{ label: string; Abia: number | null; Nigeria: number | null }>;
  target: number | null;
  unit: string;
  height?: number;
  /** Use dark axis/tooltip colors (e.g. presentation deck on zinc-950). */
  forceDark?: boolean;
}) {
  const themeFromApp = useChartTheme();
  const theme = forceDark
    ? {
        axis: { fontSize: 11, fill: "#a1a1aa" },
        grid: "#3f3f46",
        tooltip: {
          borderRadius: 10,
          border: "1px solid #3f3f46",
          fontSize: 12,
          backgroundColor: "#18181b",
          color: "#fafafa",
        },
        target: "#fbbf24",
      }
    : themeFromApp;
  const accent = forceDark ? "#34d399" : ACCENT;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={theme.axis}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          interval="preserveStartEnd"
        />
        <YAxis tick={theme.axis} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
        <Tooltip
          formatter={(v) => [`${typeof v === "number" ? v.toLocaleString() : String(v ?? "")} ${unit}`]}
          contentStyle={theme.tooltip}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: forceDark ? "#a1a1aa" : undefined }} />
        {target != null && (
          <ReferenceLine
            y={target}
            stroke={theme.target}
            strokeDasharray="6 4"
            label={{
              value: `Target ${target.toLocaleString()}`,
              fontSize: 11,
              fill: theme.target,
              position: "insideTopRight",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="Abia"
          stroke={accent}
          strokeWidth={2.4}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="Nigeria"
          stroke={MUTED}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Vertical bars comparing composite scores across groups (e.g. sectors). */
export function ScoreBarChart({
  points,
  height = 240,
}: {
  points: Array<{ label: string; score: number | null; color?: string }>;
  height?: number;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={theme.axis}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          interval={0}
        />
        <YAxis domain={[0, 100]} tick={theme.axis} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
          contentStyle={theme.tooltip}
          cursor={{ fill: theme.cursorFill }}
        />
        <Bar dataKey="score" name="Score" radius={[5, 5, 0, 0]} fill={ACCENT} isAnimationActive={false}>
          {points.map((p, i) => (
            <Cell key={i} fill={p.color ?? ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Radar showing Result vs Nigeria vs target on a shared 0-100 scale.
 * Values should already be target-normalized scores where 100 means the
 * target has been met.
 */
export function ScoreRadarChart({
  points,
  resultName = "Result",
  nigeriaName = "Nigeria",
  color = ACCENT,
  height = 300,
}: {
  points: Array<{ axis: string; result: number | null; nigeria?: number | null; target?: number | null }>;
  resultName?: string;
  nigeriaName?: string;
  color?: string;
  height?: number;
}) {
  const theme = useChartTheme();
  const data = points.map((p) => ({ ...p, target: p.target ?? 100 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
        <PolarGrid stroke={theme.grid} />
        <PolarAngleAxis dataKey="axis" tick={theme.angleTick} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Target"
          dataKey="target"
          stroke={theme.target}
          strokeDasharray="5 4"
          strokeWidth={1.4}
          fill="none"
          isAnimationActive={false}
        />
        <Radar
          name={nigeriaName}
          dataKey="nigeria"
          stroke={MUTED}
          strokeDasharray="4 3"
          strokeWidth={1.8}
          fill={MUTED}
          fillOpacity={0.06}
          isAnimationActive={false}
        />
        <Radar
          name={resultName}
          dataKey="result"
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.16}
          isAnimationActive={false}
        />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
          contentStyle={theme.tooltip}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Compact donut chart for showing service/entity mix. */
export function DonutChart({
  points,
  height = 220,
}: {
  points: Array<{ label: string; value: number; color: string }>;
  height?: number;
}) {
  const theme = useChartTheme();
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (total <= 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-zinc-400">No distribution data yet.</div>;
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={points}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {points.map((point) => (
              <Cell key={point.label} fill={point.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [
              typeof v === "number" ? v.toLocaleString() : String(v ?? ""),
              String(name),
            ]}
            contentStyle={theme.tooltip}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2">
        {points.map((point) => (
          <div key={point.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: point.color }} />
              <span className="truncate text-zinc-600">{point.label}</span>
            </span>
            <span className="font-semibold text-zinc-900">{point.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full pie chart for real parts-of-a-whole splits such as enrolment gender share. */
export function FullPieChart({
  points,
  height = 220,
}: {
  points: Array<{ label: string; value: number; color: string }>;
  height?: number;
}) {
  const theme = useChartTheme();
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (total <= 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-zinc-400">No pie data yet.</div>;
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={points}
            dataKey="value"
            nameKey="label"
            outerRadius="82%"
            label={({ name, percent, x, y, textAnchor }) => (
              <text x={x} y={y} textAnchor={textAnchor} fill={theme.axis.fill} fontSize={11}>
                {`${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              </text>
            )}
            labelLine={{ stroke: theme.grid }}
            isAnimationActive={false}
          >
            {points.map((point) => (
              <Cell key={point.label} fill={point.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [
              `${typeof v === "number" ? v.toLocaleString() : String(v ?? "")}%`,
              String(name),
            ]}
            contentStyle={theme.tooltip}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2">
        {points.map((point) => (
          <div key={point.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-zinc-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: point.color }} />
              {point.label}
            </span>
            <span className="font-semibold text-zinc-900">{point.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

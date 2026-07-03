"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

const AXIS = { fontSize: 11, fill: "#71717a" };
const GRID = "#e4e4e7";
const TOOLTIP_STYLE = { borderRadius: 10, border: "1px solid #e4e4e7", fontSize: 12 };
const MUTED = "#a1a1aa"; // zinc-400 — comparisons
const ACCENT = "#14683c"; // abia green — the default data color

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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
          contentStyle={TOOLTIP_STYLE}
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
            dot={false} isAnimationActive={false}
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
}: {
  points: Array<{ label: string; Abia: number | null; Nigeria: number | null }>;
  target: number | null;
  unit: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
        <Tooltip
          formatter={(v) => [`${typeof v === "number" ? v.toLocaleString() : String(v ?? "")} ${unit}`]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {target != null && (
          <ReferenceLine
            y={target}
            stroke="#92400e"
            strokeDasharray="6 4"
            label={{ value: `Target ${target.toLocaleString()}`, fontSize: 11, fill: "#92400e", position: "insideTopRight" }}
          />
        )}
        <Line type="monotone" dataKey="Abia" stroke={ACCENT} strokeWidth={2.4} dot={false} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="Nigeria" stroke={MUTED} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={46} />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(161,161,170,0.08)" }}
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
 * Radar showing how far composite scores sit from the target.
 * Scores are target-normalized (target = 100), so the outer ring is the
 * target itself and the shaded shape is current performance.
 */
export function ScoreRadarChart({
  points,
  name = "Composite score",
  color = ACCENT,
  height = 300,
}: {
  points: Array<{ axis: string; score: number | null }>;
  name?: string;
  color?: string;
  height?: number;
}) {
  const data = points.map((p) => ({ ...p, target: 100 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#52525b" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Target"
          dataKey="target"
          stroke="#92400e"
          strokeDasharray="5 4"
          strokeWidth={1.4}
          fill="none"
          isAnimationActive={false}
        />
        <Radar
          name={name}
          dataKey="score"
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.16}
          isAnimationActive={false}
        />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

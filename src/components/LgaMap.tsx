"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ABIA_LGA_ATTRIBUTION } from "@/lib/abia-lga-geo";
import { lgaMapGeometry } from "@/lib/lga-map";
import { fmt, ratingFor } from "@/lib/scoring";
import type { Lga } from "@/lib/types";

const LEGEND = [
  { score: 100, label: "Excellent" },
  { score: 80, label: "Meets expectation" },
  { score: 60, label: "Close" },
  { score: 20, label: "Off track" },
  { score: null, label: "Not yet reported" },
];

/**
 * Choropleth of Abia's 17 LGAs coloured by composite score. Select an LGA to
 * open its dashboard; `selectedId` highlights one (LGA pages use the map as
 * a locator).
 */
export default function LgaMap({
  lgas,
  scores,
  selectedId,
  compact = false,
}: {
  lgas: Lga[];
  /** LGA id → composite score */
  scores: Record<string, number | null>;
  selectedId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const geometry = useMemo(() => lgaMapGeometry(lgas, 600), [lgas]);
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = geometry.shapes.find((s) => s.lga?.id === (hovered ?? selectedId)) ?? null;
  const focusScore = focus?.lga ? (scores[focus.lga.id] ?? null) : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        className={`mx-auto block w-full ${compact ? "max-w-[220px]" : "max-w-[460px]"}`}
        role="img"
        aria-label="Map of Abia State's local government areas, coloured by composite score"
      >
        {geometry.shapes.map((shape) => {
          const score = shape.lga ? (scores[shape.lga.id] ?? null) : null;
          const band = ratingFor(score);
          const selected = shape.lga?.id === selectedId;
          const active = shape.lga?.id === hovered;
          const dimmed = compact && selectedId && !selected;
          return (
            <path
              key={shape.name}
              d={shape.path}
              fill={band.color}
              fillOpacity={dimmed ? 0.25 : active || selected ? 0.95 : 0.7}
              strokeWidth={selected ? 3 : 1.2}
              strokeLinejoin="round"
              className={`cursor-pointer transition-[fill-opacity] ${
                selected ? "stroke-zinc-950 dark:stroke-white" : "stroke-white dark:stroke-zinc-900"
              }`}
              onMouseEnter={() => setHovered(shape.lga?.id ?? null)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => shape.lga && router.push(`/lgas/${shape.lga.id}`)}
            >
              <title>
                {shape.lga?.name ?? shape.name}: {score == null ? "Not yet reported" : `${fmt(score, 0)} — ${band.label}`}
              </title>
            </path>
          );
        })}
        {!compact &&
          geometry.shapes.map((shape) => (
            <text
              key={`label-${shape.name}`}
              x={shape.label[0]}
              y={shape.label[1]}
              textAnchor="middle"
              className="pointer-events-none fill-zinc-900 text-[13px] font-semibold dark:fill-white"
              style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.7)", strokeWidth: 3 }}
            >
              {(shape.lga?.name ?? shape.name).replace(/ (North|South|East|West)$/, (m) => ` ${m.trim()[0]}.`)}
            </text>
          ))}
      </svg>

      {!compact && (
        <>
          <div className="mt-3 min-h-10 text-center text-sm">
            {focus?.lga ? (
              <>
                <span className="font-semibold text-zinc-900">{focus.lga.name}</span>
                <span className="text-zinc-500">
                  {" "}
                  · {focusScore == null ? "Not yet reported" : `${fmt(focusScore, 0)} — ${ratingFor(focusScore).label}`}
                </span>
                <div className="text-xs text-zinc-400">Select to open the {focus.lga.name} dashboard</div>
              </>
            ) : (
              <span className="text-zinc-400">Hover or tap an LGA, then select it to open its dashboard</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ratingFor(item.score).color }} />
                {item.label}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="mt-2 text-center text-[10px] text-zinc-400">{ABIA_LGA_ATTRIBUTION}</div>
    </div>
  );
}

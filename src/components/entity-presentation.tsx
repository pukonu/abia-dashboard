"use client";

import { ChevronLeft, ChevronRight, Presentation, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { IndicatorTrendChart } from "@/components/charts";
import { fmt, ratingFor } from "@/lib/scoring";
import type { IndicatorFreshness } from "@/lib/time-period";
import type { Direction } from "@/lib/types";

export interface SlideOption {
  letter: string;
  text: string;
  selected: boolean;
}

export type Slide =
  | {
      kind: "cover";
      title: string;
      subtitle: string;
      period: string;
      score: number | null;
      /** e.g. "May 2026 field assessment" or "Data through June 2026" */
      metaLine?: string;
      /** e.g. "6 domains · 42 questions" or "11 sectors · 17 LGAs" */
      statsLine?: string;
      domainCount?: number;
      questionCount?: number;
    }
  | {
      kind: "domain";
      /** Eyebrow prefix before the number, default "Domain" */
      eyebrow?: string;
      number: string;
      name: string;
      benchmark: string | null;
      score: number | null;
      questionCount: number;
      position: string;
      /** Caption under the big score */
      scoreCaption?: string;
    }
  | {
      kind: "question";
      domainLabel: string;
      code: string;
      question: string;
      score: number | null;
      comparison: string | null;
      stateScore: number | null;
      options: SlideOption[];
      rationale: string | null;
      period: string;
      /** Footer line under the score, default `${period} assessment` */
      periodLabel?: string;
      stateLabel?: string;
      /** Formatted latest Abia value for story slides */
      valueLabel?: string | null;
      valueUnit?: string | null;
      valueChange?: number | null;
      valueChangeSuffix?: string;
      direction?: Direction;
      freshness?: IndicatorFreshness;
      nigeriaLabel?: string | null;
      targetLabel?: string | null;
      previousLabel?: string | null;
      chart?: {
        points: Array<{ label: string; Abia: number | null; Nigeria: number | null }>;
        target: number | null;
        unit: string;
      } | null;
    };

function BigScore({ score }: { score: number | null }) {
  const band = ratingFor(score);
  return (
    <div className="flex items-baseline gap-4">
      <span
        className="display text-7xl font-semibold tabular-nums sm:text-8xl"
        style={{ color: band.color }}
      >
        {score == null ? "—" : fmt(score, 0)}
      </span>
      <span className="text-lg font-medium text-zinc-400">/ 100 · {band.label}</span>
    </div>
  );
}

function FreshnessBadge({ freshness }: { freshness?: IndicatorFreshness }) {
  if (!freshness || freshness === "current") return null;
  const styles =
    freshness === "stale"
      ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
      : freshness === "due"
        ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
        : "border-zinc-500/40 bg-zinc-500/15 text-zinc-300";
  const label =
    freshness === "stale" ? "Stale data" : freshness === "due" ? "Update due" : "No data";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {label}
    </span>
  );
}

function DirectionBadge({
  value,
  suffix,
  direction = "higher_is_better",
}: {
  value: number | null | undefined;
  suffix?: string;
  direction?: Direction;
}) {
  if (value == null) return null;
  if (Math.abs(value) < 0.05) {
    return <span className="text-sm font-medium text-zinc-400">— steady vs previous</span>;
  }
  const up = value > 0;
  const improved = direction === "lower_is_better" ? !up : up;
  return (
    <span className={`text-sm font-semibold ${improved ? "text-emerald-300" : "text-rose-300"}`}>
      {up ? "▲" : "▼"} {fmt(Math.abs(value), 1)}
      {suffix ? ` ${suffix}` : ""} vs previous
    </span>
  );
}

function SlideBody({ slide }: { slide: Slide }) {
  if (slide.kind === "cover") {
    const band = ratingFor(slide.score);
    const statsLine =
      slide.statsLine ??
      (slide.domainCount != null && slide.questionCount != null
        ? `${slide.domainCount} domains · ${slide.questionCount} questions`
        : null);
    const metaLine = slide.metaLine ?? (slide.period ? `${slide.period} assessment` : null);
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
          Abia State · Executive Performance Dashboard
        </div>
        <h1 className="display max-w-3xl text-5xl font-semibold text-white sm:text-6xl">{slide.title}</h1>
        <p className="mt-4 max-w-xl text-base text-zinc-400">{slide.subtitle}</p>
        <div className="mt-10 flex items-center gap-8">
          <div
            className="display text-8xl font-semibold tabular-nums"
            style={{ color: band.color }}
          >
            {slide.score == null ? "—" : fmt(slide.score, 0)}
          </div>
          <div className="text-left text-sm leading-relaxed text-zinc-400">
            <div className="font-semibold text-zinc-200">{band.label}</div>
            {metaLine && <div>{metaLine}</div>}
            {statsLine && <div>{statsLine}</div>}
          </div>
        </div>
        <div className="mt-12 text-xs text-zinc-500">Use ← → to navigate · Esc to exit</div>
      </div>
    );
  }

  if (slide.kind === "domain") {
    const eyebrow = slide.eyebrow ?? "Domain";
    return (
      <div className="flex h-full flex-col justify-center">
        <div className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
          {eyebrow}
          {slide.number ? ` ${slide.number}` : ""} · {slide.position}
        </div>
        <h2 className="display max-w-4xl text-4xl font-semibold text-white sm:text-6xl">{slide.name}</h2>
        {slide.benchmark && <p className="mt-5 max-w-2xl text-base text-zinc-400">{slide.benchmark}</p>}
        <div className="mt-10">
          <BigScore score={slide.score} />
          <div className="mt-2 text-sm text-zinc-500">
            {slide.scoreCaption ??
              `Weighted score across ${slide.questionCount} indicator${slide.questionCount === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>
    );
  }

  const hasStory = slide.valueLabel != null || slide.chart != null || slide.freshness != null;
  const band = ratingFor(slide.score);

  return (
    <div className="flex h-full flex-col justify-center py-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
          {slide.domainLabel}
        </div>
        <FreshnessBadge freshness={slide.freshness} />
      </div>
      <div className="flex items-start gap-4">
        <span className="mt-1 shrink-0 rounded-md bg-white/10 px-2.5 py-1 font-mono text-sm font-semibold text-zinc-200">
          {slide.code}
        </span>
        <h2 className="display max-w-4xl text-2xl font-medium leading-snug text-white sm:text-[2rem]">
          {slide.question}
        </h2>
      </div>

      {hasStory ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
          <div>
            <div className="flex items-baseline gap-3">
              <span
                className="display text-5xl font-semibold tabular-nums sm:text-6xl"
                style={{ color: band.color }}
              >
                {slide.valueLabel ?? "—"}
              </span>
              {slide.valueUnit ? (
                <span className="text-base font-medium text-zinc-400">{slide.valueUnit}</span>
              ) : null}
            </div>
            <div className="mt-3">
              <DirectionBadge
                value={slide.valueChange}
                suffix={slide.valueChangeSuffix ?? undefined}
                direction={slide.direction}
              />
            </div>
            {slide.comparison && (
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-400">{slide.comparison}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
              {slide.score != null && (
                <div>
                  Score{" "}
                  <span className="font-semibold text-zinc-200" style={{ color: band.color }}>
                    {fmt(slide.score, 0)}
                  </span>
                  <span className="text-zinc-500"> / 100 · {band.label}</span>
                </div>
              )}
              {slide.nigeriaLabel && (
                <div>
                  Nigeria <span className="font-semibold text-zinc-300">{slide.nigeriaLabel}</span>
                </div>
              )}
              {slide.targetLabel && (
                <div>
                  Target <span className="font-semibold text-zinc-300">{slide.targetLabel}</span>
                </div>
              )}
            </div>
            <div className="mt-3 text-sm text-zinc-500">
              {slide.periodLabel ?? `${slide.period} assessment`}
            </div>
            {slide.rationale && (
              <p className="mt-6 max-w-md border-l-2 border-emerald-500/50 pl-4 text-sm leading-relaxed text-zinc-400">
                {slide.rationale}
              </p>
            )}
          </div>

          {slide.chart ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Trend
              </div>
              <IndicatorTrendChart
                points={slide.chart.points}
                target={slide.chart.target}
                unit={slide.chart.unit}
                height={220}
                forceDark
              />
            </div>
          ) : slide.options.length > 0 ? (
            <div className="space-y-2 self-center">
              {slide.options.map((o) => (
                <div
                  key={o.letter}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-snug transition-colors ${
                    o.selected
                      ? "border-emerald-400/60 bg-emerald-400/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-zinc-500"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      o.selected ? "bg-emerald-400 text-emerald-950" : "bg-white/10 text-zinc-400"
                    }`}
                  >
                    {o.letter}
                  </span>
                  <span>{o.text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <BigScore score={slide.score} />
            <div className="mt-3 space-y-1 text-sm text-zinc-500">
              {slide.comparison && <div>{slide.comparison}</div>}
              {slide.stateScore != null && (
                <div>
                  {slide.stateLabel ?? "State average"}:{" "}
                  <span className="font-semibold text-zinc-300">{fmt(slide.stateScore, 0)} / 100</span>
                </div>
              )}
              <div>{slide.periodLabel ?? `${slide.period} assessment`}</div>
            </div>
            {slide.rationale && (
              <p className="mt-6 max-w-md border-l-2 border-emerald-500/50 pl-4 text-sm leading-relaxed text-zinc-400">
                {slide.rationale}
              </p>
            )}
          </div>

          {slide.options.length > 0 && (
            <div className="space-y-2 self-center">
              {slide.options.map((o) => (
                <div
                  key={o.letter}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-snug transition-colors ${
                    o.selected
                      ? "border-emerald-400/60 bg-emerald-400/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-zinc-500"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      o.selected ? "bg-emerald-400 text-emerald-950" : "bg-white/10 text-zinc-400"
                    }`}
                  >
                    {o.letter}
                  </span>
                  <span>{o.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Full-screen executive presentation deck with the shared Present CTA. */
export function PresentationDeck({ slides }: { slides: Slide[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");

  const go = useCallback(
    (delta: number) => {
      setDirection(delta >= 0 ? "fwd" : "back");
      setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + delta)));
    },
    [slides.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, go, slides.length]);

  if (slides.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
      >
        <Presentation className="h-3.5 w-3.5" strokeWidth={1.5} />
        Present
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 60% at 70% 0%, rgba(16,185,129,0.08) 0%, transparent 60%), radial-gradient(60% 50% at 10% 100%, rgba(16,185,129,0.05) 0%, transparent 60%)",
            }}
          />

          <div className="relative z-10 flex items-center justify-between px-6 py-4">
            <div className="text-xs font-medium text-zinc-500">
              {index + 1} <span className="text-zinc-700">/</span> {slides.length}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Exit presentation"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-8 sm:px-16 lg:px-28">
            <div key={index} className={`h-full ${direction === "fwd" ? "slide-enter" : "slide-enter-back"}`}>
              <SlideBody slide={slides[index]} />
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-4 px-6 py-4">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${((index + 1) / slides.length) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === slides.length - 1}
              className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** @deprecated Prefer PresentationDeck — kept for existing entity imports. */
export const EntityPresentation = PresentationDeck;

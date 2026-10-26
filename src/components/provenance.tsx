import { describeSource, type ValueSource } from "@/lib/indicator-collection";
import type { SeriesPoint } from "@/lib/scoring";

const BADGE: Record<ValueSource, { label: string; className: string }> = {
  entered: {
    label: "Entered",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  rollup: {
    label: "Rolled up",
    className: "bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-500/40",
  },
  override: {
    label: "Override",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-500/40",
  },
};

type SourcePoint = Pick<SeriesPoint, "source" | "rollup" | "enteredBy" | "updatedAt" | "overrideNote">;

/** Small pill saying where a statewide figure came from. Hidden for plain entries unless `showEntered`. */
export function SourceBadge({ point, showEntered = false }: { point: SourcePoint | null | undefined; showEntered?: boolean }) {
  if (!point || (point.source === "entered" && !showEntered)) return null;
  const badge = BADGE[point.source];
  return (
    <span
      title={describeSource(point)}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

/** Full provenance line, e.g. "Manual override · A. Okafor · 3 Jul 2026 — LGA returns incomplete". */
export function SourceNote({ point }: { point: SourcePoint | null | undefined }) {
  if (!point) return null;
  return (
    <span className={point.source === "override" ? "text-amber-700 dark:text-amber-300" : "text-zinc-500"}>
      {describeSource(point)}
    </span>
  );
}

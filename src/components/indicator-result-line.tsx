import type { ReactNode } from "react";
import { SourceBadge } from "@/components/provenance";
import { fmtValue, type SeriesPoint } from "@/lib/scoring";

type Value = number | string | null | undefined;

export function formatIndicatorMetric(value: Value, unit: string): string {
  if (typeof value === "number") return fmtValue(value, unit);
  if (typeof value === "string" && value.trim()) return value;
  return "—";
}

export function IndicatorResultLine({
  result,
  nigeria,
  target,
  unit,
  targetSource,
  resultLabel = "Result",
  prefix,
  className = "",
  source,
}: {
  result: Value;
  nigeria: Value;
  target: Value;
  unit: string;
  targetSource?: string | null;
  resultLabel?: string;
  prefix?: ReactNode;
  className?: string;
  /** latest statewide point — shows a Rolled up / Override pill next to the result */
  source?: SeriesPoint | null;
}) {
  const targetText = formatIndicatorMetric(target, unit);
  const targetSuffix =
    targetSource && targetText !== "—" && typeof target !== "string" ? ` (${targetSource})` : "";

  return (
    <div className={`mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 ${className}`.trim()}>
      {prefix ? <span>{prefix}</span> : null}
      <span>
        {resultLabel} <strong className="text-zinc-700">{formatIndicatorMetric(result, unit)}</strong>
        {source ? (
          <>
            {" "}
            <SourceBadge point={source} />
          </>
        ) : null}
      </span>
      <span>
        Nigeria <strong className="text-zinc-700">{formatIndicatorMetric(nigeria, unit)}</strong>
      </span>
      <span>
        Target <strong className="text-zinc-700">{targetText}</strong>
        {targetSuffix}
      </span>
    </div>
  );
}

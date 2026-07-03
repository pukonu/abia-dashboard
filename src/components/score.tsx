import { fmt, ratingFor } from "@/lib/scoring";

/** Small colored pill showing a 0–100 composite score. */
export function ScoreBadge({ score, showLabel = false }: { score: number | null; showLabel?: boolean }) {
  const band = ratingFor(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${band.bgClass} ${band.textClass}`}
    >
      {score == null ? "—" : fmt(score, 0)}
      {showLabel && <span className="font-medium opacity-75">· {band.label}</span>}
    </span>
  );
}

/** Up/down change tag in score points. */
export function DeltaTag({ value, suffix = "pts" }: { value: number | null; suffix?: string }) {
  if (value == null || Math.abs(value) < 0.05) {
    return <span className="text-xs font-medium text-zinc-400">— steady</span>;
  }
  const up = value > 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-green-800" : "text-red-800"}`}>
      {up ? "▲" : "▼"} {fmt(Math.abs(value), 1)} {suffix}
    </span>
  );
}

/** Circular gauge for headline composite scores. */
export function ScoreRing({
  score,
  size = 120,
  label,
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const band = ratingFor(score);
  const stroke = size >= 100 ? 9 : 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = score == null ? 0 : (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={band.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display font-semibold text-zinc-900" style={{ fontSize: size / 3.6 }}>
          {score == null ? "—" : fmt(score, 0)}
        </span>
        <span className="text-[11px] font-medium text-zinc-500">{label ?? band.label}</span>
      </div>
    </div>
  );
}

/** Abia · Nigeria · Target comparison line for a domain benchmark. */
export function BenchmarkLine({
  abia,
  nigeria,
  target,
}: {
  abia: number | null;
  nigeria?: string | null;
  target?: string | null;
}) {
  if (abia == null && !nigeria && !target) return null;
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
      <span>
        Abia <strong className="font-semibold text-zinc-800">{abia == null ? "—" : `${fmt(abia, 1)}%`}</strong>
      </span>
      {nigeria && (
        <span>
          Nigeria <strong className="font-semibold text-zinc-700">{nigeria}</strong>
        </span>
      )}
      {target && (
        <span>
          Target <strong className="font-semibold text-zinc-700">{target}</strong>
        </span>
      )}
    </p>
  );
}

/** Horizontal progress bar variant, for dense lists. */
export function ScoreBar({ score }: { score: number | null }) {
  const band = ratingFor(score);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${score ?? 0}%`, backgroundColor: band.color }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-700">
        {score == null ? "—" : fmt(score, 0)}
      </span>
    </div>
  );
}

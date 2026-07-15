/** UTC calendar date as YYYYMMDD. */
export function utcDatePrefix(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Vite-compatible build stamp: YYYYMMDDHHmmss (UTC). */
export function formatViteBuildStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function incrementStamp(stamp: string): string {
  const digits = stamp.replace(/\D/g, "");
  if (digits.length !== 14) return formatViteBuildStamp();
  // BigInt avoids Number precision issues on 14-digit values.
  return (BigInt(digits) + 1n).toString().padStart(14, "0");
}

/**
 * Next comparable build stamp, always YYYYMMDDHHmmss so it sorts with the
 * PWA's Vite-injected `__APP_BUILD__`.
 *
 * Legacy stamps like `2026071501` (date + sequence) are ignored — minting from
 * the current UTC clock instead — because they do not compare correctly with
 * 14-digit Vite builds under lexicographic `<`.
 */
export function nextAutoBuildId(previous: string | null | undefined, now = new Date()): string {
  const stamp = formatViteBuildStamp(now);
  const prev = (previous ?? "").replace(/\D/g, "");

  // Continue from a full Vite stamp only when it is at/after "now"
  // (double-publish within the same second, or clock skew).
  if (prev.length === 14 && prev >= stamp) {
    return incrementStamp(prev);
  }

  return stamp;
}

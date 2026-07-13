/** UTC calendar date as YYYYMMDD. */
export function utcDatePrefix(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/**
 * Next comparable build stamp: today's UTC date + an increment.
 * Examples: 2026071301 → 2026071302; or after a Vite stamp 20260713094122 → 20260713094123.
 */
export function nextAutoBuildId(previous: string | null | undefined, now = new Date()): string {
  const date = utcDatePrefix(now);
  if (previous?.startsWith(date)) {
    const suffix = previous.slice(8).replace(/\D/g, "");
    const n = Number.parseInt(suffix, 10);
    if (Number.isFinite(n)) {
      const width = Math.max(2, suffix.length);
      return `${date}${String(n + 1).padStart(width, "0")}`;
    }
  }
  return `${date}01`;
}

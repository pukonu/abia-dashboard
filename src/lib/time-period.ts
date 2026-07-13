import type { Frequency } from "./types";

/** Format a calendar date as YYYY-MM-DD in UTC. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDate(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Monday of the ISO week containing `d` (UTC). */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

/**
 * HTML `<input type="week">` value (`YYYY-Www`) for the ISO week containing `d`.
 * Week-year can differ from the calendar year near year boundaries.
 */
export function toIsoWeekValue(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday of this week determines the ISO week-year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
}

/** Monday (YYYY-MM-DD) for an HTML week input value `YYYY-Www`. */
export function mondayFromIsoWeekValue(isoWeek: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek.trim());
  if (!match) return null;
  const weekYear = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  // 4 Jan is always in ISO week 1 of weekYear.
  const mondayWeek1 = startOfWeekMonday(new Date(Date.UTC(weekYear, 0, 4)));
  return toIsoDate(addDays(mondayWeek1, (week - 1) * 7));
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
}

export function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 0));
}

export function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

export function endOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function labelForPeriod(frequency: Frequency, start: Date, _end?: Date): string {
  void _end;
  const day = start.getUTCDate();
  const month = MONTH_SHORT[start.getUTCMonth()];
  const year = start.getUTCFullYear();
  switch (frequency) {
    case "daily":
      return `${day} ${month} ${year}`;
    case "weekly":
      return `Week of ${day} ${month} ${year}`;
    case "monthly":
      return `${month} ${year}`;
    case "quarterly": {
      const q = Math.floor(start.getUTCMonth() / 3) + 1;
      return `${year} Q${q}`;
    }
    case "yearly":
      return String(year);
  }
}

/** Normalize an arbitrary date into the period window for a frequency. */
export function periodBoundsForDate(
  frequency: Frequency,
  isoDate: string
): { startDate: string; endDate: string; label: string } {
  const d = parseIsoDate(isoDate);
  let start: Date;
  let end: Date;
  switch (frequency) {
    case "daily":
      start = d;
      end = d;
      break;
    case "weekly":
      start = startOfWeekMonday(d);
      end = addDays(start, 6);
      break;
    case "monthly":
      start = startOfMonth(d);
      end = endOfMonth(d);
      break;
    case "quarterly":
      start = startOfQuarter(d);
      end = endOfQuarter(d);
      break;
    case "yearly":
      start = startOfYear(d);
      end = endOfYear(d);
      break;
  }
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    label: labelForPeriod(frequency, start, end),
  };
}

/**
 * Build recent provisional period options (newest first) when the DB has none yet.
 * `id` is the period start date — used as a temporary key until ensure-on-save.
 */
export function provisionalPeriods(
  frequency: Frequency,
  count = frequency === "weekly" ? 52 : frequency === "yearly" ? 8 : 16,
  todayIso = toIsoDate(new Date())
): Array<{ id: string; label: string; startDate: string }> {
  const today = parseIsoDate(todayIso);
  const out: Array<{ id: string; label: string; startDate: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < count * 2 && out.length < count; i++) {
    let cursor: Date;
    switch (frequency) {
      case "daily":
        cursor = addDays(today, -i);
        break;
      case "weekly":
        cursor = addDays(startOfWeekMonday(today), -7 * i);
        break;
      case "monthly":
        cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
        break;
      case "quarterly":
        cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i * 3, 1));
        break;
      case "yearly":
        cursor = new Date(Date.UTC(today.getUTCFullYear() - i, 0, 1));
        break;
    }
    const bounds = periodBoundsForDate(frequency, toIsoDate(cursor));
    if (seen.has(bounds.startDate)) continue;
    seen.add(bounds.startDate);
    out.push({
      id: `provisional:${bounds.startDate}`,
      label: bounds.label,
      startDate: bounds.startDate,
    });
  }
  return out;
}

export function isProvisionalPeriodId(id: string): boolean {
  return id.startsWith("provisional:");
}

export function provisionalStartDate(id: string): string | null {
  if (!isProvisionalPeriodId(id)) return null;
  return id.slice("provisional:".length);
}

export type IndicatorFreshness = "current" | "due" | "stale" | "missing";

/**
 * Compare latest reported period to the calendar period that should be current today.
 * - current: reading covers this period (or later)
 * - due: still inside the current period, but latest is only the previous one
 * - stale: current period already ended (or more than one period behind) without a reading
 * - missing: no readings at all
 */
export function indicatorFreshness(
  latestPeriod: { start_date: string; end_date: string } | null | undefined,
  frequency: Frequency,
  todayIso = toIsoDate(new Date())
): IndicatorFreshness {
  if (!latestPeriod) return "missing";

  const current = periodBoundsForDate(frequency, todayIso);
  if (latestPeriod.start_date >= current.startDate) return "current";

  const dayBeforeCurrent = toIsoDate(addDays(parseIsoDate(current.startDate), -1));
  const previous = periodBoundsForDate(frequency, dayBeforeCurrent);
  const today = parseIsoDate(todayIso);
  const currentStillOpen = today <= parseIsoDate(current.endDate);

  if (latestPeriod.start_date === previous.startDate && currentStillOpen) return "due";
  return "stale";
}

export function freshnessCaption(
  freshness: IndicatorFreshness,
  latestLabel: string | null | undefined,
  frequency: Frequency
): string {
  const periodWord =
    frequency === "daily"
      ? "daily"
      : frequency === "weekly"
        ? "weekly"
        : frequency === "monthly"
          ? "monthly"
          : frequency === "quarterly"
            ? "quarterly"
            : "yearly";
  switch (freshness) {
    case "missing":
      return `No ${periodWord} reading reported yet`;
    case "current":
      return latestLabel ? `Current · ${latestLabel}` : "Current period reported";
    case "due":
      return latestLabel
        ? `Update due · last reported ${latestLabel}`
        : "Update due for the current period";
    case "stale":
      return latestLabel
        ? `Stale · last reported ${latestLabel}`
        : "Stale · reporting overdue";
  }
}

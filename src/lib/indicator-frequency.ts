import type { Frequency, Indicator } from "./types";

const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export const DEFAULT_INDICATOR_FREQUENCY: Frequency = "monthly";

export function isFrequency(value: unknown): value is Frequency {
  return typeof value === "string" && (FREQUENCIES as string[]).includes(value);
}

/**
 * Effective reporting cadence for an indicator.
 * Explicit indicator frequency wins; otherwise defaults to monthly
 * (can be changed manually in Manage → Indicators).
 */
export function indicatorFrequency(
  indicator: Pick<Indicator, "frequency">,
  _thematic?: unknown
): Frequency {
  void _thematic;
  return isFrequency(indicator.frequency) ? indicator.frequency : DEFAULT_INDICATOR_FREQUENCY;
}

export function frequencyLabel(frequency: Frequency): string {
  switch (frequency) {
    case "daily":
      return "day";
    case "weekly":
      return "week";
    case "monthly":
      return "month";
    case "quarterly":
      return "quarter";
    case "yearly":
      return "year";
  }
}

export function reportingPeriodLabel(frequency: Frequency): string {
  switch (frequency) {
    case "daily":
      return "Reporting day";
    case "weekly":
      return "Reporting week";
    case "monthly":
      return "Reporting month";
    case "quarterly":
      return "Reporting quarter";
    case "yearly":
      return "Reporting year";
  }
}

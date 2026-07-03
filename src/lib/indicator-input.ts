import type { Indicator, IndicatorScoreOption, IndicatorValueType } from "./types";

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseLegacyScoreOptions(description: string | null | undefined): IndicatorScoreOption[] | null {
  const lines = String(description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const optionLines = lines
    .map((line) => {
      const match = line.match(/^([A-E])\.\s+(.+)$/i);
      if (!match) return null;
      return { code: match[1].toUpperCase(), label: match[2].trim() };
    })
    .filter((line): line is { code: string; label: string } => line !== null);
  if (optionLines.length < 2) return null;

  const last = optionLines.length - 1;
  return optionLines.map((option, index) => ({
    code: option.code,
    label: option.label,
    value: roundScore((100 * (last - index)) / last),
  }));
}

export function parseScoreOptionsText(text: string | null | undefined): IndicatorScoreOption[] | null {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const options: IndicatorScoreOption[] = [];
  for (const line of lines) {
    const match = line.match(
      /^(?:([A-Za-z0-9]+)[.)-]\s*)?(.+?)\s*(?:=|:)\s*(-?\d+(?:\.\d+)?)$/
    );
    if (!match) return null;
    const [, rawCode, rawLabel, rawValue] = match;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return null;
    options.push({
      code: rawCode?.trim() || undefined,
      label: rawLabel.trim(),
      value,
    });
  }
  return options.length >= 2 ? options : null;
}

export function formatScoreOptionsText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const option = item as Partial<IndicatorScoreOption>;
      if (typeof option.label !== "string" || typeof option.value !== "number") return null;
      const prefix = option.code ? `${option.code}. ` : "";
      return `${prefix}${option.label} = ${option.value}`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function normalizeIndicatorValueType(indicator: Partial<Indicator>): IndicatorValueType {
  if (indicator.value_type) return indicator.value_type;
  if (resolveIndicatorScoreOptions(indicator)) return "score";
  return indicator.unit === "%" ? "percentage" : "number";
}

export function resolveIndicatorScoreOptions(indicator: Partial<Indicator>): IndicatorScoreOption[] | null {
  if (Array.isArray(indicator.score_options) && indicator.score_options.length >= 2) {
    return indicator.score_options
      .map((option) => ({
        code: option.code ?? undefined,
        label: option.label,
        value: Number(option.value),
      }))
      .filter((option) => option.label && Number.isFinite(option.value));
  }
  return parseLegacyScoreOptions(indicator.description);
}

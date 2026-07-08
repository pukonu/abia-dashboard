import { abiaFootprintStats, sectorIndicatorMix } from "./executive-insights";
import { computeDashboard, delta, fmt, fmtValue, ratingFor } from "./scoring";
import type { DashboardData } from "./types";

export const AI_SKILLS = [
  {
    id: "executive_briefing",
    label: "Executive briefing",
    description: "Summarize statewide performance, coverage and priority talking points.",
  },
  {
    id: "sector_analysis",
    label: "Sector analysis",
    description: "Explain how a sector is performing and which themes or indicators drive it.",
  },
  {
    id: "lga_analysis",
    label: "LGA analysis",
    description: "Compare LGAs using measured entity readings and highlight leaders or gaps.",
  },
  {
    id: "indicator_lookup",
    label: "Indicator lookup",
    description: "Answer questions about configured indicators, latest values, targets and trends.",
  },
  {
    id: "entity_lookup",
    label: "Entity lookup",
    description: "Answer questions about measured facilities, schools, commands and projects.",
  },
  {
    id: "data_quality",
    label: "Data quality",
    description: "Identify missing values, sparse areas and what needs more data.",
  },
] as const;

export const AI_TOPICS = [
  "state overview",
  "sector performance",
  "LGA comparison",
  "indicators and targets",
  "entities and facilities",
  "data completeness",
] as const;

type TopicId = (typeof AI_TOPICS)[number];

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function selectTopics(question: string): TopicId[] {
  const q = question.toLowerCase();
  const topics = new Set<TopicId>();
  if (includesAny(q, ["sector", "health", "education", "security", "agriculture", "road"])) topics.add("sector performance");
  if (includesAny(q, ["lga", "local government", "aba", "umuahia", "ohafia"])) topics.add("LGA comparison");
  if (includesAny(q, ["indicator", "target", "benchmark", "trend", "score"])) topics.add("indicators and targets");
  if (includesAny(q, ["facility", "school", "hospital", "phc", "entity", "project"])) topics.add("entities and facilities");
  if (includesAny(q, ["missing", "blank", "complete", "coverage", "data quality"])) topics.add("data completeness");
  if (topics.size === 0) topics.add("state overview");
  return [...topics];
}

function latestPeriodLabel(data: DashboardData): string {
  return data.timePeriods
    .slice()
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]?.label ?? "No reporting period";
}

function stateOverviewTool(data: DashboardData) {
  const c = computeDashboard(data);
  return {
    stateScore: c.stateScore.score == null ? null : Number(c.stateScore.score.toFixed(1)),
    rating: ratingFor(c.stateScore.score).label,
    changeVsPrevious: delta(c.stateScore),
    latestPeriod: latestPeriodLabel(data),
    sectors: data.sectors.length,
    lgas: data.lgas.length,
    entities: data.entities.length,
    indicators: data.indicators.length,
    results: data.results.length,
    abiaFootprint: abiaFootprintStats(data),
    indicatorCoverageBySector: sectorIndicatorMix(data),
  };
}

function sectorsTool(data: DashboardData) {
  const c = computeDashboard(data);
  return data.sectors.map((sector) => {
    const pair = c.sectorScores.get(sector.id) ?? { score: null, prevScore: null };
    const themes = data.thematicAreas
      .filter((theme) => theme.sector_id === sector.id)
      .map((theme) => ({
        name: theme.name,
        score: c.thematicScores.get(theme.id)?.score == null
          ? null
          : Number((c.thematicScores.get(theme.id)?.score ?? 0).toFixed(1)),
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return {
      name: sector.name,
      description: sector.description,
      score: pair.score == null ? null : Number(pair.score.toFixed(1)),
      rating: ratingFor(pair.score).label,
      changeVsPrevious: delta(pair),
      strongestThemes: themes.slice(0, 3),
      weakestThemes: themes.slice(-3).reverse(),
    };
  });
}

function lgasTool(data: DashboardData) {
  const c = computeDashboard(data);
  const scored = c.lgaScores.filter((lga) => lga.score != null);
  return {
    leading: scored.slice(0, 5).map((item) => ({
      name: item.lga.name,
      zone: item.lga.zone,
      score: Number((item.score ?? 0).toFixed(1)),
      readings: item.readings,
    })),
    needsAttention: scored.slice(-5).reverse().map((item) => ({
      name: item.lga.name,
      zone: item.lga.zone,
      score: Number((item.score ?? 0).toFixed(1)),
      readings: item.readings,
    })),
    withoutScores: data.lgas.length - scored.length,
  };
}

function indicatorsTool(data: DashboardData) {
  const c = computeDashboard(data);
  const stateIndicators = c.indicators.filter((item) => item.indicator.indicator_scope !== "entity");
  return {
    lowestScores: stateIndicators
      .filter((item) => item.score != null)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 8)
      .map((item) => ({
        name: item.indicator.name,
        sector: item.sector.name,
        domain: item.domain.name,
        latest: item.latest ? fmtValue(item.latest.abia, item.indicator.unit) : null,
        target: item.latest?.target ?? item.indicator.target_value,
        score: Number((item.score ?? 0).toFixed(1)),
      })),
    strongestScores: stateIndicators
      .filter((item) => item.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 8)
      .map((item) => ({
        name: item.indicator.name,
        sector: item.sector.name,
        latest: item.latest ? fmtValue(item.latest.abia, item.indicator.unit) : null,
        score: Number((item.score ?? 0).toFixed(1)),
      })),
  };
}

function entitiesTool(data: DashboardData) {
  const c = computeDashboard(data);
  const byType = new Map<string, number>();
  for (const entity of data.entities) byType.set(entity.entity_type, (byType.get(entity.entity_type) ?? 0) + 1);
  return {
    countsByType: [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    leadingEntities: c.entityScores
      .filter((entity) => entity.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 8)
      .map((entity) => ({
        name: entity.entity.name,
        type: entity.entity.entity_type,
        lga: entity.lga.name,
        sector: entity.sector.name,
        score: Number((entity.score ?? 0).toFixed(1)),
        readings: entity.readings,
      })),
  };
}

function dataQualityTool(data: DashboardData) {
  const stateIndicatorIds = new Set(data.indicators.filter((indicator) => indicator.indicator_scope !== "entity").map((i) => i.id));
  const entityIndicatorIds = new Set(data.indicators.filter((indicator) => indicator.indicator_scope === "entity").map((i) => i.id));
  const stateResults = data.results.filter((result) => stateIndicatorIds.has(result.indicator_id));
  const entityResults = data.results.filter((result) => entityIndicatorIds.has(result.indicator_id));
  return {
    periods: data.timePeriods.length,
    stateIndicators: stateIndicatorIds.size,
    entityIndicators: entityIndicatorIds.size,
    stateResults: stateResults.length,
    entityResults: entityResults.length,
    resultDensity: data.indicators.length === 0 ? "0%" : `${fmt((data.results.length / data.indicators.length) * 100, 1)}%`,
  };
}

export function buildAssistantContext(data: DashboardData, question: string) {
  const topics = selectTopics(question);
  const tools = {
    state_overview: stateOverviewTool(data),
    sectors: topics.includes("sector performance") || topics.includes("state overview") ? sectorsTool(data) : undefined,
    lgas: topics.includes("LGA comparison") ? lgasTool(data) : undefined,
    indicators: topics.includes("indicators and targets") || topics.includes("data completeness") ? indicatorsTool(data) : undefined,
    entities: topics.includes("entities and facilities") ? entitiesTool(data) : undefined,
    data_quality: topics.includes("data completeness") ? dataQualityTool(data) : undefined,
  };

  return {
    skills: AI_SKILLS,
    selectedTopics: topics,
    tools,
  };
}

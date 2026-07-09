import { abiaFootprintStats, sectorIndicatorMix } from "./executive-insights";
import { computeDashboard, delta, fmt, fmtValue, ratingFor, type Computed } from "./scoring";
import { isSectorDashboardThematic, sectorDashboardThematic } from "./sector-dashboard";
import type { DashboardData, ThematicArea } from "./types";

/**
 * Lookup priority for the AI assistant:
 * 1. Sector Dashboard (executive monthly framework) — first point of call
 * 2. Other statewide indicator results
 * 3. Entity-level readings (facilities, schools, etc.)
 */
export const AI_LOOKUP_PRIORITY = [
  {
    rank: 1,
    id: "sector_dashboard",
    label: "Sector Dashboard",
    description:
      "Executive Sector Dashboard indicators and monthly statewide readings. Always check here first.",
  },
  {
    rank: 2,
    id: "statewide_other",
    label: "Other statewide records",
    description:
      "Statewide indicator results outside the Sector Dashboard framework (assessment themes, legacy series).",
  },
  {
    rank: 3,
    id: "entity_records",
    label: "Entity-based records",
    description:
      "Facility / school / command / project readings that roll up from measured entities.",
  },
] as const;

export const AI_SKILLS = [
  {
    id: "sector_dashboard_first",
    label: "Sector Dashboard first",
    description:
      "Answer from the Sector Dashboard framework before any other source. Prefer filled monthly executive indicators.",
  },
  {
    id: "executive_briefing",
    label: "Executive briefing",
    description: "Summarize statewide performance using Sector Dashboard readings when available.",
  },
  {
    id: "sector_analysis",
    label: "Sector analysis",
    description:
      "Explain sector performance from Sector Dashboard domains first, then other statewide themes, then entities.",
  },
  {
    id: "lga_analysis",
    label: "LGA analysis",
    description: "Compare LGAs using measured entity readings and highlight leaders or gaps.",
  },
  {
    id: "indicator_lookup",
    label: "Indicator lookup",
    description:
      "Look up indicators in order: Sector Dashboard → other statewide → entity-level.",
  },
  {
    id: "entity_lookup",
    label: "Entity lookup",
    description:
      "Answer about facilities/schools only after Sector Dashboard and other statewide sources are checked.",
  },
  {
    id: "data_quality",
    label: "Data quality",
    description:
      "Flag Sector Dashboard blanks first, then other statewide gaps, then sparse entity coverage.",
  },
] as const;

export const AI_TOPICS = [
  "sector dashboard",
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

  // Sector Dashboard is the default first stop for almost every factual question.
  const asksEntitiesOnly =
    includesAny(q, ["facility", "school", "hospital", "phc", "entity", "project", "command"]) &&
    !includesAny(q, ["sector", "state", "dashboard", "indicator", "coverage", "score", "overview"]);

  if (!asksEntitiesOnly) topics.add("sector dashboard");

  if (includesAny(q, ["sector", "health", "education", "security", "agriculture", "road", "power", "economy"])) {
    topics.add("sector performance");
    topics.add("sector dashboard");
  }
  if (includesAny(q, ["lga", "local government", "aba", "umuahia", "ohafia"])) topics.add("LGA comparison");
  if (includesAny(q, ["indicator", "target", "benchmark", "trend", "score", "phc", "immunisation", "birth"])) {
    topics.add("indicators and targets");
    topics.add("sector dashboard");
  }
  if (includesAny(q, ["facility", "school", "hospital", "phc", "entity", "project"])) {
    topics.add("entities and facilities");
  }
  if (includesAny(q, ["missing", "blank", "complete", "coverage", "data quality", "empty"])) {
    topics.add("data completeness");
    topics.add("sector dashboard");
  }
  if (topics.size === 0 || includesAny(q, ["overview", "governor", "brief", "summary", "state"])) {
    topics.add("state overview");
    topics.add("sector dashboard");
  }
  return [...topics];
}

function latestPeriodLabel(data: DashboardData): string {
  return data.timePeriods
    .slice()
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]?.label ?? "No reporting period";
}

function sectorDashboardIds(data: DashboardData): Set<string> {
  return new Set(data.thematicAreas.filter(isSectorDashboardThematic).map((t) => t.id));
}

function isSectorDashboardIndicator(
  item: { thematicArea: ThematicArea },
  dashboardIds: Set<string>
): boolean {
  return dashboardIds.has(item.thematicArea.id) || isSectorDashboardThematic(item.thematicArea);
}

function mapIndicatorRow(item: Computed["indicators"][number]) {
  return {
    name: item.indicator.name,
    sector: item.sector.name,
    thematicArea: item.thematicArea.name,
    domain: item.domain.name,
    unit: item.indicator.unit,
    description: item.indicator.description ?? null,
    latest: item.latest ? fmtValue(item.latest.abia, item.indicator.unit) : null,
    latestRaw: item.latest?.abia ?? null,
    period: item.latest?.period.label ?? null,
    target: item.latest?.target ?? item.indicator.target_value,
    score: item.score == null ? null : Number(item.score.toFixed(1)),
    hasData: item.latest != null,
    sourceLayer: isSectorDashboardThematic(item.thematicArea)
      ? ("sector_dashboard" as const)
      : item.indicator.indicator_scope === "entity"
        ? ("entity" as const)
        : ("statewide_other" as const),
  };
}

function stateOverviewTool(data: DashboardData) {
  const c = computeDashboard(data);
  const dashboardIds = sectorDashboardIds(data);
  const sdIndicators = c.indicators.filter(
    (item) =>
      item.indicator.indicator_scope !== "entity" && isSectorDashboardIndicator(item, dashboardIds)
  );
  const filled = sdIndicators.filter((item) => item.latest != null);
  return {
    lookupPriority: AI_LOOKUP_PRIORITY,
    stateScore: c.stateScore.score == null ? null : Number(c.stateScore.score.toFixed(1)),
    rating: ratingFor(c.stateScore.score).label,
    changeVsPrevious: delta(c.stateScore),
    latestPeriod: latestPeriodLabel(data),
    sectors: data.sectors.length,
    lgas: data.lgas.length,
    entities: data.entities.length,
    indicators: data.indicators.length,
    results: data.results.length,
    sectorDashboard: {
      frameworks: data.sectors
        .map((sector) => {
          const theme = sectorDashboardThematic(data.thematicAreas, sector.id);
          if (!theme) return null;
          const inds = sdIndicators.filter((i) => i.sector.id === sector.id);
          const withData = inds.filter((i) => i.latest != null);
          return {
            sector: sector.name,
            thematicArea: theme.name,
            frequency: theme.frequency,
            indicators: inds.length,
            filled: withData.length,
            blank: inds.length - withData.length,
          };
        })
        .filter(Boolean),
      filledReadings: filled.length,
      blankIndicators: sdIndicators.length - filled.length,
    },
    abiaFootprint: abiaFootprintStats(data),
    indicatorCoverageBySector: sectorIndicatorMix(data),
  };
}

function sectorDashboardTool(data: DashboardData) {
  const c = computeDashboard(data);
  const dashboardIds = sectorDashboardIds(data);

  return data.sectors
    .map((sector) => {
      const theme = sectorDashboardThematic(data.thematicAreas, sector.id);
      if (!theme) return null;

      const indicators = c.indicators
        .filter(
          (item) =>
            item.sector.id === sector.id &&
            item.indicator.indicator_scope !== "entity" &&
            isSectorDashboardIndicator(item, dashboardIds)
        )
        .map(mapIndicatorRow);

      const domains = data.domains
        .filter((d) => d.thematic_area_id === theme.id)
        .map((domain) => {
          const domainIndicators = indicators.filter((i) => i.domain === domain.name);
          return {
            name: domain.name,
            filled: domainIndicators.filter((i) => i.hasData).length,
            blank: domainIndicators.filter((i) => !i.hasData).length,
            indicators: domainIndicators,
          };
        });

      const filled = indicators.filter((i) => i.hasData);
      const blank = indicators.filter((i) => !i.hasData);

      return {
        sector: sector.name,
        thematicArea: theme.name,
        frequency: theme.frequency,
        description: theme.description,
        summary: {
          indicators: indicators.length,
          filled: filled.length,
          blank: blank.length,
        },
        filledIndicators: filled.slice(0, 40),
        blankIndicators: blank.slice(0, 40),
        domains,
        note:
          filled.length > 0
            ? "Use these Sector Dashboard readings as the primary answer source for this sector."
            : "Sector Dashboard framework exists but has no monthly readings yet — fall back to other statewide, then entity records.",
      };
    })
    .filter(Boolean);
}

function sectorsTool(data: DashboardData) {
  const c = computeDashboard(data);
  const dashboardIds = sectorDashboardIds(data);

  return data.sectors.map((sector) => {
    const pair = c.sectorScores.get(sector.id) ?? { score: null, prevScore: null };
    const theme = sectorDashboardThematic(data.thematicAreas, sector.id);
    const sdIndicators = c.indicators.filter(
      (item) =>
        item.sector.id === sector.id &&
        item.indicator.indicator_scope !== "entity" &&
        isSectorDashboardIndicator(item, dashboardIds)
    );
    const sdFilled = sdIndicators.filter((item) => item.latest != null);

    const themes = data.thematicAreas
      .filter((t) => t.sector_id === sector.id)
      .map((t) => ({
        name: t.name,
        isSectorDashboard: isSectorDashboardThematic(t),
        score: c.thematicScores.get(t.id)?.score == null
          ? null
          : Number((c.thematicScores.get(t.id)?.score ?? 0).toFixed(1)),
      }))
      .sort((a, b) => {
        if (a.isSectorDashboard !== b.isSectorDashboard) return a.isSectorDashboard ? -1 : 1;
        return (b.score ?? -1) - (a.score ?? -1);
      });

    return {
      name: sector.name,
      description: sector.description,
      score: pair.score == null ? null : Number(pair.score.toFixed(1)),
      rating: ratingFor(pair.score).label,
      changeVsPrevious: delta(pair),
      sectorDashboard: theme
        ? {
            thematicArea: theme.name,
            frequency: theme.frequency,
            indicators: sdIndicators.length,
            filled: sdFilled.length,
            blank: sdIndicators.length - sdFilled.length,
            sampleFilled: sdFilled.slice(0, 8).map(mapIndicatorRow),
            sampleBlank: sdIndicators
              .filter((i) => i.latest == null)
              .slice(0, 8)
              .map(mapIndicatorRow),
          }
        : null,
      strongestThemes: themes.slice(0, 3),
      weakestThemes: themes.filter((t) => !t.isSectorDashboard).slice(-3).reverse(),
    };
  });
}

function lgasTool(data: DashboardData) {
  const c = computeDashboard(data);
  const scored = c.lgaScores.filter((lga) => lga.score != null);
  return {
    sourceLayer: "entity_records",
    note: "LGA composites come from entity readings — use only after Sector Dashboard / statewide checks.",
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
  const dashboardIds = sectorDashboardIds(data);
  const stateIndicators = c.indicators.filter((item) => item.indicator.indicator_scope !== "entity");

  const sectorDashboard = stateIndicators.filter((item) =>
    isSectorDashboardIndicator(item, dashboardIds)
  );
  const statewideOther = stateIndicators.filter(
    (item) => !isSectorDashboardIndicator(item, dashboardIds)
  );

  const rank = (items: typeof stateIndicators, direction: "low" | "high") =>
    items
      .filter((item) => item.score != null)
      .sort((a, b) =>
        direction === "low" ? (a.score ?? 0) - (b.score ?? 0) : (b.score ?? 0) - (a.score ?? 0)
      )
      .slice(0, 8)
      .map(mapIndicatorRow);

  return {
    lookupPriority: AI_LOOKUP_PRIORITY,
    sectorDashboard: {
      filled: sectorDashboard.filter((i) => i.latest != null).length,
      blank: sectorDashboard.filter((i) => i.latest == null).length,
      lowestScores: rank(sectorDashboard, "low"),
      strongestScores: rank(sectorDashboard, "high"),
      blankSample: sectorDashboard
        .filter((i) => i.latest == null)
        .slice(0, 12)
        .map(mapIndicatorRow),
    },
    statewideOther: {
      filled: statewideOther.filter((i) => i.latest != null).length,
      blank: statewideOther.filter((i) => i.latest == null).length,
      lowestScores: rank(statewideOther, "low"),
      strongestScores: rank(statewideOther, "high"),
      note: "Use only when Sector Dashboard has no matching reading.",
    },
  };
}

function entitiesTool(data: DashboardData) {
  const c = computeDashboard(data);
  const byType = new Map<string, number>();
  for (const entity of data.entities) byType.set(entity.entity_type, (byType.get(entity.entity_type) ?? 0) + 1);
  return {
    sourceLayer: "entity_records",
    note: "Entity records are the last fallback after Sector Dashboard and other statewide results.",
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
  const c = computeDashboard(data);
  const dashboardIds = sectorDashboardIds(data);
  const stateIndicatorIds = new Set(
    data.indicators.filter((indicator) => indicator.indicator_scope !== "entity").map((i) => i.id)
  );
  const entityIndicatorIds = new Set(
    data.indicators.filter((indicator) => indicator.indicator_scope === "entity").map((i) => i.id)
  );
  const sdIndicators = c.indicators.filter(
    (item) =>
      item.indicator.indicator_scope !== "entity" && isSectorDashboardIndicator(item, dashboardIds)
  );
  const otherStatewide = c.indicators.filter(
    (item) =>
      item.indicator.indicator_scope !== "entity" && !isSectorDashboardIndicator(item, dashboardIds)
  );

  return {
    lookupPriority: AI_LOOKUP_PRIORITY,
    periods: data.timePeriods.length,
    sectorDashboard: {
      indicators: sdIndicators.length,
      filled: sdIndicators.filter((i) => i.latest != null).length,
      blank: sdIndicators.filter((i) => i.latest == null).length,
      blankNames: sdIndicators
        .filter((i) => i.latest == null)
        .slice(0, 20)
        .map((i) => `${i.sector.name}: ${i.indicator.name}`),
    },
    statewideOther: {
      indicators: otherStatewide.length,
      filled: otherStatewide.filter((i) => i.latest != null).length,
      blank: otherStatewide.filter((i) => i.latest == null).length,
    },
    entityIndicators: entityIndicatorIds.size,
    stateResults: data.results.filter((result) => stateIndicatorIds.has(result.indicator_id)).length,
    entityResults: data.results.filter((result) => entityIndicatorIds.has(result.indicator_id)).length,
    resultDensity:
      data.indicators.length === 0
        ? "0%"
        : `${fmt((data.results.length / data.indicators.length) * 100, 1)}%`,
  };
}

export function buildAssistantContext(data: DashboardData, question: string) {
  const topics = selectTopics(question);
  const wantsSectorDashboard =
    topics.includes("sector dashboard") ||
    topics.includes("state overview") ||
    topics.includes("sector performance") ||
    topics.includes("indicators and targets") ||
    topics.includes("data completeness");

  const tools = {
    lookup_priority: AI_LOOKUP_PRIORITY,
    sector_dashboard: wantsSectorDashboard ? sectorDashboardTool(data) : undefined,
    state_overview:
      topics.includes("state overview") || topics.includes("sector dashboard")
        ? stateOverviewTool(data)
        : undefined,
    sectors:
      topics.includes("sector performance") || topics.includes("state overview") || topics.includes("sector dashboard")
        ? sectorsTool(data)
        : undefined,
    lgas: topics.includes("LGA comparison") ? lgasTool(data) : undefined,
    indicators:
      topics.includes("indicators and targets") ||
      topics.includes("data completeness") ||
      topics.includes("sector dashboard")
        ? indicatorsTool(data)
        : undefined,
    entities: topics.includes("entities and facilities") ? entitiesTool(data) : undefined,
    data_quality: topics.includes("data completeness") ? dataQualityTool(data) : undefined,
  };

  return {
    skills: AI_SKILLS,
    selectedTopics: topics,
    lookupPriority: AI_LOOKUP_PRIORITY,
    tools,
  };
}

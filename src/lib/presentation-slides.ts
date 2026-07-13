import type { Slide } from "@/components/entity-presentation";
import { formatIndicatorMetric } from "@/components/indicator-result-line";
import { sectorNigeriaScore } from "@/lib/benchmark-comparisons";
import { indicatorFrequency } from "@/lib/indicator-frequency";
import { isSectorDashboardThematic, sectorDashboardThematic } from "@/lib/sector-dashboard";
import type { Computed, IndicatorComputed } from "@/lib/scoring";
import { delta, fmt, ratingFor } from "@/lib/scoring";
import {
  freshnessCaption,
  indicatorFreshness,
  type IndicatorFreshness,
} from "@/lib/time-period";
import type { DashboardData, Direction, Sector } from "@/lib/types";

function periodLabel(asOf: string): string {
  if (!asOf) return "Latest reporting period";
  return new Date(asOf + "T00:00:00Z").toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });
}

function asOfFromComputed(c: Computed): string {
  return c.indicators
    .map((i) => i.latest?.period.start_date ?? "")
    .reduce((a, b) => (b > a ? b : a), "");
}

function valueChangeFor(item: IndicatorComputed): number | null {
  if (item.latest?.abia == null || item.previous?.abia == null) return null;
  return item.latest.abia - item.previous.abia;
}

function directionVerb(change: number, direction: Direction): string {
  const up = change > 0;
  const improved = direction === "lower_is_better" ? !up : up;
  if (Math.abs(change) < 0.05) return "held steady";
  if (improved) return up ? "improved" : "improved (down)";
  return up ? "worsened (up)" : "worsened";
}

function buildIndicatorStory(item: IndicatorComputed): string {
  const unit = item.indicator.unit;
  const latest = item.latest;
  const change = valueChangeFor(item);
  const bits: string[] = [];

  if (latest?.abia != null) {
    bits.push(`Abia stands at ${formatIndicatorMetric(latest.abia, unit)}`);
  } else {
    bits.push("No Abia reading for the latest period yet");
  }

  if (change != null && item.previous) {
    const abs = formatIndicatorMetric(Math.abs(change), unit);
    const verb = directionVerb(change, item.indicator.direction);
    bits.push(
      `${verb} by ${abs} versus ${item.previous.period.label} (${formatIndicatorMetric(item.previous.abia, unit)})`
    );
  }

  const nigeria = latest?.nigeria ?? null;
  if (nigeria != null && latest?.abia != null) {
    const gap = latest.abia - nigeria;
    const ahead = item.indicator.direction === "lower_is_better" ? gap < 0 : gap > 0;
    bits.push(
      ahead
        ? `ahead of Nigeria at ${formatIndicatorMetric(nigeria, unit)}`
        : `behind Nigeria at ${formatIndicatorMetric(nigeria, unit)}`
    );
  }

  const target = latest?.target ?? item.indicator.target_value;
  if (target != null) {
    bits.push(`target ${formatIndicatorMetric(target, unit)}`);
  }

  return bits.join(" · ");
}

function buildQuestionSlide(
  item: IndicatorComputed,
  code: string,
  fallbackPeriod: string
): Extract<Slide, { kind: "question" }> {
  const freq = indicatorFrequency(item.indicator, item.thematicArea);
  const reported = item.latest?.period.label ?? fallbackPeriod;
  const freshness: IndicatorFreshness = indicatorFreshness(item.latest?.period, freq);
  const change = valueChangeFor(item);
  const target = item.latest?.target ?? item.indicator.target_value;
  const nigeria = item.latest?.nigeria ?? null;
  const trendPoints = [...item.series]
    .sort((a, b) => a.period.start_date.localeCompare(b.period.start_date))
    .map((pt) => ({
      label: pt.period.label,
      Abia: pt.abia,
      Nigeria: pt.nigeria,
    }));

  return {
    kind: "question",
    domainLabel: item.domain.name,
    code,
    question: item.indicator.name,
    score: item.score,
    comparison: buildIndicatorStory(item),
    stateScore: item.score,
    options: [],
    rationale: null,
    period: reported,
    periodLabel: freshnessCaption(freshness, item.latest?.period.label, freq),
    stateLabel: "Indicator score",
    valueLabel: formatIndicatorMetric(item.latest?.abia ?? null, item.indicator.unit),
    valueUnit: item.indicator.unit,
    valueChange: change,
    valueChangeSuffix: item.indicator.unit,
    direction: item.indicator.direction,
    freshness,
    nigeriaLabel: nigeria != null ? formatIndicatorMetric(nigeria, item.indicator.unit) : null,
    targetLabel: target != null ? formatIndicatorMetric(target, item.indicator.unit) : null,
    previousLabel: item.previous
      ? `${formatIndicatorMetric(item.previous.abia, item.indicator.unit)} · ${item.previous.period.label}`
      : null,
    chart:
      trendPoints.length >= 2
        ? {
            points: trendPoints,
            target,
            unit: item.indicator.unit,
          }
        : null,
  };
}

/** Statewide executive deck for the overview Present CTA. */
export function buildOverviewSlides(data: DashboardData, c: Computed): Slide[] {
  const asOf = asOfFromComputed(c);
  const period = periodLabel(asOf);
  const stateIndicators = c.indicators.filter((i) => i.indicator.indicator_scope !== "entity");
  const rankedLgas = c.lgaScores.filter((l) => l.score != null);
  const topLgas = rankedLgas.slice(0, 3);
  const bottomLgas = rankedLgas.slice(-3).reverse();
  const attention = [...stateIndicators]
    .filter((i) => i.score != null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 5);

  const slides: Slide[] = [
    {
      kind: "cover",
      title: "The State of Abia",
      subtitle: "Executive performance across every sector, LGA and priority indicator.",
      period,
      score: c.stateScore.score,
      metaLine: `Latest data through ${period}`,
      statsLine: `${data.sectors.length} sectors · ${data.lgas.length} LGAs · ${stateIndicators.length} sector indicators`,
    },
  ];

  const scoredSectors = data.sectors
    .map((sector) => ({
      sector,
      pair: c.sectorScores.get(sector.id) ?? { score: null, prevScore: null },
      nigeria: sectorNigeriaScore(c, sector.id),
      indicatorCount: stateIndicators.filter((i) => i.sector.id === sector.id).length,
      latestPeriod: stateIndicators
        .filter((i) => i.sector.id === sector.id && i.latest)
        .map((i) => i.latest!.period.label)
        .at(-1),
    }))
    .filter((s) => s.pair.score != null)
    .sort((a, b) => (b.pair.score ?? 0) - (a.pair.score ?? 0));

  scoredSectors.forEach((item, index) => {
    const d = delta(item.pair);
    const change =
      d == null ? null : `${d >= 0 ? "+" : ""}${fmt(d, 1)} pts vs previous period`;
    const nigeria =
      item.nigeria != null ? `Nigeria benchmark ${fmt(item.nigeria, 0)} / 100` : null;
    slides.push({
      kind: "domain",
      eyebrow: "Sector",
      number: String(index + 1),
      name: item.sector.name,
      benchmark:
        [change, nigeria, item.latestPeriod ? `Latest period ${item.latestPeriod}` : null, item.sector.description]
          .filter(Boolean)
          .join(" · ") || null,
      score: item.pair.score,
      questionCount: item.indicatorCount,
      position: `${index + 1} of ${scoredSectors.length}`,
      scoreCaption: `${item.indicatorCount} sector indicator${item.indicatorCount === 1 ? "" : "s"} · ${ratingFor(item.pair.score).label}${
        item.latestPeriod ? ` · as of ${item.latestPeriod}` : ""
      }`,
    });
  });

  if (topLgas.length > 0 || bottomLgas.length > 0) {
    const leading = topLgas.map((l, i) => `${i + 1}. ${l.lga.name} (${fmt(l.score!, 0)})`).join(" · ");
    const trailing = bottomLgas.map((l) => `${l.lga.name} (${fmt(l.score!, 0)})`).join(" · ");
    slides.push({
      kind: "domain",
      eyebrow: "LGAs",
      number: "",
      name: "Local government highlights",
      benchmark: [
        leading ? `Leading: ${leading}` : null,
        trailing ? `Needs attention: ${trailing}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      score: topLgas[0]?.score ?? null,
      questionCount: rankedLgas.length,
      position: `${rankedLgas.length} of ${data.lgas.length} scored`,
      scoreCaption: "Highest LGA composite shown · all 17 LGAs ranked from entity readings",
    });
  }

  attention.forEach((item, index) => {
    slides.push(buildQuestionSlide(item, String(index + 1).padStart(2, "0"), period));
  });

  return slides;
}

/** Sector executive deck — Sector Dashboard indicators only. */
export function buildSectorSlides(data: DashboardData, c: Computed, sector: Sector): Slide[] {
  const pair = c.sectorScores.get(sector.id) ?? { score: null, prevScore: null };
  const dashboardTheme = sectorDashboardThematic(data.thematicAreas, sector.id);
  const sectorIndicators = c.indicators
    .filter(
      (i) =>
        i.sector.id === sector.id &&
        i.indicator.indicator_scope !== "entity" &&
        isSectorDashboardThematic(i.thematicArea)
    )
    .sort((a, b) => a.indicator.name.localeCompare(b.indicator.name, undefined, { numeric: true }));
  const asOf = sectorIndicators
    .map((i) => i.latest?.period.start_date ?? "")
    .reduce((a, b) => (b > a ? b : a), "");
  const period = periodLabel(asOf);
  const dashboardScore =
    dashboardTheme != null
      ? (c.thematicScores.get(dashboardTheme.id)?.score ?? null)
      : pair.score;
  const domainGroups = dashboardTheme
    ? data.domains
        .filter((dom) => dom.thematic_area_id === dashboardTheme.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((domain) => ({
          domain,
          indicators: sectorIndicators.filter((i) => i.domain.id === domain.id),
        }))
        .filter((g) => g.indicators.length > 0)
    : [];
  const d =
    dashboardTheme != null
      ? delta(c.thematicScores.get(dashboardTheme.id) ?? { score: null, prevScore: null })
      : delta(pair);

  const staleCount = sectorIndicators.filter((i) => {
    const freq = indicatorFrequency(i.indicator, i.thematicArea);
    return indicatorFreshness(i.latest?.period, freq) === "stale";
  }).length;

  const slides: Slide[] = [
    {
      kind: "cover",
      title: sector.name,
      subtitle: dashboardTheme
        ? `Sector Dashboard · ${sector.description}`
        : sector.description,
      period,
      score: dashboardScore,
      metaLine: `Latest data through ${period}${d != null ? ` · ${d >= 0 ? "+" : ""}${fmt(d, 1)} pts vs previous` : ""}`,
      statsLine: dashboardTheme
        ? `${domainGroups.length} domain${domainGroups.length === 1 ? "" : "s"} · ${sectorIndicators.length} indicators${
            staleCount > 0 ? ` · ${staleCount} stale` : ""
          }`
        : "No Sector Dashboard thematic area configured for this sector",
    },
  ];

  if (!dashboardTheme) {
    return slides;
  }

  domainGroups.forEach(({ domain, indicators }, domainIndex) => {
    const scored = indicators.filter((i) => i.score != null);
    const score =
      scored.length > 0
        ? scored.reduce((sum, i) => sum + (i.score ?? 0), 0) / scored.length
        : null;
    const latestLabels = [
      ...new Set(indicators.filter((i) => i.latest).map((i) => i.latest!.period.label)),
    ];
    const domainStale = indicators.filter((i) => {
      const freq = indicatorFrequency(i.indicator, i.thematicArea);
      return indicatorFreshness(i.latest?.period, freq) === "stale";
    }).length;

    slides.push({
      kind: "domain",
      eyebrow: "Domain",
      number: String(domainIndex + 1),
      name: domain.name,
      benchmark: [
        latestLabels.length > 0 ? `Latest periods: ${latestLabels.join(", ")}` : "No readings yet",
        domainStale > 0 ? `${domainStale} stale indicator${domainStale === 1 ? "" : "s"}` : null,
        domain.benchmark_nigeria ? `Nigeria ${domain.benchmark_nigeria}` : null,
        domain.benchmark_target ? `Target ${domain.benchmark_target}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      score,
      questionCount: indicators.length,
      position: `${domainIndex + 1} of ${domainGroups.length}`,
      scoreCaption: `${indicators.filter((i) => i.latest).length}/${indicators.length} with data · ${ratingFor(score).label}`,
    });

    indicators.forEach((item, indicatorIndex) => {
      slides.push(
        buildQuestionSlide(
          item,
          `${domainIndex + 1}.${indicatorIndex + 1}`,
          period
        )
      );
    });
  });

  return slides;
}

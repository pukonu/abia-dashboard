import { notFound } from "next/navigation";
import { IndicatorTrendChart } from "@/components/charts";
import { formatIndicatorMetric, IndicatorResultLine } from "@/components/indicator-result-line";
import { SourceBadge, SourceNote } from "@/components/provenance";
import { DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import { CardList, Crumbs, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import {
  COLLECTED_AT_OPTIONS,
  coverageLabel,
  describeCountCondition,
  rollupMethodLabel,
} from "@/lib/indicator-collection";
import { computeDashboard, delta, fmt, fmtValue, scoreValue } from "@/lib/scoring";

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default async function IndicatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadDashboardData();
  const c = computeDashboard(data);
  const ic = c.indicatorById.get(id);
  if (!ic) notFound();

  const { indicator, domain, thematicArea, sector } = ic;
  const higherBetter = indicator.direction === "higher_is_better";

  const chartPoints = ic.series.map((pt) => ({
    label: pt.period.label,
    Abia: pt.abia,
    Nigeria: pt.nigeria,
  }));

  // Latest per-entity readings for this indicator
  const periodById = new Map(data.timePeriods.map((p) => [p.id, p]));
  const entityById = new Map(data.entities.map((e) => [e.id, e]));
  const lgaById = new Map(data.lgas.map((l) => [l.id, l]));
  const latestByEntity = new Map<string, { value: number; start: string; periodLabel: string }>();
  for (const r of data.results) {
    if (r.indicator_id !== indicator.id || r.entity_id == null) continue;
    const period = periodById.get(r.time_period_id);
    if (!period) continue;
    const prev = latestByEntity.get(r.entity_id);
    if (!prev || period.start_date > prev.start) {
      latestByEntity.set(r.entity_id, {
        value: r.abia_value,
        start: period.start_date,
        periodLabel: period.label,
      });
    }
  }
  const entityRows = [...latestByEntity.entries()]
    .map(([entityId, reading]) => {
      const entity = entityById.get(entityId);
      if (!entity) return null;
      return {
        entity,
        lga: lgaById.get(entity.lga_id) ?? null,
        reading,
        score: scoreValue(
          reading.value,
          indicator.facility_target_value ?? indicator.target_value,
          indicator.direction
        ),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) =>
      higherBetter ? b.reading.value - a.reading.value : a.reading.value - b.reading.value
    );

  const lgaRows = c.lgaIndicators
    .filter((v) => v.ic.indicator.id === indicator.id)
    .sort((a, b) => (higherBetter ? b.value - a.value : a.value - b.value));
  const levelLabel = COLLECTED_AT_OPTIONS.find((o) => o.value === ic.collectedAt)?.label ?? "State";
  const collectionSummary =
    ic.collectedAt === "state"
      ? "Collected statewide — one figure per period."
      : ic.rollupMethod === "none"
        ? "Collected per facility — shown on facility, MDA and LGA pages only, not rolled up statewide."
        : `Collected per ${ic.collectedAt === "lga" ? "LGA" : "facility"} and rolled up statewide by ${rollupMethodLabel(
            ic.rollupMethod
          ).toLowerCase()}${ic.rollupMethod === "count" ? ` (counting records where ${describeCountCondition(indicator)})` : ""}. A statewide value entered by hand overrides the roll-up for its period.`;

  const gapToNigeria =
    ic.latest?.abia != null && ic.latest?.nigeria != null
      ? ic.latest.abia - ic.latest.nigeria
      : null;
  const abiaAhead =
    gapToNigeria == null ? null : higherBetter ? gapToNigeria > 0 : gapToNigeria < 0;

  return (
    <>
      <Crumbs
        items={[
          { href: "/indicators", label: "Indicators" },
          { href: `/sectors/${sector.slug}`, label: sector.name },
          { label: indicator.name },
        ]}
      />
      <PageHeader
        eyebrow={`${thematicArea.name} · ${domain.name}`}
        title={indicator.name}
        subtitle={`${FREQ_LABEL[thematicArea.frequency]} reporting · ${
          higherBetter ? "Higher is better" : "Lower is better"
        } · Target ${formatIndicatorMetric(
          domain.benchmark_target ?? ic.latest?.target ?? indicator.target_value,
          indicator.unit
        )}${
          indicator.target_source && !domain.benchmark_target ? ` set by ${indicator.target_source}` : ""
        }`}
      />

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card card-pad">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Result · {ic.latest?.period.label ?? "—"}</div>
          <div className="display mt-1 text-2xl font-semibold text-zinc-900">
            {fmtValue(ic.latest?.abia ?? null, indicator.unit)}
          </div>
          <div className="mt-1">
            <DeltaTag
              value={
                ic.latest?.abia != null && ic.previous?.abia != null
                  ? ic.latest.abia - ic.previous.abia
                  : null
              }
              suffix={indicator.unit}
              direction={indicator.direction}
            />
          </div>
        </div>
        <div className="card card-pad">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Nigeria</div>
          <div className="display mt-1 text-2xl font-semibold text-zinc-900">
            {formatIndicatorMetric(ic.latest?.nigeria ?? domain.benchmark_nigeria ?? null, indicator.unit)}
          </div>
          <div className="mt-1 text-xs font-medium">
            {abiaAhead == null ? (
              <span className="text-zinc-400">No comparison</span>
            ) : abiaAhead ? (
              <span className="text-green-600">Abia ahead of national</span>
            ) : (
              <span className="text-red-600">Abia behind national</span>
            )}
          </div>
        </div>
        <div className="card card-pad">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Target{indicator.target_source && !domain.benchmark_target ? ` · ${indicator.target_source}` : ""}
          </div>
          <div className="display mt-1 text-2xl font-semibold text-zinc-900">
            {formatIndicatorMetric(domain.benchmark_target ?? ic.latest?.target ?? indicator.target_value, indicator.unit)}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {ic.latest?.abia != null && ic.latest?.target != null
              ? `Gap: ${fmt(Math.abs(ic.latest.abia - ic.latest.target), 1)} ${indicator.unit}`
              : ""}
          </div>
        </div>
        <div className="card card-pad flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Score</div>
            <div className="mt-1">
              <DeltaTag value={delta(ic)} />
            </div>
          </div>
          <ScoreRing score={ic.score} size={72} />
        </div>
      </div>

      {/* Provenance */}
      <div className="card card-pad mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">How this figure is built</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {levelLabel}
          </span>
          <SourceBadge point={ic.latest} showEntered />
        </div>
        <p className="mt-2 text-sm text-zinc-600">{collectionSummary}</p>
        {ic.latest && (
          <p className="mt-1 text-sm">
            <span className="font-medium text-zinc-900">{ic.latest.period.label}: </span>
            <SourceNote point={ic.latest} />
          </p>
        )}
        {ic.latest?.source === "override" && (
          <p className="mt-1 text-sm text-zinc-600">
            {ic.latest.rollup
              ? `Without the override, the roll-up from ${coverageLabel(ic.latest.rollup.level, ic.latest.rollup.coverage)} gives ${fmtValue(ic.latest.rollup.value, indicator.unit)}.`
              : "No LGA or facility records have been reported for this period yet."}
          </p>
        )}
      </div>

      {/* Trend */}
      <SectionTitle hint={`${ic.series.length} ${FREQ_LABEL[thematicArea.frequency].toLowerCase()} periods`}>
        Result vs Nigeria vs target
      </SectionTitle>
      <div className="card card-pad">
        <IndicatorTrendChart
          points={chartPoints}
          target={ic.latest?.target ?? indicator.target_value}
          unit={indicator.unit}
        />
      </div>

      {/* Statewide values by period with their source */}
      {ic.series.length > 0 && (
        <>
          <SectionTitle hint="Where each statewide figure came from">Reported values</SectionTitle>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2">Period</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Source</th>
                  <th className="px-3 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {[...ic.series].reverse().map((pt) => (
                  <tr key={pt.period.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-900">{pt.period.label}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-900">
                      {fmtValue(pt.abia, indicator.unit)} <SourceBadge point={pt} />
                    </td>
                    <td className="hidden px-3 py-2 text-xs sm:table-cell">
                      <SourceNote point={pt} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ScoreBadge score={pt.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LGA breakdown */}
      {lgaRows.length > 0 && (
        <>
          <SectionTitle hint={ic.collectedAt === "lga" ? "Latest LGA returns, best first" : "Facility records rolled up per LGA"}>
            Breakdown by LGA
          </SectionTitle>
          <CardList>
            {lgaRows.map((row) => (
              <RowLink
                key={row.lga.id}
                href={`/lgas/${row.lga.id}`}
                left={
                  <>
                    <div className="truncate text-sm font-medium text-zinc-900">{row.lga.name}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {fmtValue(row.value, indicator.unit)} · {row.period.label}
                      {row.source === "facility" ? ` · ${coverageLabel("facility", row.coverage)}` : " · LGA return"}
                      {row.target != null ? ` · target ${fmtValue(row.target, indicator.unit)}` : ""}
                    </div>
                  </>
                }
                right={
                  <div className="flex items-center gap-3">
                    <div className="hidden w-28 sm:block">
                      <ScoreBar score={row.score} />
                    </div>
                    <ScoreBadge score={row.score} />
                  </div>
                }
              />
            ))}
          </CardList>
        </>
      )}

      {/* Evidence */}
      {(() => {
        const resultIds = new Set(
          data.results.filter((r) => r.indicator_id === indicator.id).map((r) => r.id)
        );
        const evidence = data.evidence.filter((e) => resultIds.has(e.result_id));
        if (!evidence.length) return null;
        return (
          <>
            <SectionTitle hint={`${evidence.length} attachment${evidence.length === 1 ? "" : "s"}`}>
              Evidence
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {evidence.map((e) => (
                <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="card overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.url} alt={e.caption ?? "Evidence"} className="h-32 w-full object-cover" />
                  {e.caption && <div className="px-3 py-2 text-xs text-zinc-600">{e.caption}</div>}
                </a>
              ))}
            </div>
          </>
        );
      })()}

      {/* Entity breakdown */}
      {entityRows.length > 0 && (
        <>
          <SectionTitle hint="Latest reading per entity, best first">Breakdown by entity</SectionTitle>
          <CardList>
            {entityRows.map((row) => (
              <RowLink
                key={row.entity.id}
                href={`/entities/${row.entity.id}`}
                left={
                  <>
                    <div className="truncate text-sm font-medium text-zinc-900">{row.entity.name}</div>
                    <IndicatorResultLine
                      result={row.reading.value}
                      nigeria={ic.latest?.nigeria ?? domain.benchmark_nigeria ?? null}
                      target={domain.benchmark_target ?? ic.latest?.target ?? indicator.target_value}
                      unit={indicator.unit}
                      targetSource={indicator.target_source}
                      prefix={
                        <>
                          {row.lga?.name ?? "—"} LGA · {row.reading.periodLabel} ·
                        </>
                      }
                    />
                  </>
                }
                right={
                  <div className="flex items-center gap-3">
                    <div className="hidden w-28 sm:block">
                      <ScoreBar score={row.score} />
                    </div>
                    <ScoreBadge score={row.score} />
                  </div>
                }
              />
            ))}
          </CardList>
        </>
      )}
    </>
  );
}

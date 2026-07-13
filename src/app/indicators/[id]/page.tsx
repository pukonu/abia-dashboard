import { notFound } from "next/navigation";
import { IndicatorTrendChart } from "@/components/charts";
import { formatIndicatorMetric, IndicatorResultLine } from "@/components/indicator-result-line";
import { DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import { CardList, Crumbs, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
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
        score: scoreValue(reading.value, indicator.target_value, indicator.direction),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) =>
      higherBetter ? b.reading.value - a.reading.value : a.reading.value - b.reading.value
    );

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

import { notFound } from "next/navigation";
import { DeltaTag, ScoreBadge, ScoreRing } from "@/components/score";
import { CardList, Crumbs, EmptyState, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { computeDashboard, delta, fmtValue, scoreValue } from "@/lib/scoring";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadDashboardData();
  const entity = data.entities.find((e) => e.id === id);
  if (!entity) notFound();

  const c = computeDashboard(data);
  const ec = c.entityScores.find((e) => e.entity.id === entity.id);
  if (!ec) notFound();

  const periodById = new Map(data.timePeriods.map((p) => [p.id, p]));

  // Latest reading per indicator for this entity
  const byIndicator = new Map<string, { value: number; periodLabel: string; start: string }>();
  for (const r of data.results) {
    if (r.entity_id !== entity.id) continue;
    const period = periodById.get(r.time_period_id);
    if (!period) continue;
    const prev = byIndicator.get(r.indicator_id);
    if (!prev || period.start_date > prev.start) {
      byIndicator.set(r.indicator_id, {
        value: r.abia_value,
        periodLabel: period.label,
        start: period.start_date,
      });
    }
  }

  const readings = [...byIndicator.entries()]
    .map(([indicatorId, reading]) => {
      const ic = c.indicatorById.get(indicatorId);
      if (!ic) return null;
      return {
        ic,
        reading,
        score: scoreValue(reading.value, ic.indicator.target_value, ic.indicator.direction),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101));

  return (
    <>
      <Crumbs
        items={[
          { href: "/mdas", label: "MDAs" },
          { href: `/mdas/${ec.mda.id}`, label: ec.mda.abbreviation },
          { label: entity.name },
        ]}
      />
      <PageHeader
        eyebrow={entity.entity_type}
        title={entity.name}
        subtitle={`Run by ${ec.mda.name} · Located in ${ec.lga.name} LGA (${ec.lga.zone})`}
      />

      <section className="card card-pad flex flex-wrap items-center gap-6">
        <ScoreRing score={ec.score} size={116} />
        <div>
          <div className="text-sm font-semibold text-zinc-900">Entity composite score</div>
          <div className="mt-1">
            <DeltaTag value={delta(ec)} suffix="pts vs previous period" />
          </div>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
            Weighted average of this entity&apos;s latest score on {readings.length} indicator
            {readings.length === 1 ? "" : "s"}, each measured against its{" "}
            {readings[0]?.ic.indicator.target_source ?? "official"} target.
          </p>
        </div>
      </section>

      <SectionTitle hint="Sorted worst-first">Latest indicator readings</SectionTitle>
      {readings.length === 0 ? (
        <EmptyState>No entity-level results recorded yet.</EmptyState>
      ) : (
        <CardList>
          {readings.map(({ ic, reading, score }) => (
            <RowLink
              key={ic.indicator.id}
              href={`/indicators/${ic.indicator.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium text-zinc-900">{ic.indicator.name}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {reading.periodLabel} · Here{" "}
                    <strong className="text-zinc-700">{fmtValue(reading.value, ic.indicator.unit)}</strong> · State{" "}
                    {fmtValue(ic.latest?.abia ?? null, ic.indicator.unit)} · Target{" "}
                    {fmtValue(ic.indicator.target_value, ic.indicator.unit)}
                  </div>
                </>
              }
              right={<ScoreBadge score={score} />}
            />
          ))}
        </CardList>
      )}
    </>
  );
}

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeltaTag, ScoreBadge, ScoreRing } from "@/components/score";
import { CardList, Crumbs, EmptyState, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { computeDashboard, delta, fmtValue } from "@/lib/scoring";

export default async function MdaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadDashboardData();
  const mda = data.mdas.find((m) => m.id === id);
  if (!mda) notFound();

  const c = computeDashboard(data);
  const sector = data.sectors.find((s) => s.id === mda.sector_id)!;
  const mdaComputed = c.mdaScores.find((m) => m.mda.id === mda.id);
  const entities = c.entityScores.filter((e) => e.mda.id === mda.id);
  const sectorIndicators = c.indicators.filter((i) => i.sector.id === sector.id);

  return (
    <>
      <Crumbs
        items={[
          { href: "/mdas", label: "MDAs" },
          { href: `/sectors/${sector.slug}`, label: sector.name },
          { label: mda.abbreviation },
        ]}
      />
      <PageHeader eyebrow={`${sector.name} sector`} title={mda.name} subtitle={mda.description} />

      <section className="card card-pad flex flex-wrap items-center gap-6">
        <ScoreRing score={mdaComputed?.score ?? null} size={116} />
        <div>
          <div className="text-sm font-semibold text-zinc-900">MDA composite score</div>
          <div className="mt-1">
            <DeltaTag value={mdaComputed ? delta(mdaComputed) : null} suffix="pts vs previous period" />
          </div>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
            Average of the latest composite scores of {entities.length} measured entit
            {entities.length === 1 ? "y" : "ies"} run by {mda.abbreviation}.
          </p>
        </div>
      </section>

      <SectionTitle>Entities under {mda.abbreviation}</SectionTitle>
      {entities.length === 0 ? (
        <EmptyState>No measured entities recorded for this MDA yet.</EmptyState>
      ) : (
        <CardList>
          {entities.map((e) => (
            <RowLink
              key={e.entity.id}
              href={`/entities/${e.entity.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium text-zinc-900">{e.entity.name}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {e.entity.entity_type} · {e.lga.name} LGA · {e.readings} readings
                  </div>
                </>
              }
              right={<ScoreBadge score={e.score} />}
            />
          ))}
        </CardList>
      )}

      <SectionTitle hint="State-level results in this sector">Sector indicators</SectionTitle>
      <CardList>
        {sectorIndicators.map((i) => (
          <RowLink
            key={i.indicator.id}
            href={`/indicators/${i.indicator.id}`}
            left={
              <>
                <div className="truncate text-sm font-medium text-zinc-900">{i.indicator.name}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">
                  {i.thematicArea.name} · Abia{" "}
                  <strong className="text-zinc-700">{fmtValue(i.latest?.abia ?? null, i.indicator.unit)}</strong>{" "}
                  vs target {fmtValue(i.latest?.target ?? null, i.indicator.unit)}
                </div>
              </>
            }
            right={<ScoreBadge score={i.score} />}
          />
        ))}
      </CardList>

      <p className="mt-4 text-xs text-zinc-400">
        Looking for the full sector picture?{" "}
        <Link
          href={`/sectors/${sector.slug}`}
          className="inline-flex items-center gap-1 font-medium text-abia-dark hover:underline"
        >
          View the {sector.name} sector
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      </p>
    </>
  );
}

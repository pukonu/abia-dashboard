import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { ScoreRadarChart } from "@/components/charts";
import CustomDashboards from "@/components/dashboard/CustomDashboards";
import { DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import { ActionLink, CardList, Crumbs, EmptyState, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { sectorNigeriaScore } from "@/lib/benchmark-comparisons";
import { computeDashboard, delta } from "@/lib/scoring";

export default async function LgaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadDashboardData();
  const lga = data.lgas.find((l) => l.id === id);
  if (!lga) notFound();

  const c = computeDashboard(data);
  const lgaComputed = c.lgaScores.find((l) => l.lga.id === lga.id);
  const rank = c.lgaScores.filter((l) => l.score != null).findIndex((l) => l.lga.id === lga.id);
  const entities = c.entityScores.filter((e) => e.lga.id === lga.id);

  // Per-sector composite within this LGA
  const sectorBreakdown = data.sectors
    .map((s) => {
      const items = entities.filter((e) => e.sector.id === s.id && e.score != null);
      const score = items.length
        ? items.reduce((sum, e) => sum + (e.score ?? 0), 0) / items.length
        : null;
      return { sector: s, score, count: items.length };
    })
    .filter((x) => x.count > 0);

  return (
    <>
      <Crumbs items={[{ href: "/lgas", label: "LGAs" }, { label: lga.name }]} />
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
            {lga.zone}
          </span>
        }
        title={lga.name}
        subtitle={`Population ≈ ${lga.population.toLocaleString()} · ${entities.length} measured entit${entities.length === 1 ? "y" : "ies"}`}
        actions={
          <ActionLink href={`/api/reports/lga/${lga.id}`} primary>
            LGA report (PDF)
          </ActionLink>
        }
      />

      <section className="card card-pad flex flex-wrap items-center gap-6">
        <ScoreRing score={lgaComputed?.score ?? null} size={116} />
        <div>
          <div className="text-sm font-semibold text-zinc-900">LGA composite score</div>
          <div className="mt-1">
            <DeltaTag
              value={lgaComputed ? delta(lgaComputed) : null}
              suffix="pts vs previous period"
            />
          </div>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
            {rank >= 0
              ? `Ranked ${rank + 1} of ${c.lgaScores.filter((l) => l.score != null).length} LGAs, `
              : ""}
            aggregated from {lgaComputed?.readings ?? 0} latest entity-level indicator readings.
          </p>
        </div>
      </section>

      {/* Custom dashboards built in the manage console */}
      <CustomDashboards c={c} scope="lga" targetId={lga.id} />

      {sectorBreakdown.length >= 3 && (
        <>
          <SectionTitle hint="Result, Nigeria and target">Distance to target by sector</SectionTitle>
          <div className="card card-pad">
            <ScoreRadarChart
              resultName="Result"
              points={sectorBreakdown.map(({ sector, score }) => ({
                axis: sector.name.replace(" & Trade", ""),
                result: score,
                nigeria: sectorNigeriaScore(c, sector.id),
              }))}
            />
          </div>
        </>
      )}

      {sectorBreakdown.length > 0 && (
        <>
          <SectionTitle>Performance by sector in {lga.name}</SectionTitle>
          <div className="card divide-y divide-zinc-100 overflow-hidden">
            {sectorBreakdown.map(({ sector, score, count }) => (
              <div key={sector.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sector.color }} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-800">{sector.name}</div>
                    <div className="text-xs text-zinc-500">{count} entit{count === 1 ? "y" : "ies"}</div>
                  </div>
                </div>
                <div className="w-36 sm:w-48">
                  <ScoreBar score={score} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Measured entities</SectionTitle>
      {entities.length === 0 ? (
        <EmptyState>
          No measured entities in {lga.name} yet. Add entities under an MDA (with this LGA) and record
          results to build this LGA&apos;s composite score.
        </EmptyState>
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
                    {e.entity.entity_type} · {e.mda.abbreviation} · {e.readings} readings
                  </div>
                </>
              }
              right={<ScoreBadge score={e.score} />}
            />
          ))}
        </CardList>
      )}
    </>
  );
}

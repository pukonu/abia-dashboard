import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { ScoreRadarChart } from "@/components/charts";
import CustomDashboards from "@/components/dashboard/CustomDashboards";
import LgaMap from "@/components/LgaMap";
import { DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import { ActionLink, CardList, Crumbs, EmptyState, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { sectorNigeriaScore } from "@/lib/benchmark-comparisons";
import { coverageLabel } from "@/lib/indicator-collection";
import { sectorPairForLga } from "@/lib/lga-sector-context";
import { computeDashboard, delta, fmtValue } from "@/lib/scoring";

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

  // LGA returns and facility roll-ups measured in this LGA
  const lgaValues = c.lgaIndicators
    .filter((v) => v.lga.id === lga.id)
    .sort((a, b) => a.ic.sector.sort_order - b.ic.sector.sort_order || a.ic.indicator.name.localeCompare(b.ic.indicator.name));

  // Per-sector composite within this LGA
  const sectorBreakdown = data.sectors
    .map((s) => ({
      sector: s,
      score: sectorPairForLga(c, s, lga).score,
      count: lgaValues.filter((v) => v.ic.sector.id === s.id).length,
    }))
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
        subtitle={`Population ≈ ${lga.population.toLocaleString()} · ${lgaValues.length} indicator${lgaValues.length === 1 ? "" : "s"} measured · ${entities.length} facilit${entities.length === 1 ? "y" : "ies"}`}
        actions={
          <ActionLink href={`/api/reports/lga/${lga.id}`} primary>
            LGA report (PDF)
          </ActionLink>
        }
      />

      <section className="card card-pad flex flex-wrap items-center gap-6">
        <div className="w-32 shrink-0 sm:w-40">
          <LgaMap
            lgas={data.lgas}
            scores={Object.fromEntries(c.lgaScores.map((l) => [l.lga.id, l.score]))}
            selectedId={lga.id}
            compact
          />
        </div>
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
            weighted across {lgaComputed?.readings ?? 0} indicator{lgaComputed?.readings === 1 ? "" : "s"} measured here — LGA
            returns and facility records rolled up to {lga.name}.
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
          <SectionTitle hint="Open a sector filtered to this LGA">Performance by sector in {lga.name}</SectionTitle>
          <CardList>
            {sectorBreakdown.map(({ sector, score, count }) => (
              <RowLink
                key={sector.id}
                href={`/sectors/${sector.slug}?lga=${lga.id}`}
                left={
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sector.color }} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-800">{sector.name}</div>
                      <div className="text-xs text-zinc-500">
                        {count} indicator{count === 1 ? "" : "s"} measured in {lga.name}
                      </div>
                    </div>
                  </div>
                }
                right={
                  <div className="w-36 sm:w-48">
                    <ScoreBar score={score} />
                  </div>
                }
              />
            ))}
          </CardList>
        </>
      )}

      <SectionTitle hint="LGA returns and facility roll-ups, latest period">Indicators measured in {lga.name}</SectionTitle>
      {lgaValues.length === 0 ? (
        <EmptyState>
          No LGA-level data for {lga.name} yet. Indicators collected per LGA or per facility appear here once their
          returns are recorded.
        </EmptyState>
      ) : (
        <CardList>
          {lgaValues.map((v) => (
            <RowLink
              key={v.ic.indicator.id}
              href={`/indicators/${v.ic.indicator.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium text-zinc-900">{v.ic.indicator.name}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {v.ic.sector.name} · {fmtValue(v.value, v.ic.indicator.unit)} · {v.period.label} ·{" "}
                    {v.source === "lga" ? "LGA return" : `from ${coverageLabel("facility", v.coverage)}`}
                  </div>
                </>
              }
              right={<ScoreBadge score={v.score} />}
            />
          ))}
        </CardList>
      )}

      <SectionTitle>Measured facilities</SectionTitle>
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

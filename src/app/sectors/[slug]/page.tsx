import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreRadarChart, TrendChart } from "@/components/charts";
import { IndicatorResultLine } from "@/components/indicator-result-line";
import { DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import { ActionLink, CardList, Crumbs, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { domainNigeriaScore } from "@/lib/benchmark-comparisons";
import { computeDashboard, delta } from "@/lib/scoring";

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default async function SectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thematic?: string }>;
}) {
  const { slug } = await params;
  const { thematic: thematicParam } = await searchParams;
  const data = await loadDashboardData();
  const sector = data.sectors.find((s) => s.slug === slug);
  if (!sector) notFound();

  const c = computeDashboard(data);
  const pair = c.sectorScores.get(sector.id) ?? { score: null, prevScore: null };
  const thematics = data.thematicAreas
    .filter((t) => t.sector_id === sector.id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  const domainsByThematic = new Map(
    thematics.map((ta) => [ta.id, data.domains.filter((d) => d.thematic_area_id === ta.id)])
  );
  const thematicGroups = [
    {
      id: "state",
      title: "Statewide Thematic Areas",
      hint: "State-level indicators and policy outcomes",
      items: thematics.filter((ta) =>
        (domainsByThematic.get(ta.id) ?? []).every((dom) =>
          data.indicators
            .filter((indicator) => indicator.domain_id === dom.id)
            .every((indicator) => indicator.indicator_scope !== "entity")
        )
      ),
    },
    {
      id: "entity",
      title: "Entity-Specific Frameworks",
      hint: "Facility and service-delivery indicators that roll up from entities",
      items: thematics.filter((ta) =>
        (domainsByThematic.get(ta.id) ?? []).some((dom) =>
          data.indicators.some(
            (indicator) => indicator.domain_id === dom.id && indicator.indicator_scope === "entity"
          )
        )
      ),
    },
  ].filter((group) => group.items.length > 0);
  const mdas = c.mdaScores.filter((m) => m.sector.id === sector.id);
  const trendPoints = c.trend.map((t) => ({
    label: t.label,
    [sector.name]: t.sectors[sector.slug],
    State: t.state,
  }));
  const thematicCards = thematicGroups.flatMap((group) =>
    group.items.map((ta) => {
      const domains = domainsByThematic.get(ta.id) ?? [];
      return {
        group,
        thematicArea: ta,
        domains,
        score: c.thematicScores.get(ta.id)?.score ?? null,
        indicatorCount: domains.reduce(
          (sum, domain) =>
            sum +
            c.indicators.filter((i) => i.domain.id === domain.id && i.indicator.indicator_scope !== "entity").length,
          0
        ),
      };
    })
  );
  const selectedThematic =
    thematicCards.find(({ thematicArea }) => thematicArea.id === thematicParam) ?? null;

  return (
    <>
      <Crumbs items={[{ href: "/sectors", label: "Sectors" }, { label: sector.name }]} />
      <PageHeader
        eyebrow="Sector"
        title={sector.name}
        subtitle={sector.description}
        actions={
          <ActionLink href={`/api/reports/sector/${sector.slug}`} primary>
            Sector report (PDF)
          </ActionLink>
        }
      />

      {selectedThematic && (
        <>
          <section className="card card-pad flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5">
              <ScoreRing score={pair.score} size={116} />
              <div>
                <div className="text-sm font-semibold text-zinc-900">Sector composite</div>
                <div className="mt-1">
                  <DeltaTag value={delta(pair)} suffix="pts vs previous period" />
                </div>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
                  Weighted roll-up of {thematics.length} thematic areas and{" "}
                  {c.indicators.filter((i) => i.sector.id === sector.id && i.indicator.indicator_scope !== "entity").length} indicators.
                </p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <TrendChart
                points={trendPoints}
                series={[
                  { key: sector.name, name: sector.name, color: sector.color },
                  { key: "State", name: "State composite", color: "#a1a1aa" },
                ]}
                height={180}
              />
            </div>
          </section>

          {/* Distance to target across domains */}
          <SectionTitle hint="Result, Nigeria and target">Distance to target by domain</SectionTitle>
          <div className="card card-pad">
            <ScoreRadarChart
              resultName="Result"
              color={sector.color}
              points={data.domains
                .filter((d) => d.thematic_area_id === selectedThematic.thematicArea.id)
                .map((d) => ({
                  axis: d.name,
                  result: c.domainScores.get(d.id)?.score ?? null,
                  nigeria: domainNigeriaScore(c, d),
                }))}
            />
          </div>

          {/* MDAs */}
          <SectionTitle hint="Scored from their measured entities">Ministries, Departments & Agencies</SectionTitle>
          <CardList>
            {mdas.map((m) => (
              <RowLink
                key={m.mda.id}
                href={`/mdas/${m.mda.id}`}
                left={
                  <>
                    <div className="truncate text-sm font-medium text-zinc-900">
                      {m.mda.name} <span className="text-zinc-400">({m.mda.abbreviation})</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {m.entityCount} measured entit{m.entityCount === 1 ? "y" : "ies"}
                    </div>
                  </>
                }
                right={<ScoreBadge score={m.score} />}
              />
            ))}
          </CardList>
        </>
      )}

      {/* Thematic areas → domains → indicators */}
      {!selectedThematic ? (
        thematicGroups.map((group) => (
          <section key={group.id}>
            <SectionTitle hint={group.hint}>{group.title}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((ta) => {
                const domains = domainsByThematic.get(ta.id) ?? [];
                const score = c.thematicScores.get(ta.id)?.score ?? null;
                const indicatorCount = domains.reduce(
                  (sum, domain) =>
                    sum +
                    c.indicators.filter(
                      (i) => i.domain.id === domain.id && i.indicator.indicator_scope !== "entity"
                    ).length,
                  0
                );
                return (
                  <Link
                    key={ta.id}
                    href={`/sectors/${sector.slug}?thematic=${ta.id}`}
                    className="card card-pad group transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                          {group.title.replace(" Thematic Areas", "").replace(" Frameworks", "")}
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-zinc-900 group-hover:text-abia-dark">
                          {ta.name}
                        </h3>
                      </div>
                      <ScoreBadge score={score} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{ta.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                      <span>
                        {domains.length} domain{domains.length === 1 ? "" : "s"}
                      </span>
                      <span>
                        {indicatorCount} indicator{indicatorCount === 1 ? "" : "s"}
                      </span>
                      <span>{ta.frequency}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <section>
          <SectionTitle
            hint={`${selectedThematic.group.title} · ${FREQ_LABEL[selectedThematic.thematicArea.frequency]} reporting`}
          >
            {selectedThematic.thematicArea.name}
          </SectionTitle>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-sm text-zinc-500">{selectedThematic.thematicArea.description}</p>
            <div className="flex items-center gap-3">
              <ScoreBadge score={selectedThematic.score} showLabel />
              <Link
                href={`/sectors/${sector.slug}`}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Back to thematic areas
              </Link>
            </div>
          </div>
          <div className="card overflow-hidden">
            {selectedThematic.domains.map((dom) => {
              const domPair = c.domainScores.get(dom.id) ?? { score: null, prevScore: null };
              const domIndicators = c.indicators.filter(
                (i) => i.domain.id === dom.id && i.indicator.indicator_scope !== "entity"
              );
              return (
                <div key={dom.id} className="border-b border-zinc-100 last:border-b-0">
                  <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3 sm:px-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {dom.name}
                    </h3>
                    <div className="w-28">
                      <ScoreBar score={domPair.score} />
                    </div>
                  </div>
                  {domIndicators.map((i) => (
                    <Link
                      key={i.indicator.id}
                      href={`/indicators/${i.indicator.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-zinc-800">{i.indicator.name}</div>
                        <IndicatorResultLine
                          result={i.latest?.abia ?? null}
                          nigeria={i.latest?.nigeria ?? i.domain.benchmark_nigeria ?? null}
                          target={i.domain.benchmark_target ?? i.latest?.target ?? i.indicator.target_value}
                          unit={i.indicator.unit}
                          targetSource={i.indicator.target_source}
                        />
                      </div>
                      <ScoreBadge score={i.score} />
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

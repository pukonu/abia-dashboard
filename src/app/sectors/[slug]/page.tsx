import Link from "next/link";
import { notFound } from "next/navigation";
import { DonutChart, FullPieChart, ScoreRadarChart, TrendChart } from "@/components/charts";
import CustomDashboards from "@/components/dashboard/CustomDashboards";
import { IndicatorResultLine } from "@/components/indicator-result-line";
import { DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import SectorIcon from "@/components/SectorIcon";
import { ActionLink, CardList, Crumbs, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { adminLandingInsights } from "@/lib/admin-insights";
import { loadDashboardData } from "@/lib/datasource";
import { economyLandingInsights } from "@/lib/economy-insights";
import { educationLandingInsights } from "@/lib/education-insights";
import { entityFactStats, entityMix, sectorExecutiveStats } from "@/lib/executive-insights";
import { healthLandingInsights } from "@/lib/health-insights";
import { infrastructureLandingInsights } from "@/lib/infrastructure-insights";
import { domainNigeriaScore } from "@/lib/benchmark-comparisons";
import { sectorEntitiesForLga, sectorMdasForLga, sectorMixForLga, sectorPairForLga } from "@/lib/lga-sector-context";
import { powerLandingInsights } from "@/lib/power-insights";
import { computeDashboard, delta } from "@/lib/scoring";
import { securityLandingInsights } from "@/lib/security-insights";

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

function readinessBarColor(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  const stops =
    clamped < 50
      ? { from: [220, 38, 38], to: [245, 158, 11], t: clamped / 50 }
      : { from: [245, 158, 11], to: [22, 163, 74], t: (clamped - 50) / 50 };
  const channel = (index: number) => Math.round(stops.from[index] + (stops.to[index] - stops.from[index]) * stops.t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export default async function SectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thematic?: string; lga?: string }>;
}) {
  const { slug } = await params;
  const { thematic: thematicParam, lga: lgaParam } = await searchParams;
  const data = await loadDashboardData();
  const sector = data.sectors.find((s) => s.slug === slug);
  if (!sector) notFound();

  const c = computeDashboard(data);
  const lgaContext = lgaParam ? (data.lgas.find((candidate) => candidate.id === lgaParam) ?? null) : null;
  const lgaSectorEntities = lgaContext ? sectorEntitiesForLga(c, sector, lgaContext) : null;
  const pair = lgaContext
    ? sectorPairForLga(c, sector, lgaContext)
    : (c.sectorScores.get(sector.id) ?? { score: null, prevScore: null });
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
  const mdas = lgaSectorEntities
    ? sectorMdasForLga(data, lgaSectorEntities)
    : c.mdaScores.filter((m) => m.sector.id === sector.id);
  const mix = lgaSectorEntities ? sectorMixForLga(lgaSectorEntities) : entityMix(data, sector.id);
  const executiveStats = sectorExecutiveStats(data, c, sector);
  const entityFacts = entityFactStats(mix);
  const manualSectorFacts = data.sectorFacts
    .filter((fact) => fact.sector_id === sector.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  const adminInsights = sector.slug === "administration" ? adminLandingInsights(data) : null;
  const healthInsights = sector.slug === "health" ? healthLandingInsights(data) : null;
  const educationInsights = sector.slug === "education" ? educationLandingInsights(data) : null;
  const securityInsights = sector.slug === "security" ? securityLandingInsights(data) : null;
  const infrastructureInsights = sector.slug === "infrastructure" ? infrastructureLandingInsights(data) : null;
  const powerInsights = sector.slug === "power" ? powerLandingInsights(data) : null;
  const economyInsights = sector.slug === "economy" ? economyLandingInsights(data) : null;
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
  const lgaQuery = lgaContext ? `&lga=${lgaContext.id}` : "";
  const sectorScopeLabel = lgaContext ? `${sector.name} in ${lgaContext.name}` : sector.name;
  const sectorEntityCount = lgaSectorEntities?.length ?? null;
  const sectorReadingCount =
    lgaSectorEntities?.reduce((sum, item) => sum + item.readings, 0) ??
    c.indicators.filter((i) => i.sector.id === sector.id && i.indicator.indicator_scope !== "entity").length;

  return (
    <>
      <Crumbs
        items={[
          { href: "/sectors", label: "Sectors" },
          ...(lgaContext ? [{ href: `/lgas/${lgaContext.id}`, label: lgaContext.name }] : []),
          { label: sector.name },
        ]}
      />
      <PageHeader
        eyebrow={lgaContext ? `Sector · ${lgaContext.name} LGA` : "Sector"}
        title={
          <span className="inline-flex items-center gap-3">
            <SectorIcon slug={sector.slug} name={sector.name} className="h-12 w-12" />
            <span>{sectorScopeLabel}</span>
          </span>
        }
        subtitle={
          lgaContext
            ? `${sector.description} This view is filtered to measured entities and roll-ups inside ${lgaContext.name}.`
            : sector.description
        }
        actions={
          lgaContext ? (
            <Link
              href={`/sectors/${sector.slug}`}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Clear LGA filter
            </Link>
          ) : (
            <ActionLink href={`/api/reports/sector/${sector.slug}`} primary>
              Sector report (PDF)
            </ActionLink>
          )
        }
      />

      {lgaContext ? (
        <section className="card card-pad flex flex-col gap-5 border-l-4 sm:flex-row sm:items-center" style={{ borderLeftColor: sector.color }}>
          <ScoreRing score={pair.score} size={108} />
          <div>
            <div className="text-sm font-semibold text-zinc-900">LGA sector composite</div>
            <div className="mt-1">
              <DeltaTag value={delta(pair)} suffix="pts vs previous period" />
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500">
              You are viewing {sector.name} through {lgaContext.name}. This score, plus MDAs, key facts and service mix
              are calculated from {sectorEntityCount ?? 0} measured entit{sectorEntityCount === 1 ? "y" : "ies"} and{" "}
              {sectorReadingCount} latest entity-level readings in this LGA. Statewide policy indicators remain visible
              below where no LGA-level entity result exists.
            </p>
          </div>
        </section>
      ) : (
        <>
          <SectionTitle hint="Fast briefing points">Executive facts</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {executiveStats.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {!selectedThematic && !lgaContext && manualSectorFacts.length > 0 && (
        <section>
          <SectionTitle hint="Manually entered values from the management console">Executive sector facts</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {manualSectorFacts.map((fact) => (
              <div key={fact.id} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{fact.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{fact.label}</div>
                {fact.caption && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{fact.caption}</p>}
                {fact.source && (
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Source: {fact.source}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedThematic && (
        <>
          <section className="card card-pad flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5">
              <ScoreRing score={pair.score} size={116} />
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  {lgaContext ? "LGA sector composite" : "Sector composite"}
                </div>
                <div className="mt-1">
                  <DeltaTag value={delta(pair)} suffix="pts vs previous period" />
                </div>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
                  {lgaContext
                    ? `Weighted roll-up of ${sectorReadingCount} latest entity-level readings in ${lgaContext.name}.`
                    : `Weighted roll-up of ${thematics.length} thematic areas and ${sectorReadingCount} indicators.`}
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

      {/* Custom dashboards built in the manage console */}
      {!selectedThematic && <CustomDashboards c={c} scope="sector" targetId={sector.id} />}

      {!selectedThematic && !lgaContext && adminInsights && (
        <section>
          <SectionTitle hint="Executive delivery, service quality and accountability">Administration command centre</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {adminInsights.stats.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Delivery pipeline</h3>
              <p className="mt-1 text-xs text-zinc-500">
                The administrative levers that show whether government is moving.
              </p>
              <div className="mt-4 space-y-3">
                {adminInsights.pipeline.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-700">{item.label}</span>
                      <span className="font-semibold text-zinc-900">{item.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-slate-700" style={{ width: `${item.progress}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">{item.caption}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
                <h3 className="display text-base font-semibold text-zinc-900">Administrative urgent matters</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Items that should be visible before they become implementation failures.
                </p>
              </div>
              <div className="divide-y divide-zinc-100">
                {adminInsights.urgentMatters.map((item) => (
                  <div key={item.title} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">{item.title}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">{item.owner}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        Admin
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600">{item.issue}</p>
                    <p className="mt-1 text-[11px] font-medium text-zinc-700">Action: {item.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!selectedThematic && !lgaContext && healthInsights && (
        <section>
          <SectionTitle hint="Facility coverage, readiness and service risks">Health service snapshot</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {healthInsights.stats.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">PHC readiness components</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Inputs the Governor can scan quickly before drilling into facility-level data.
              </p>
              <div className="mt-4 space-y-3">
                {healthInsights.facilityReadiness.map((item) => {
                  const color = readinessBarColor(item.value);
                  return (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-zinc-700">{item.label}</span>
                        <span className="font-semibold text-zinc-900">{item.value}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.value}%`,
                            background: `linear-gradient(90deg, ${readinessBarColor(Math.max(0, item.value - 18))}, ${color})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
                <h3 className="display text-base font-semibold text-zinc-900">Service delivery signals</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Maternal care, immunisation, staffing and medicines at a glance.
                </p>
              </div>
              <div className="divide-y divide-zinc-100">
                {healthInsights.serviceSignals.map((signal) => (
                  <div key={signal.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{signal.label}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{signal.trend}</div>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        signal.tone === "good"
                          ? "bg-green-50 text-green-800"
                          : signal.tone === "critical"
                            ? "bg-red-50 text-red-800"
                            : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {signal.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
              <h3 className="display text-base font-semibold text-zinc-900">Urgent health matters</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Facility issues that should surface quickly for executive action.
              </p>
            </div>
            <div className="divide-y divide-zinc-100">
              {healthInsights.urgentMatters.map((matter) => (
                <div key={matter.facility} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{matter.facility}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{matter.lga} · {matter.issue}</div>
                    <div className="mt-1 text-[11px] font-medium text-zinc-600">Action: {matter.action}</div>
                  </div>
                  <div
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      matter.severity === "Critical" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {matter.severity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!selectedThematic && !lgaContext && educationInsights && (
        <section>
          <SectionTitle hint="School access, enrolment and gender balance">Education snapshot</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {educationInsights.stats.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Primary enrolment by gender</h3>
              <p className="mt-1 text-xs text-zinc-500">Girls and boys as a share of primary school enrolment.</p>
              <FullPieChart points={educationInsights.gender.primary} />
            </div>
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Secondary enrolment by gender</h3>
              <p className="mt-1 text-xs text-zinc-500">Girls and boys as a share of secondary school enrolment.</p>
              <FullPieChart points={educationInsights.gender.secondary} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Smart school implementation</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Track rollout, teacher readiness and learner reach as the smart-school programme expands.
              </p>
              <div className="mt-4 space-y-3">
                {educationInsights.smartSchools.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-700">{item.label}</span>
                      <span className="font-semibold text-zinc-900">{item.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${item.progress}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">{item.caption}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
                <h3 className="display text-base font-semibold text-zinc-900">Urgent school infrastructure matters</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Dilapidated or high-risk school infrastructure that needs fast executive attention.
                </p>
              </div>
              <div className="divide-y divide-zinc-100">
                {educationInsights.urgentMatters.map((matter) => (
                  <div key={matter.school} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{matter.school}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{matter.lga} · {matter.issue}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          matter.severity === "Critical" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {matter.severity}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-zinc-600">{matter.estimatedCost}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card card-pad mt-4">
            <div className="mb-3">
              <h3 className="display text-base font-semibold text-zinc-900">Peer-state education map layer</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
                A map-ready comparison of Abia and neighbouring states. These values can later be plotted by state
                boundary, with enrolment and completion rate as selectable layers.
              </p>
            </div>
            <div className="space-y-3">
              {educationInsights.peerStates.map((state) => {
                const maxPrimary = Math.max(...educationInsights.peerStates.map((item) => item.primaryEnrollment));
                const width = `${Math.round((state.primaryEnrollment / maxPrimary) * 100)}%`;
                return (
                  <div key={state.state}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-zinc-800">{state.state}</span>
                      <span className="text-zinc-500">
                        {state.primaryEnrollment.toLocaleString()} primary · {state.secondaryEnrollment.toLocaleString()} secondary · {state.completionRate}% completion
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-abia" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {!selectedThematic && !lgaContext && securityInsights && (
        <section>
          <SectionTitle hint="Coverage, incidents and response capacity">Security snapshot</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {securityInsights.infrastructure.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
            <div className="card overflow-hidden">
              <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
                <h3 className="display text-base font-semibold text-zinc-900">Public safety indicators</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Priority measures citizens can understand at a glance.
                </p>
              </div>
              <div className="divide-y divide-zinc-100">
                {securityInsights.incidents.map((incident) => (
                  <div key={incident.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{incident.label}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{incident.trend}</div>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        incident.tone === "good"
                          ? "bg-green-50 text-green-800"
                          : incident.tone === "critical"
                            ? "bg-red-50 text-red-800"
                            : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {incident.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Citizen-facing summary</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                A collective view citizens can read without interpreting the whole indicator framework.
              </p>
              <ul className="mt-4 space-y-3">
                {securityInsights.publicSummary.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-abia" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {!selectedThematic && !lgaContext && infrastructureInsights && (
        <section>
          <SectionTitle hint="Road delivery, monthly progress and LGA spread">Road infrastructure tracker</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {infrastructureInsights.stats.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Project status</h3>
              <p className="mt-1 text-xs text-zinc-500">Completed, active and planned roads in the current works pipeline.</p>
              <div className="mt-4 space-y-3">
                {infrastructureInsights.statusSummary.map((item) => {
                  const max = Math.max(...infrastructureInsights.statusSummary.map((s) => s.value), 1);
                  return (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-700">{item.label}</span>
                        <span className="font-semibold text-zinc-900">{item.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round((item.value / max) * 100)}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Monthly road milestones</h3>
              <p className="mt-1 text-xs text-zinc-500">Road starts and completions, so “completed this month” can become a live indicator.</p>
              <div className="mt-4 grid grid-cols-8 gap-2">
                {infrastructureInsights.monthlyMilestones.map((month) => {
                  const height = Math.max(12, (month.started + month.completed) * 22);
                  return (
                    <div key={month.month} className="flex flex-col items-center justify-end gap-1">
                      <div className="flex h-20 items-end">
                        <div className="w-5 rounded-t bg-orange-500" style={{ height }} />
                      </div>
                      <div className="text-[10px] font-medium text-zinc-500">{month.month}</div>
                      <div className="text-[10px] text-zinc-400">{month.completed} done</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card mt-4 overflow-hidden">
            <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
              <h3 className="display text-base font-semibold text-zinc-900">Road project register</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Each row can become a live project record with monthly status updates, kilometres and LGA location.
              </p>
            </div>
            <div className="divide-y divide-zinc-100">
              {infrastructureInsights.projects.map((project) => (
                <div key={project.name} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_120px_120px_100px] sm:items-center sm:px-5">
                  <div>
                    <div className="font-medium text-zinc-900">{project.name}</div>
                    <div className="text-xs text-zinc-500">{project.lga}</div>
                  </div>
                  <div className="text-xs text-zinc-500">{project.startMonth}</div>
                  <div className="text-xs text-zinc-500">{project.completionMonth ?? "Not completed"}</div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-xs font-semibold text-zinc-800">{project.kilometers.toLocaleString()} km</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        project.status === "Completed"
                          ? "bg-green-50 text-green-800"
                          : project.status === "Planned"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-orange-50 text-orange-800"
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!selectedThematic && !lgaContext && powerInsights && (
        <section>
          <SectionTitle hint="Generation, gas constraints, outages and feeder reliability">Power snapshot</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {powerInsights.stats.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Geometric daily output</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Daily MW output captured from Geometric Power, Osisioma, for operational monitoring.
              </p>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {powerInsights.dailyOutput.map((point) => (
                  <div key={point.day} className="flex flex-col items-center justify-end gap-1">
                    <div className="flex h-24 items-end">
                      <div
                        className="w-7 rounded-t bg-amber-500"
                        style={{ height: `${Math.max(16, Math.round((point.output / 141) * 96))}px` }}
                      />
                    </div>
                    <div className="text-[10px] font-medium text-zinc-500">{point.day}</div>
                    <div className="text-[10px] text-zinc-400">{point.output} MW</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
                <h3 className="display text-base font-semibold text-zinc-900">Incidents and constraints</h3>
                <p className="mt-1 text-xs text-zinc-500">Gas supply, grid cuts and outage events to track daily.</p>
              </div>
              <div className="divide-y divide-zinc-100">
                {powerInsights.incidents.map((incident) => (
                  <div key={incident.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{incident.label}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{incident.trend}</div>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        incident.tone === "good"
                          ? "bg-green-50 text-green-800"
                          : incident.tone === "critical"
                            ? "bg-red-50 text-red-800"
                            : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {incident.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!selectedThematic && !lgaContext && economyInsights && (
        <section>
          <SectionTitle hint="Revenue, markets, SMEs and investor pipeline">Economy & trade command centre</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {economyInsights.stats.map((stat) => (
              <div key={stat.label} className="card card-pad">
                <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="card card-pad">
              <h3 className="display text-base font-semibold text-zinc-900">Commercial pipeline</h3>
              <p className="mt-1 text-xs text-zinc-500">
                The quick read on collections, investment and SME growth.
              </p>
              <div className="mt-4 space-y-3">
                {economyInsights.pipeline.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-700">{item.label}</span>
                      <span className="font-semibold text-zinc-900">{item.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${item.progress}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">{item.caption}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
                <h3 className="display text-base font-semibold text-zinc-900">Trade and enterprise hubs</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Markets and clusters to speak to when selling Abia as a place to trade and invest.
                </p>
              </div>
              <div className="divide-y divide-zinc-100">
                {economyInsights.tradeHubs.map((hub) => (
                  <div key={hub.name} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{hub.name}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{hub.focus}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-zinc-900">{hub.jobs.toLocaleString()}</div>
                      <div className="text-[11px] text-zinc-500">{hub.activity} activity</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!selectedThematic && mix.length > 0 && (
        <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(340px,1fr)]">
          <div>
            <SectionTitle hint={lgaContext ? `Measured facilities and service points in ${lgaContext.name}` : "Measured facilities and service points"}>
              Key facts
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {entityFacts.map((fact) => (
                <div key={fact.label} className="card card-pad">
                  <div className="text-2xl font-semibold text-zinc-950">{fact.value}</div>
                  <div className="mt-1 text-sm font-medium text-zinc-800">{fact.label}</div>
                  <p className="mt-1 text-xs text-zinc-500">{fact.caption}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle hint="Composition of measured entities">Service mix</SectionTitle>
            <div className="card card-pad">
              <DonutChart points={mix} />
            </div>
          </div>
        </div>
      )}

      {!selectedThematic && lgaContext && (
        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          <section>
            <SectionTitle hint={`Scored from entities in ${lgaContext.name}`}>MDAs in this LGA context</SectionTitle>
            {mdas.length === 0 ? (
              <div className="card card-pad text-sm text-zinc-500">No scored MDAs for this sector in {lgaContext.name} yet.</div>
            ) : (
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
                          {m.entityCount} measured entit{m.entityCount === 1 ? "y" : "ies"} in {lgaContext.name}
                        </div>
                      </>
                    }
                    right={<ScoreBadge score={m.score} />}
                  />
                ))}
              </CardList>
            )}
          </section>
          <section>
            <SectionTitle hint={`Only ${sector.name} entities in ${lgaContext.name}`}>Measured entities</SectionTitle>
            {!lgaSectorEntities || lgaSectorEntities.length === 0 ? (
              <div className="card card-pad text-sm text-zinc-500">No measured entities for this sector in {lgaContext.name} yet.</div>
            ) : (
              <CardList>
                {lgaSectorEntities.map((item) => (
                  <RowLink
                    key={item.entity.id}
                    href={`/entities/${item.entity.id}`}
                    left={
                      <>
                        <div className="truncate text-sm font-medium text-zinc-900">{item.entity.name}</div>
                        <div className="mt-0.5 truncate text-xs text-zinc-500">
                          {item.entity.entity_type} · {item.mda.abbreviation} · {item.readings} readings
                        </div>
                      </>
                    }
                    right={<ScoreBadge score={item.score} />}
                  />
                ))}
              </CardList>
            )}
          </section>
        </div>
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
                    href={`/sectors/${sector.slug}?thematic=${ta.id}${lgaQuery}`}
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
                href={lgaContext ? `/sectors/${sector.slug}?lga=${lgaContext.id}` : `/sectors/${sector.slug}`}
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

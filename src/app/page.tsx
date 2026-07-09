import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DonutChart, ScoreRadarChart, TrendChart } from "@/components/charts";
import { IndicatorResultLine } from "@/components/indicator-result-line";
import { DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import SectorIcon from "@/components/SectorIcon";
import { ActionLink, CardList, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { abiaFootprintStats, sectorIndicatorMix, stateExecutiveStats } from "@/lib/executive-insights";
import { sectorNigeriaScore } from "@/lib/benchmark-comparisons";
import { computeDashboard, delta, ratingFor } from "@/lib/scoring";

export default async function OverviewPage() {
  const data = await loadDashboardData();
  const c = computeDashboard(data);

  const sectorCards = data.sectors.map((s) => ({
    sector: s,
    pair: c.sectorScores.get(s.id) ?? { score: null, prevScore: null },
  }));
  const executiveStats = stateExecutiveStats(data, c);
  const footprintStats = abiaFootprintStats(data);
  const indicatorCoverageMix = sectorIndicatorMix(data);

  const trendPoints = c.trend.map((t) => ({ label: t.label, State: t.state }));

  const rankedLgas = c.lgaScores.filter((l) => l.score != null);
  const topLgas = rankedLgas.slice(0, 3);
  const bottomLgas = rankedLgas.slice(-3).reverse();

  const attention = [...c.indicators]
    .filter((i) => i.indicator.indicator_scope !== "entity")
    .filter((i) => i.score != null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 5);

  const asOf = c.indicators
    .map((i) => i.latest?.period.start_date ?? "")
    .reduce((a, b) => (b > a ? b : a), "");

  return (
    <>
      <PageHeader
        eyebrow="Executive overview"
        title="The State of Abia"
        subtitle="One composite view of how the state is performing across every sector, benchmarked against national figures and official targets."
        actions={
          <>
            <ActionLink href="/subscribe" icon="mail">
              Weekly digest
            </ActionLink>
            <ActionLink href="/api/reports/state" primary>
              Download state report (PDF)
            </ActionLink>
          </>
        }
      />

      {/* Headline */}
      <section className="card card-pad flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <ScoreRing score={c.stateScore.score} size={128} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Abia State Performance Index
            </div>
            <div className="mt-1 text-lg font-semibold text-zinc-900">
              {ratingFor(c.stateScore.score).label} overall
            </div>
            <div className="mt-1">
              <DeltaTag value={delta(c.stateScore)} suffix="pts vs previous period" />
            </div>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
              Composite of {c.indicators.length} indicators across {data.sectors.length} sectors,
              scored against WHO, SDG and State Plan targets. Data through{" "}
              {asOf ? new Date(asOf + "T00:00:00Z").toLocaleDateString("en-NG", { month: "long", year: "numeric" }) : "—"}.
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <TrendChart
            points={trendPoints}
            series={[{ key: "State", name: "State composite", color: "#14683c" }]}
            height={170}
          />
        </div>
      </section>

      <SectionTitle hint="Concrete Abia assets and data coverage">Executive data footprint</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...footprintStats, ...executiveStats.slice(0, 2)].map((stat) => (
            <div key={stat.label} className="card card-pad">
              <div className="text-2xl font-semibold text-zinc-950">{stat.value}</div>
              <div className="mt-1 text-sm font-medium text-zinc-800">{stat.label}</div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{stat.caption}</p>
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <div className="mb-1 text-base font-semibold text-zinc-900">Indicator coverage by sector</div>
          <p className="mb-2 text-xs text-zinc-500">
            This is a true part-of-whole view: how the configured datapoints are distributed across sectors.
          </p>
          <DonutChart points={indicatorCoverageMix} />
        </div>
      </div>

      {/* Sector scorecards */}
      <SectionTitle hint="Tap a sector to drill down">Sectors at a glance</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {sectorCards.map(({ sector, pair }) => (
          <Link
            key={sector.id}
            href={`/sectors/${sector.slug}`}
            className="card card-pad group transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <SectorIcon slug={sector.slug} name={sector.name} />
              <ScoreBadge score={pair.score} />
            </div>
            <div className="mt-3 text-sm font-semibold text-zinc-900 group-hover:text-abia-dark">
              {sector.name}
            </div>
            <div className="mt-1">
              <DeltaTag value={delta(pair)} />
            </div>
            <div className="mt-3">
              <ScoreBar score={pair.score} />
            </div>
          </Link>
        ))}
      </div>

      {/* Sector comparison + LGA highlights */}
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h2 className="display mb-1 text-base font-semibold text-zinc-900">Distance to target</h2>
          <p className="mb-2 text-xs text-zinc-500">
            Result, Nigeria and target are shown together on the same 0-100 scale.
          </p>
          <ScoreRadarChart
            resultName="Result"
            points={sectorCards.map(({ sector, pair }) => ({
              axis: sector.name.replace(" & Trade", ""),
              result: pair.score,
              nigeria: sectorNigeriaScore(c, sector.id),
            }))}
          />
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="display text-base font-semibold text-zinc-900">LGA highlights</h2>
            <Link
              href="/lgas"
              className="inline-flex items-center gap-1 text-xs font-medium text-abia-dark hover:underline"
            >
              All 17 LGAs
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-green-700">Leading</div>
              <ul className="space-y-2">
                {topLgas.map((l, i) => (
                  <li key={l.lga.id}>
                    <Link href={`/lgas/${l.lga.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="truncate text-zinc-700">{i + 1}. {l.lga.name}</span>
                      <ScoreBadge score={l.score} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-red-700">Needs attention</div>
              <ul className="space-y-2">
                {bottomLgas.map((l) => (
                  <li key={l.lga.id}>
                    <Link href={`/lgas/${l.lga.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="truncate text-zinc-700">{l.lga.name}</span>
                      <ScoreBadge score={l.score} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-zinc-400">
            LGA composite scores aggregate the latest results of all measured entities
            (hospitals, schools, projects…) located in each Local Government Area.
          </p>
        </div>
      </div>

      {/* Indicators needing attention */}
      <SectionTitle hint="Lowest scores vs target">Requires the Governor&apos;s attention</SectionTitle>
      <CardList>
        {attention.map((i) => (
          <RowLink
            key={i.indicator.id}
            href={`/indicators/${i.indicator.id}`}
            left={
              <>
                <div className="truncate text-sm font-medium text-zinc-900">{i.indicator.name}</div>
                <IndicatorResultLine
                  result={i.latest?.abia ?? null}
                  nigeria={i.latest?.nigeria ?? i.domain.benchmark_nigeria ?? null}
                  target={i.domain.benchmark_target ?? i.latest?.target ?? i.indicator.target_value}
                  unit={i.indicator.unit}
                  targetSource={i.indicator.target_source}
                  prefix={
                    <>
                      {i.sector.name} · {i.domain.name} ·
                    </>
                  }
                />
              </>
            }
            right={<ScoreBadge score={i.score} showLabel />}
          />
        ))}
      </CardList>
    </>
  );
}

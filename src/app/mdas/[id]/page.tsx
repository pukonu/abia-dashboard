import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BenchmarkLine, DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import { CardList, Crumbs, EmptyState, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import type { IndicatorComputed } from "@/lib/scoring";
import { computeDashboard, delta } from "@/lib/scoring";

/** Sortable [domain, question] key parsed from names like "1.2 Does the …". */
function questionKey(name: string): [number, number] {
  const m = name.match(/^(\d+)\.(\d+)\s+/);
  return m ? [Number(m[1]), Number(m[2])] : [Number.MAX_SAFE_INTEGER, 0];
}

function splitCode(name: string): { code: string | null; text: string } {
  const m = name.match(/^(\d+\.\d+)\s+/);
  return m ? { code: m[1], text: name.slice(m[0].length) } : { code: null, text: name };
}

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

  // Thematic area → domain → indicators (ordered by question number)
  const thematicGroups = [
    ...sectorIndicators
      .reduce((acc, i) => {
        const t = acc.get(i.thematicArea.id) ?? new Map<string, IndicatorComputed[]>();
        const d = t.get(i.domain.id) ?? [];
        d.push(i);
        t.set(i.domain.id, d);
        acc.set(i.thematicArea.id, t);
        return acc;
      }, new Map<string, Map<string, IndicatorComputed[]>>())
      .values(),
  ]
    .map((domainMap) => {
      const domains = [...domainMap.values()]
        .map((items) => {
          const sorted = [...items].sort((a, b) => {
            const [ad, aq] = questionKey(a.indicator.name);
            const [bd, bq] = questionKey(b.indicator.name);
            return ad - bd || aq - bq;
          });
          return {
            domain: sorted[0].domain,
            items: sorted,
            score: c.domainScores.get(sorted[0].domain.id)?.score ?? null,
          };
        })
        .sort((a, b) => a.domain.name.localeCompare(b.domain.name, undefined, { numeric: true }));
      const thematicArea = domains[0].items[0].thematicArea;
      return {
        thematicArea,
        domains,
        score: c.thematicScores.get(thematicArea.id)?.score ?? null,
      };
    })
    .sort((a, b) => a.thematicArea.name.localeCompare(b.thematicArea.name));

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
      {thematicGroups.length === 0 ? (
        <EmptyState>No indicators configured for this sector yet.</EmptyState>
      ) : (
        <div className="space-y-8">
          {thematicGroups.map(({ thematicArea, domains, score }) => (
            <div key={thematicArea.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="display text-base font-semibold text-zinc-900">{thematicArea.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {domains.length} domain{domains.length === 1 ? "" : "s"} · reported {thematicArea.frequency}
                  </p>
                </div>
                <ScoreBadge score={score} showLabel />
              </div>
              <div className="space-y-4">
                {domains.map(({ domain, items, score: domainScore }) => (
                  <section key={domain.id} className="card overflow-hidden">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <h4 className="display truncate text-sm font-semibold text-zinc-900">{domain.name}</h4>
                        <BenchmarkLine
                          abia={domainScore}
                          nigeria={domain.benchmark_nigeria}
                          target={domain.benchmark_target}
                        />
                        {domain.description && (
                          <p className="mt-0.5 truncate text-xs text-zinc-500">{domain.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-zinc-400">
                          {items.length} indicator{items.length === 1 ? "" : "s"}
                        </span>
                        <ScoreBadge score={domainScore} />
                      </div>
                    </header>
                    <div className="divide-y divide-zinc-100">
                      {items.map((i) => {
                        const { code, text } = splitCode(i.indicator.name);
                        return (
                          <Link
                            key={i.indicator.id}
                            href={`/indicators/${i.indicator.id}`}
                            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 sm:px-5"
                          >
                            {code && (
                              <span className="w-10 shrink-0 font-mono text-xs font-semibold text-zinc-400">
                                {code}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{text}</span>
                            <span className="w-28 shrink-0 sm:w-36">
                              <ScoreBar score={i.score} />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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

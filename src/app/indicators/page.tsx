import Link from "next/link";
import { IndicatorResultLine } from "@/components/indicator-result-line";
import { BenchmarkLine, ScoreBadge, ScoreBar } from "@/components/score";
import { PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import type { IndicatorComputed } from "@/lib/scoring";
import { computeDashboard } from "@/lib/scoring";

export const metadata = { title: "Indicators" };

/** Sortable [domain, question] key parsed from names like "1.2 Does the …". */
function questionKey(name: string): [number, number] {
  const m = name.match(/^(\d+)\.(\d+)\s+/);
  return m ? [Number(m[1]), Number(m[2])] : [Number.MAX_SAFE_INTEGER, 0];
}

function splitCode(name: string): { code: string | null; text: string } {
  const m = name.match(/^(\d+\.\d+)\s+/);
  return m ? { code: m[1], text: name.slice(m[0].length) } : { code: null, text: name };
}

export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const { sector: sectorParam } = await searchParams;
  const data = await loadDashboardData();
  const c = computeDashboard(data);

  const activeSector = data.sectors.find((s) => s.slug === sectorParam) ?? null;
  const stateIndicators = c.indicators.filter((i) => i.indicator.indicator_scope !== "entity");
  const visible = activeSector
    ? stateIndicators.filter((i) => i.sector.id === activeSector.id)
    : stateIndicators;

  // Sector → thematic area → domain → indicators (ordered by question number)
  const grouped = data.sectors
    .map((s) => {
      const items = visible.filter((i) => i.sector.id === s.id);
      const byThematic = new Map<string, Map<string, IndicatorComputed[]>>();
      for (const i of items) {
        const domains = byThematic.get(i.thematicArea.id) ?? new Map<string, IndicatorComputed[]>();
        const list = domains.get(i.domain.id) ?? [];
        list.push(i);
        domains.set(i.domain.id, list);
        byThematic.set(i.thematicArea.id, domains);
      }
      const thematicGroups = [...byThematic.values()]
        .map((domainMap) => {
          const domains = [...domainMap.values()]
            .map((list) => {
              const sorted = [...list].sort((a, b) => {
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
      return { sector: s, count: items.length, thematicGroups };
    })
    .filter((g) => g.count > 0);

  return (
    <>
      <PageHeader
        title="Indicators"
        subtitle="Every measured indicator with Abia's latest result, the national comparison and the official target."
      />

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <Link
          href="/indicators"
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            !activeSector ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          All sectors
        </Link>
        {data.sectors.map((s) => (
          <Link
            key={s.id}
            href={`/indicators?sector=${s.slug}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeSector?.id === s.id
                ? "bg-zinc-950 text-white"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      {grouped.map(({ sector, count, thematicGroups }) => (
        <section key={sector.id}>
          <SectionTitle>
            {sector.name} · {count} indicators
          </SectionTitle>
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
                              className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 sm:px-5"
                            >
                              {code && (
                                <span className="w-10 shrink-0 font-mono text-xs font-semibold text-zinc-400">
                                  {code}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-zinc-800">{text}</div>
                                <IndicatorResultLine
                                  result={i.latest?.abia ?? null}
                                  nigeria={i.latest?.nigeria ?? i.domain.benchmark_nigeria ?? null}
                                  target={i.domain.benchmark_target ?? i.latest?.target ?? i.indicator.target_value}
                                  unit={i.indicator.unit}
                                  targetSource={i.indicator.target_source}
                                />
                              </div>
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
        </section>
      ))}
    </>
  );
}

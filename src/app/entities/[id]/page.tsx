import { notFound } from "next/navigation";
import type { Slide, SlideOption } from "@/components/entity-presentation";
import { EntityPresentation } from "@/components/entity-presentation";
import { formatIndicatorMetric, IndicatorResultLine } from "@/components/indicator-result-line";
import { BenchmarkLine, DeltaTag, ScoreBadge, ScoreBar, ScoreRing } from "@/components/score";
import { Crumbs, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import type { IndicatorComputed } from "@/lib/scoring";
import { computeDashboard, delta, fmt, scoreValue } from "@/lib/scoring";
import Link from "next/link";

interface Reading {
  ic: IndicatorComputed;
  value: number;
  periodLabel: string;
  score: number | null;
  /** parsed "1.2" style code, when the indicator name starts with one */
  code: string | null;
  sortKey: [number, number];
  displayName: string;
}

/** Parse "a. …\nb. …" option lists plus a trailing "Rationale: …" from a description. */
function parseDescription(description: string | null | undefined): {
  options: Array<{ letter: string; text: string }>;
  rationale: string | null;
} {
  if (!description) return { options: [], rationale: null };
  const [optionsPart, rationalePart] = description.split(/\n\s*Rationale:\s*/);
  const options = [...optionsPart.matchAll(/(?:^|\n)\s*([a-e])\.\s*([^\n]+)/gi)].map((m) => ({
    letter: m[1].toUpperCase(),
    text: m[2].trim(),
  }));
  return { options, rationale: rationalePart?.trim() ?? null };
}

/** Map a 0–100 equal-interval score back to the selected option index. */
function selectedIndex(score: number | null, optionCount: number): number | null {
  if (score == null || optionCount < 2) return null;
  return Math.round((optionCount - 1) * (1 - score / 100));
}

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

  const readings: Reading[] = [...byIndicator.entries()]
    .map(([indicatorId, reading]) => {
      const ic = c.indicatorById.get(indicatorId);
      if (!ic) return null;
      const codeMatch = ic.indicator.name.match(/^(\d+)\.(\d+)\s+/);
      return {
        ic,
        value: reading.value,
        periodLabel: reading.periodLabel,
        score: scoreValue(reading.value, ic.indicator.target_value, ic.indicator.direction),
        code: codeMatch ? `${codeMatch[1]}.${codeMatch[2]}` : null,
        sortKey: (codeMatch
          ? [Number(codeMatch[1]), Number(codeMatch[2])]
          : [Number.MAX_SAFE_INTEGER, 0]) as [number, number],
        displayName: codeMatch ? ic.indicator.name.slice(codeMatch[0].length) : ic.indicator.name,
      };
    })
    .filter((x): x is Reading => x != null);

  // Group by domain, order domains by name ("01 — …"), questions by number
  const grouped = new Map<string, Reading[]>();
  for (const r of readings) {
    const list = grouped.get(r.ic.domain.id);
    if (list) list.push(r);
    else grouped.set(r.ic.domain.id, [r]);
  }
  const domainGroups = [...grouped.values()]
    .map((items) => {
      const sorted = [...items].sort(
        (a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1]
      );
      const wsum = sorted.reduce((s, r) => s + (r.score == null ? 0 : r.ic.indicator.weight), 0);
      const score =
        wsum > 0
          ? sorted.reduce((s, r) => s + (r.score ?? 0) * (r.score == null ? 0 : r.ic.indicator.weight), 0) / wsum
          : null;
      return { domain: sorted[0].ic.domain, items: sorted, score };
    })
    .sort((a, b) => a.domain.name.localeCompare(b.domain.name, undefined, { numeric: true }));

  const latestPeriod = readings[0]?.periodLabel ?? "";

  // ---- presentation slides ----
  const slides: Slide[] = [];
  if (readings.length > 0) {
    slides.push({
      kind: "cover",
      title: entity.name,
      subtitle: `${ec.mda.name} · ${ec.lga.name} LGA (${ec.lga.zone})`,
      period: latestPeriod,
      score: ec.score,
      domainCount: domainGroups.length,
      questionCount: readings.length,
    });
    for (const [gi, group] of domainGroups.entries()) {
      const numMatch = group.domain.name.match(/^(\d+)\s*—\s*(.*)$/);
      const stateScore = c.domainScores.get(group.domain.id)?.score ?? null;
      const benchmarkParts = [
        stateScore != null ? `Abia ${fmt(stateScore, 1)}%` : null,
        group.domain.benchmark_nigeria ? `Nigeria ${group.domain.benchmark_nigeria}` : null,
        group.domain.benchmark_target ? `Target ${group.domain.benchmark_target}` : null,
      ].filter(Boolean);
      slides.push({
        kind: "domain",
        number: numMatch?.[1] ?? String(gi + 1),
        name: numMatch?.[2] ?? group.domain.name,
        benchmark: benchmarkParts.length > 0 ? benchmarkParts.join(" · ") : (group.domain.description ?? null),
        score: group.score,
        questionCount: group.items.length,
        position: `${gi + 1} of ${domainGroups.length}`,
      });
      for (const r of group.items) {
        const { options, rationale } = parseDescription(r.ic.indicator.description);
        const sel = selectedIndex(r.score, options.length);
        const slideOptions: SlideOption[] = options.map((o, oi) => ({
          ...o,
          selected: oi === sel,
        }));
        slides.push({
          kind: "question",
          domainLabel: group.domain.name,
          code: r.code ?? "—",
          question: r.displayName,
          score: r.score,
          comparison: `Result ${formatIndicatorMetric(r.value, r.ic.indicator.unit)} · Nigeria ${formatIndicatorMetric(
            r.ic.latest?.nigeria ?? r.ic.domain.benchmark_nigeria ?? null,
            r.ic.indicator.unit
          )} · Target ${formatIndicatorMetric(
            r.ic.domain.benchmark_target ?? r.ic.latest?.target ?? r.ic.indicator.target_value,
            r.ic.indicator.unit
          )}`,
          stateScore: r.ic.latest?.score ?? null,
          options: slideOptions,
          rationale,
          period: r.periodLabel,
        });
      }
    }
  }

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
        actions={<EntityPresentation slides={slides} />}
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
            {readings.length === 1 ? "" : "s"}
            {latestPeriod ? ` · ${latestPeriod}` : ""}.
          </p>
        </div>
        {domainGroups.length > 1 && (
          <div className="ml-auto hidden max-w-xs flex-1 space-y-1.5 sm:block">
            {[...domainGroups]
              .filter((g) => g.score != null)
              .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
              .slice(0, 3)
              .map((g) => (
                <div key={g.domain.id} className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="w-40 truncate">{g.domain.name}</span>
                  <div className="flex-1">
                    <ScoreBar score={g.score} />
                  </div>
                </div>
              ))}
            <div className="pt-0.5 text-[11px] text-zinc-400">Weakest domains at this facility</div>
          </div>
        )}
      </section>

      <SectionTitle hint={latestPeriod ? `Latest readings · ${latestPeriod}` : undefined}>
        Assessment by domain
      </SectionTitle>

      {readings.length === 0 ? (
        <EmptyState>No entity-level results recorded yet.</EmptyState>
      ) : (
        <div className="space-y-5">
          {domainGroups.map(({ domain, items, score }) => (
            <section key={domain.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h3 className="display truncate text-sm font-semibold text-zinc-900">{domain.name}</h3>
                  <BenchmarkLine
                    abia={c.domainScores.get(domain.id)?.score ?? null}
                    nigeria={domain.benchmark_nigeria}
                    target={domain.benchmark_target}
                  />
                  {domain.description && (
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{domain.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    {items.length} question{items.length === 1 ? "" : "s"}
                  </span>
                  <ScoreBadge score={score} />
                </div>
              </header>
              <div className="divide-y divide-zinc-100">
                {items.map((r) => (
                  <Link
                    key={r.ic.indicator.id}
                    href={`/indicators/${r.ic.indicator.id}`}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 sm:px-5"
                  >
                    {r.code && (
                      <span className="w-10 shrink-0 font-mono text-xs font-semibold text-zinc-400">{r.code}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-zinc-800">{r.displayName}</div>
                      <IndicatorResultLine
                        result={r.value}
                        nigeria={r.ic.latest?.nigeria ?? r.ic.domain.benchmark_nigeria ?? null}
                        target={r.ic.domain.benchmark_target ?? r.ic.latest?.target ?? r.ic.indicator.target_value}
                        unit={r.ic.indicator.unit}
                        targetSource={r.ic.indicator.target_source}
                        prefix={<>{r.periodLabel} ·</>}
                      />
                    </div>
                    <span className="w-28 shrink-0 sm:w-36">
                      <ScoreBar score={r.score} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

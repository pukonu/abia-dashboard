import Link from "next/link";
import { ScoreBadge } from "@/components/score";
import { CardList, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { computeDashboard, fmtValue } from "@/lib/scoring";

export const metadata = { title: "Indicators" };

export default async function IndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const { sector: sectorParam } = await searchParams;
  const data = await loadDashboardData();
  const c = computeDashboard(data);

  const activeSector = data.sectors.find((s) => s.slug === sectorParam) ?? null;
  const visible = activeSector
    ? c.indicators.filter((i) => i.sector.id === activeSector.id)
    : c.indicators;

  const grouped = data.sectors
    .map((s) => ({
      sector: s,
      items: visible.filter((i) => i.sector.id === s.id),
    }))
    .filter((g) => g.items.length > 0);

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

      {grouped.map(({ sector, items }) => (
        <section key={sector.id}>
          <SectionTitle>
            {sector.name} · {items.length} indicators
          </SectionTitle>
          <CardList>
            {items.map((i) => (
              <RowLink
                key={i.indicator.id}
                href={`/indicators/${i.indicator.id}`}
                left={
                  <>
                    <div className="truncate text-sm font-medium text-zinc-900">{i.indicator.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                      <span>
                        Abia <strong className="text-zinc-700">{fmtValue(i.latest?.abia ?? null, i.indicator.unit)}</strong>
                      </span>
                      <span>Nigeria {fmtValue(i.latest?.nigeria ?? null, i.indicator.unit)}</span>
                      <span>
                        Target {fmtValue(i.latest?.target ?? null, i.indicator.unit)}
                        {i.indicator.target_source ? ` (${i.indicator.target_source})` : ""}
                      </span>
                    </div>
                  </>
                }
                right={<ScoreBadge score={i.score} />}
              />
            ))}
          </CardList>
        </section>
      ))}
    </>
  );
}

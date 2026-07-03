import Link from "next/link";
import { ScoreBarChart } from "@/components/charts";
import { DeltaTag, ScoreBadge, ScoreBar } from "@/components/score";
import { PageHeader } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { computeDashboard, delta } from "@/lib/scoring";

export const metadata = { title: "Sectors" };

export default async function SectorsPage() {
  const data = await loadDashboardData();
  const c = computeDashboard(data);

  return (
    <>
      <PageHeader
        title="Sectors"
        subtitle="Composite performance of each sector, rolled up from thematic areas, domains and indicators."
      />
      <div className="card card-pad mb-4">
        <h2 className="display mb-2 text-base font-semibold text-zinc-900">Sector comparison</h2>
        <ScoreBarChart
          points={data.sectors.map((s) => ({
            label: s.name.replace(" & Trade", ""),
            score: c.sectorScores.get(s.id)?.score ?? null,
            color: s.color,
          }))}
          height={220}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.sectors.map((s) => {
          const pair = c.sectorScores.get(s.id) ?? { score: null, prevScore: null };
          const mdas = data.mdas.filter((m) => m.sector_id === s.id);
          const thematics = data.thematicAreas.filter((t) => t.sector_id === s.id);
          const indicatorCount = c.indicators.filter((i) => i.sector.id === s.id).length;
          return (
            <Link key={s.id} href={`/sectors/${s.slug}`} className="card card-pad group transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: `${s.color}18` }}
                  >
                    {s.icon}
                  </span>
                  <div>
                    <div className="text-base font-semibold text-zinc-900 group-hover:text-abia-dark">{s.name}</div>
                    <div className="text-xs text-zinc-500">
                      {mdas.length} MDA{mdas.length === 1 ? "" : "s"} · {thematics.length} thematic areas · {indicatorCount} indicators
                    </div>
                  </div>
                </div>
                <ScoreBadge score={pair.score} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-zinc-500">{s.description}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <ScoreBar score={pair.score} />
                </div>
                <DeltaTag value={delta(pair)} />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

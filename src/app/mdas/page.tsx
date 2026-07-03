import { DeltaTag, ScoreBadge, ScoreBar } from "@/components/score";
import { CardList, PageHeader, RowLink, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { computeDashboard, delta } from "@/lib/scoring";

export const metadata = { title: "MDAs" };

export default async function MdasPage() {
  const data = await loadDashboardData();
  const c = computeDashboard(data);

  return (
    <>
      <PageHeader
        title="Ministries, Departments & Agencies"
        subtitle="Each MDA is scored from the latest results of the entities it runs — hospitals, schools, projects, commands and schemes."
      />
      {data.sectors.map((s) => {
        const mdas = c.mdaScores.filter((m) => m.sector.id === s.id);
        if (!mdas.length) return null;
        return (
          <section key={s.id}>
            <SectionTitle>
              {s.icon} {s.name}
            </SectionTitle>
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
                  right={
                    <div className="flex items-center gap-3">
                      <div className="hidden w-32 sm:block">
                        <ScoreBar score={m.score} />
                      </div>
                      <div className="hidden sm:block">
                        <DeltaTag value={delta(m)} />
                      </div>
                      <ScoreBadge score={m.score} />
                    </div>
                  }
                />
              ))}
            </CardList>
          </section>
        );
      })}
    </>
  );
}

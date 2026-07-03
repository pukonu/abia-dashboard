import Link from "next/link";
import { DeltaTag, ScoreBadge, ScoreBar } from "@/components/score";
import { CardList, PageHeader, RowLink } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { computeDashboard, delta } from "@/lib/scoring";

export const metadata = { title: "Local Government Areas" };

const ZONES = ["All", "Abia North", "Abia Central", "Abia South"];

export default async function LgasPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const { zone } = await searchParams;
  const activeZone = ZONES.includes(zone ?? "") ? zone! : "All";

  const data = await loadDashboardData();
  const c = computeDashboard(data);
  const rows = c.lgaScores.filter((l) => activeZone === "All" || l.lga.zone === activeZone);

  return (
    <>
      <PageHeader
        title="Local Government Areas"
        subtitle="Composite scores for all 17 LGAs, aggregated from the latest results of every measured entity located in each LGA."
      />

      {/* Zone filter */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {ZONES.map((z) => (
          <Link
            key={z}
            href={z === "All" ? "/lgas" : `/lgas?zone=${encodeURIComponent(z)}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeZone === z
                ? "bg-zinc-950 text-white"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {z === "All" ? "All zones" : z}
          </Link>
        ))}
      </div>

      <CardList>
        {rows.map((l, idx) => (
          <RowLink
            key={l.lga.id}
            href={`/lgas/${l.lga.id}`}
            left={
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-sm font-semibold text-zinc-400">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900">{l.lga.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {l.lga.zone} · {l.entityIds.length} entit{l.entityIds.length === 1 ? "y" : "ies"} · {l.readings} readings
                  </div>
                </div>
              </div>
            }
            right={
              <div className="flex items-center gap-3">
                <div className="hidden w-32 sm:block">
                  <ScoreBar score={l.score} />
                </div>
                <div className="hidden sm:block">
                  <DeltaTag value={delta(l)} />
                </div>
                <ScoreBadge score={l.score} />
              </div>
            }
          />
        ))}
      </CardList>
      <p className="mt-3 text-xs text-zinc-400">
        LGAs without measured entities yet show “—”. Add entities and results in Supabase to include them.
      </p>
    </>
  );
}

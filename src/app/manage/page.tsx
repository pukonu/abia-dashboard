import Link from "next/link";
import { DemoModeNotice } from "@/components/forms";
import { PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { DATASETS } from "@/lib/manage-config";

export const metadata = { title: "Manage" };

export default async function ManagePage() {
  const data = await loadDashboardData();

  const counts: Record<string, number> = {
    sectors: data.sectors.length,
    lgas: data.lgas.length,
    mdas: data.mdas.length,
    entities: data.entities.length,
    "thematic-areas": data.thematicAreas.length,
    domains: data.domains.length,
    indicators: data.indicators.length,
    "time-periods": data.timePeriods.length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Manage the dashboard"
        subtitle="Configure every layer of the measurement framework, then record results — one at a time with evidence, or in bulk via CSV."
      />
      <DemoModeNotice show={data.mode !== "live"} />

      <SectionTitle>Record results</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/manage/results" className="card card-pad group transition-shadow hover:shadow-md">
          <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
            ✎ Enter a result
          </div>
          <p className="mt-1.5 text-sm text-zinc-500">
            Record Abia&apos;s value for an indicator and period — with the national comparison,
            a target override and evidence images.
          </p>
        </Link>
        <Link href="/manage/results#csv" className="card card-pad group transition-shadow hover:shadow-md">
          <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
            ⇪ Bulk upload via CSV
          </div>
          <p className="mt-1.5 text-sm text-zinc-500">
            Download the prefilled template, fill in the values, and upload to populate a whole
            reporting period at once.
          </p>
        </Link>
      </div>

      <SectionTitle>Configure datasets</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DATASETS.map((d) => (
          <Link key={d.slug} href={`/manage/${d.slug}`} className="card card-pad group transition-shadow hover:shadow-md">
            <div className="flex items-baseline justify-between gap-2">
              <div className="display text-base font-semibold text-zinc-900 group-hover:underline">{d.label}</div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">
                {counts[d.slug] ?? 0}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500">{d.description}</p>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-zinc-400">
        Schema changes (new columns, tables) are managed with Prisma — edit{" "}
        <code>prisma/schema.prisma</code> and run <code>npm run db:migrate</code>. This area only
        edits data, not structure.
      </p>
    </>
  );
}

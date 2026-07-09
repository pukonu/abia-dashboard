import Link from "next/link";
import { DemoModeNotice, Flash } from "@/components/forms";
import SectorDashboardEntry from "@/components/manage/SectorDashboardEntry";
import { ActionLink, Crumbs, PageHeader } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { saveResultRow } from "../actions";

export const metadata = { title: "Sector Dashboard data" };

export default async function SectorDashboardDataPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; sector?: string }>;
}) {
  const { msg, err, sector: sectorParam } = await searchParams;
  const data = await loadDashboardData();
  const live = data.mode === "live";

  const health = data.sectors.find((s) => s.slug === "health");
  const initialSectorId =
    (sectorParam && data.sectors.find((s) => s.id === sectorParam || s.slug === sectorParam)?.id) ||
    health?.id ||
    null;

  const entrySectors = data.sectors.map((s) => ({ id: s.id, name: s.name, slug: s.slug }));
  const entryThematicAreas = data.thematicAreas.map((t) => ({
    id: t.id,
    sectorId: t.sector_id,
    name: t.name,
    frequency: t.frequency,
    isSectorDashboard: Boolean(t.is_sector_dashboard),
  }));
  const entryDomains = data.domains.map((d) => ({
    id: d.id,
    thematicAreaId: d.thematic_area_id,
    name: d.name,
  }));
  const entryIndicators = data.indicators
    .filter((i) => i.indicator_scope !== "entity")
    .map((i) => ({
      id: i.id,
      domainId: i.domain_id,
      name: i.name,
      unit: i.unit,
      description: i.description ?? null,
      targetValue: i.target_value,
    }));
  const entryPeriods = [...data.timePeriods]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((p) => ({ id: p.id, label: p.label, frequency: p.frequency }));
  const existingResults = data.results
    .filter((r) => r.entity_id == null)
    .map((r) => ({
      indicatorId: r.indicator_id,
      timePeriodId: r.time_period_id,
      abiaValue: r.abia_value,
      nigeriaValue: r.nigeria_value,
      notes: r.notes ?? null,
    }));

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Sector Dashboard data" }]} />
      <PageHeader
        eyebrow="Data entry"
        title="Sector Dashboard data"
        subtitle="Enter statewide values for each sector’s Sector Dashboard thematic area (the one marked with the Sector Dashboard flag). These numbers power executive sector dashboards and the Friday weekly digest."
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/sectors/health">View Health sector</ActionLink>
            <ActionLink href="/manage/results">Advanced results wizard</ActionLink>
          </div>
        }
      />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={!live} />

      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
        <p className="font-medium">How to use this page</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-emerald-900/90">
          <li>Pick the sector (Health) and the reporting month.</li>
          <li>Fill Abia values under each domain — leave blank anything you do not have yet.</li>
          <li>Click Save on each row. Optional: add a Nigeria benchmark and a short source note.</li>
        </ol>
        <p className="mt-2 text-xs text-emerald-900/80">
          Need entity-level PHC facility entry instead? Use{" "}
          <Link href="/manage/results" className="font-semibold underline underline-offset-2">
            Record results
          </Link>
          .
        </p>
      </div>

      <SectorDashboardEntry
        sectors={entrySectors}
        thematicAreas={entryThematicAreas}
        domains={entryDomains}
        indicators={entryIndicators}
        periods={entryPeriods}
        existingResults={existingResults}
        saveRowAction={saveResultRow}
        disabled={!live}
        initialSectorId={initialSectorId}
      />
    </>
  );
}

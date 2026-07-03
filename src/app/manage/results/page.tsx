import { DemoModeNotice, Flash } from "@/components/forms";
import ResultWizard from "@/components/manage/ResultWizard";
import { ActionLink, Crumbs, PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { importResultsCsv, saveResultsBatch } from "../actions";

export const metadata = { title: "Record results" };

export default async function ResultsEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const data = await loadDashboardData();
  const live = data.mode === "live";

  const lgaById = new Map(data.lgas.map((l) => [l.id, l]));

  const wizardSectors = [...data.sectors]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ id: s.id, name: s.name }));

  const wizardMdas = data.mdas.map((m) => ({
    id: m.id,
    sectorId: m.sector_id,
    name: m.name,
    abbreviation: m.abbreviation,
  }));

  const wizardEntities = data.entities.map((e) => ({
    id: e.id,
    mdaId: e.mda_id,
    name: e.name,
    detail: lgaById.get(e.lga_id)?.name ?? "",
  }));

  const wizardThematicAreas = data.thematicAreas.map((t) => ({
    id: t.id,
    sectorId: t.sector_id,
    name: t.name,
    frequency: t.frequency,
  }));

  const wizardDomains = data.domains.map((d) => ({
    id: d.id,
    thematicAreaId: d.thematic_area_id,
    name: d.name,
  }));

  const wizardIndicators = data.indicators.map((i) => ({
    id: i.id,
    domainId: i.domain_id,
    name: i.name,
    unit: i.unit,
    scope: i.indicator_scope,
    targetLabel: i.target_value != null ? `target ${i.target_value}${i.unit === "%" ? "%" : ""}` : "",
  }));

  const wizardPeriods = [...data.timePeriods]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((p) => ({ id: p.id, label: p.label, frequency: p.frequency }));

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Results" }]} />
      <PageHeader
        eyebrow="Data entry"
        title="Record results"
        subtitle="A guided flow: pick the sector and MDA, then the entity (or statewide), then fill values across the domain grid. Entity entries automatically roll up into their linked state indicator."
      />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={!live} />

      {/* Guided entry */}
      <SectionTitle>Enter results</SectionTitle>
      <ResultWizard
        sectors={wizardSectors}
        mdas={wizardMdas}
        entities={wizardEntities}
        indicators={wizardIndicators}
        domains={wizardDomains}
        thematicAreas={wizardThematicAreas}
        periods={wizardPeriods}
        action={saveResultsBatch}
        disabled={!live}
      />

      {/* CSV import */}
      <div id="csv" />
      <SectionTitle>Bulk upload via CSV</SectionTitle>
      <div className="card card-pad">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>Download a template — state and entity templates are separated and prefilled with matching indicators and periods.</li>
          <li>Fill the <code className="rounded bg-zinc-100 px-1">abia_value</code> column (and optionally <code className="rounded bg-zinc-100 px-1">nigeria_value</code>, <code className="rounded bg-zinc-100 px-1">target_value</code>, <code className="rounded bg-zinc-100 px-1">notes</code>). Leave rows blank to skip them.</li>
          <li>Upload the file — results are created or updated for each filled row.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionLink href="/api/csv-template" download>
            Template — state-level results
          </ActionLink>
          <ActionLink href="/api/csv-template?scope=entities" download>
            Template — entity-level results
          </ActionLink>
        </div>
        <form action={importResultsCsv} className="mt-5 border-t border-zinc-100 pt-4">
          <fieldset disabled={!live} className="flex flex-wrap items-center gap-3 disabled:opacity-60">
            <input
              type="file"
              name="csv"
              accept=".csv,text/csv"
              required
              className="block text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-800 hover:file:bg-zinc-200"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed"
            >
              Upload results
            </button>
          </fieldset>
        </form>
      </div>
    </>
  );
}

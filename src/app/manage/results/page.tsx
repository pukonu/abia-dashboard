import { DemoModeNotice, Flash } from "@/components/forms";
import ResultWizard from "@/components/manage/ResultWizard";
import { ActionLink, Crumbs, PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import {
  collectedAt,
  coverageLabel,
  describeSource,
  rollupMethod,
  rollupMethodLabel,
} from "@/lib/indicator-collection";
import { resolveIndicatorScoreOptions } from "@/lib/indicator-input";
import { computeDashboard, fmtValue } from "@/lib/scoring";
import Link from "next/link";
import { clearStateOverride, importResultsCsv, saveResultRow } from "../actions";

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
    collectedAt: collectedAt(i),
    rollsUp: collectedAt(i) !== "state" && rollupMethod(i) !== "none",
    rollupHint: `${rollupMethodLabel(rollupMethod(i)).toLowerCase()} of ${
      collectedAt(i) === "lga" ? "LGA returns" : "facility records"
    }`,
    valueType: i.value_type,
    scoreOptions: resolveIndicatorScoreOptions(i) ?? [],
    targetLabel: i.target_value != null ? `target ${i.target_value}${i.unit === "%" ? "%" : ""}` : "",
  }));

  const wizardPeriods = [...data.timePeriods]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((p) => ({ id: p.id, label: p.label, frequency: p.frequency }));

  const evidenceCountByResultId = new Map<string, number>();
  for (const item of data.evidence) {
    evidenceCountByResultId.set(item.result_id, (evidenceCountByResultId.get(item.result_id) ?? 0) + 1);
  }

  const existingResults = data.results.map((result) => ({
    indicatorId: result.indicator_id,
    timePeriodId: result.time_period_id,
    entityId: result.entity_id,
    lgaId: result.lga_id ?? null,
    overrideNote: result.override_note ?? null,
    abiaValue: result.abia_value,
    nigeriaValue: result.nigeria_value,
    notes: result.notes ?? null,
    evidenceCount: evidenceCountByResultId.get(result.id) ?? 0,
  }));

  const wizardLgas = [...data.lgas]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((l) => ({ id: l.id, name: l.name, zone: l.zone }));

  // Statewide overrides of LGA/facility roll-ups, newest period first.
  const c = computeDashboard(data);
  const overrides = c.indicators
    .flatMap((ic) => ic.series.filter((p) => p.source === "override").map((point) => ({ ic, point })))
    .sort((a, b) => b.point.period.start_date.localeCompare(a.point.period.start_date));

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Results" }]} />
      <PageHeader
        eyebrow="Data entry"
        title="Record results"
        subtitle="A guided flow: pick the sector and MDA, then statewide, an LGA or a facility, then fill values across the domain grid. LGA and facility records roll up into the statewide figure using each indicator's roll-up method."
        actions={
          <ActionLink href="/manage/sector-dashboard" primary>
            Sector Dashboard data
          </ActionLink>
        }
      />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={!live} />

      <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
        Filling the Health Executive Dashboard? Use{" "}
        <Link href="/manage/sector-dashboard" className="font-semibold text-zinc-900 underline underline-offset-2">
          Sector Dashboard data
        </Link>{" "}
        — it skips the MDA/entity steps and shows only the monthly statewide indicators.
      </div>

      {/* Guided entry */}
      <SectionTitle>Enter results</SectionTitle>
      <ResultWizard
        sectors={wizardSectors}
        mdas={wizardMdas}
        entities={wizardEntities}
        lgas={wizardLgas}
        indicators={wizardIndicators}
        domains={wizardDomains}
        thematicAreas={wizardThematicAreas}
        periods={wizardPeriods}
        existingResults={existingResults}
        saveRowAction={saveResultRow}
        disabled={!live}
      />

      {/* Statewide overrides */}
      <SectionTitle>Active overrides</SectionTitle>
      <div className="card card-pad">
        <p className="text-sm text-zinc-600">
          A statewide value entered for an LGA- or facility-collected indicator overrides its roll-up for that
          period. Clear an override to hand the period back to the roll-up.
        </p>
        {overrides.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No overrides — every rolled-up indicator uses its LGA or facility data.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {overrides.map(({ ic, point }) => (
              <li key={`${ic.indicator.id}:${point.period.id}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-900">{ic.indicator.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {point.period.label} · override {fmtValue(point.abia, ic.indicator.unit)}
                    {point.rollup
                      ? ` · roll-up ${fmtValue(point.rollup.value, ic.indicator.unit)} from ${coverageLabel(point.rollup.level, point.rollup.coverage)}`
                      : " · no LGA/facility data yet"}
                  </div>
                  <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{describeSource(point)}</div>
                </div>
                <form action={clearStateOverride}>
                  <input type="hidden" name="indicator_id" value={ic.indicator.id} />
                  <input type="hidden" name="time_period_id" value={point.period.id} />
                  <input type="hidden" name="_back" value="/manage/results" />
                  <button
                    type="submit"
                    disabled={!live}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear override
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CSV import */}
      <div id="csv" />
      <SectionTitle>Bulk upload via CSV</SectionTitle>
      <div className="card card-pad">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>Download a template — one per collection level, prefilled with matching indicators, periods and LGAs or facilities.</li>
          <li>Fill the <code className="rounded bg-zinc-100 px-1">abia_value</code> column (and optionally <code className="rounded bg-zinc-100 px-1">nigeria_value</code>, <code className="rounded bg-zinc-100 px-1">target_value</code>, <code className="rounded bg-zinc-100 px-1">notes</code>). Leave rows blank to skip them. To override a rolled-up indicator statewide, add a row with no LGA or facility and an <code className="rounded bg-zinc-100 px-1">override_note</code>.</li>
          <li>Upload the file — results are created or updated for each filled row.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionLink href="/api/csv-template" download>
            Template — statewide results
          </ActionLink>
          <ActionLink href="/api/csv-template?scope=lgas" download>
            Template — LGA returns
          </ActionLink>
          <ActionLink href="/api/csv-template?scope=entities" download>
            Template — facility results
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

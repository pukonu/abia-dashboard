import { DemoModeNotice, Flash, FieldLabel, inputClass } from "@/components/forms";
import { ActionLink, Crumbs, PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { importResultsCsv, saveResult } from "../actions";

export const metadata = { title: "Record results" };

export default async function ResultsEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const data = await loadDashboardData();
  const live = data.mode === "live";

  const domainById = new Map(data.domains.map((d) => [d.id, d]));
  const thematicById = new Map(data.thematicAreas.map((t) => [t.id, t]));

  const indicatorOptions = data.indicators.map((i) => {
    const domain = domainById.get(i.domain_id);
    const thematic = domain ? thematicById.get(domain.thematic_area_id) : undefined;
    return {
      value: i.id,
      label: `${i.name} (${i.unit}) — ${thematic?.name ?? ""}${thematic ? ` · ${thematic.frequency}` : ""}`,
    };
  });

  const periodOptions = [...data.timePeriods]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((p) => ({ value: p.id, label: `${p.label} (${p.frequency})` }));

  const entityOptions = data.entities.map((e) => ({
    value: e.id,
    label: `${e.name} — ${data.lgas.find((l) => l.id === e.lga_id)?.name ?? ""}`,
  }));

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Results" }]} />
      <PageHeader
        eyebrow="Data entry"
        title="Record results"
        subtitle="Enter Abia's measured value for an indicator and reporting period. Attach evidence images to back the figure."
      />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={!live} />

      {/* Single result with evidence */}
      <SectionTitle>Enter a result</SectionTitle>
      <form action={saveResult} className="card card-pad">
        <fieldset disabled={!live} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel label="Indicator" required />
            <select name="indicator_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>Select an indicator…</option>
              {indicatorOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel label="Time period" required help="Match the indicator's reporting frequency" />
            <select name="time_period_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>Select a period…</option>
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel label="Entity" help="Leave empty for the state-level result" />
            <select name="entity_id" defaultValue="" className={inputClass}>
              <option value="">Whole state (no entity)</option>
              {entityOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel label="Abia value" required help="The main measured result" />
            <input type="number" step="any" name="abia_value" required className={inputClass} />
          </div>
          <div>
            <FieldLabel label="Nigeria value" help="National comparison, if known" />
            <input type="number" step="any" name="nigeria_value" className={inputClass} />
          </div>
          <div>
            <FieldLabel label="Target override" help="Only if it differs from the indicator's target" />
            <input type="number" step="any" name="target_value" className={inputClass} />
          </div>
          <div>
            <FieldLabel label="Notes" />
            <input type="text" name="notes" placeholder="Optional context" className={inputClass} />
          </div>
          <div className="sm:col-span-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
            <FieldLabel label="Evidence images" help="Photos, scans or screenshots backing this figure" />
            <input
              type="file"
              name="evidence"
              accept="image/*"
              multiple
              className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-zinc-800"
            />
            <input
              type="text"
              name="evidence_caption"
              placeholder="Caption for the evidence (optional)"
              className={`${inputClass} mt-3`}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed"
            >
              Save result
            </button>
          </div>
        </fieldset>
      </form>

      {/* CSV import */}
      <div id="csv" />
      <SectionTitle>Bulk upload via CSV</SectionTitle>
      <div className="card card-pad">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
          <li>Download a template — it comes prefilled with every indicator and the current reporting period.</li>
          <li>Fill the <code className="rounded bg-zinc-100 px-1">abia_value</code> column (and optionally <code className="rounded bg-zinc-100 px-1">nigeria_value</code>, <code className="rounded bg-zinc-100 px-1">target_value</code>, <code className="rounded bg-zinc-100 px-1">notes</code>). Leave rows blank to skip them.</li>
          <li>Upload the file — results are created or updated for each filled row.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionLink href="/api/csv-template" download>
            ↓ Template — state-level results
          </ActionLink>
          <ActionLink href="/api/csv-template?scope=entities" download>
            ↓ Template — entity-level results
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
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed"
            >
              Upload results
            </button>
          </fieldset>
        </form>
      </div>
    </>
  );
}

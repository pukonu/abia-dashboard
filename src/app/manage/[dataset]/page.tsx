import { notFound } from "next/navigation";
import { DemoModeNotice, Flash, FormField } from "@/components/forms";
import { Crumbs, PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { getDataset, optionsFor } from "@/lib/manage-config";
import { createRecord, deleteRecord } from "../actions";

export default async function DatasetPage({
  params,
  searchParams,
}: {
  params: Promise<{ dataset: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { dataset } = await params;
  const { msg, err } = await searchParams;
  const spec = getDataset(dataset);
  if (!spec) notFound();

  const data = await loadDashboardData();
  const live = data.mode === "live";
  const rows = spec.list(data);

  const create = createRecord.bind(null, spec.slug);
  const remove = deleteRecord.bind(null, spec.slug);

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: spec.label }]} />
      <PageHeader eyebrow="Configuration" title={spec.label} subtitle={spec.description} />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={!live} />

      <SectionTitle>Add a {spec.labelSingular.toLowerCase()}</SectionTitle>
      <form action={create} className="card card-pad">
        <fieldset disabled={!live} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
          {spec.fields.map((f) => (
            <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <FormField
                field={f}
                options={f.optionsFrom ? optionsFor(data, f.optionsFrom) : undefined}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed"
            >
              Save {spec.labelSingular.toLowerCase()}
            </button>
          </div>
        </fieldset>
      </form>

      <SectionTitle hint={`${rows.length} record${rows.length === 1 ? "" : "s"}`}>
        Existing {spec.label.toLowerCase()}
      </SectionTitle>
      {rows.length === 0 ? (
        <div className="card card-pad text-center text-sm text-zinc-500">
          Nothing here yet — add the first {spec.labelSingular.toLowerCase()} above.
        </div>
      ) : (
        <div className="card divide-y divide-zinc-100 overflow-hidden">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-900">{row.title}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">{row.subtitle}</div>
              </div>
              <form action={remove}>
                <input type="hidden" name="id" value={row.id} />
                <button
                  type="submit"
                  disabled={!live}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

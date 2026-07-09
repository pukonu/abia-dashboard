import { ArrowRight, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { DemoModeNotice, Flash, FormField } from "@/components/forms";
import { DatasetIcon } from "@/components/manage/dataset-icons";
import GhostTitleField from "@/components/manage/GhostTitleField";
import RecordFormModal from "@/components/manage/RecordFormModal";
import { CardList, Crumbs, EmptyState, RowLink, Tabs } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { formatScoreOptionsText } from "@/lib/indicator-input";
import {
  childRows,
  displayValue,
  findRecord,
  getDataset,
  optionsByField,
  primaryField,
  secondaryFields,
  singularLabel,
} from "@/lib/manage-config";
import { createRecord, deleteRecord, patchRecord, updateRecord } from "../../actions";

export default async function RecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ dataset: string; id: string }>;
  searchParams: Promise<{ tab?: string; msg?: string; err?: string }>;
}) {
  const { dataset, id } = await params;
  const { tab: rawTab, msg, err } = await searchParams;
  const spec = getDataset(dataset);
  if (!spec) notFound();

  const data = await loadDashboardData();
  const live = data.mode === "live";
  const record = findRecord(data, spec, id);
  if (!record) notFound();

  const listRow = spec.list(data).find((r) => r.id === id);
  const title = listRow?.title ?? spec.labelSingular;
  const primary = primaryField(spec);
  const primaryFieldSpec = spec.fields.find((f) => f.name === primary)!;
  const secondary = secondaryFields(spec);

  const children = (spec.children ?? []).map((child) => {
    const childSpec = getDataset(child.slug)!;
    return { ...child, spec: childSpec, rows: childRows(data, child, id) };
  });

  const validTabs = new Set(["overview", "settings", ...children.map((c) => c.slug)]);
  const tab = rawTab && validTabs.has(rawTab) ? rawTab : "overview";
  const base = `/manage/${spec.slug}/${id}`;

  const patchTitle = patchRecord.bind(null, spec.slug, id);
  const update = updateRecord.bind(null, spec.slug, id);
  const remove = deleteRecord.bind(null, spec.slug);
  const activeChild = children.find((c) => c.slug === tab);

  const childDefaults = activeChild
    ? Object.fromEntries(
        activeChild.spec.fields
          .filter((f) => f.name === activeChild.foreignKey)
          .map((f) => [f.name, id])
      )
    : {};

  return (
    <>
      <Crumbs
        items={[
          { href: "/manage", label: "Manage" },
          { href: `/manage/${spec.slug}`, label: spec.label },
          { label: title },
        ]}
      />

      <div className="mb-5">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
          {spec.labelSingular}
        </div>
        <GhostTitleField
          name={primary}
          label={primaryFieldSpec.label}
          value={String(record[primary] ?? title)}
          action={patchTitle}
          disabled={!live}
          backTo={base}
        />
        {listRow?.subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">{listRow.subtitle}</p>
        )}
      </div>

      <Flash msg={msg} err={err} />
      <DemoModeNotice show={!live} />

      <Tabs
        active={tab}
        items={[
          { id: "overview", label: "Overview", href: base },
          ...children.map((c) => ({
            id: c.slug,
            label: `${c.spec.label} (${c.rows.length})`,
            href: `${base}?tab=${c.slug}`,
          })),
          { id: "settings", label: "Settings", href: `${base}?tab=settings` },
        ]}
      />

      {tab === "overview" && (
        <>
          {children.length > 0 && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {children.map((c) => (
                <a
                  key={c.slug}
                  href={`${base}?tab=${c.slug}`}
                  className="card card-pad group transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <DatasetIcon slug={c.slug} />
                    </span>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">
                      {c.rows.length}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-zinc-900 group-hover:underline">
                    {c.spec.label}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{c.spec.description}</p>
                </a>
              ))}
            </div>
          )}

          <div className="card card-pad">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Details</h2>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {secondary.map((f) => (
                <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {f.label}
                  </dt>
                  <dd className="mt-1 text-sm text-zinc-900">
                    {displayValue(data, f, record[f.name])}
                  </dd>
                </div>
              ))}
            </dl>
            {secondary.length === 0 && (
              <p className="text-sm text-zinc-500">
                All configuration is in the title above. Open Settings for advanced options.
              </p>
            )}
          </div>
        </>
      )}

      {tab === "settings" && (
        <>
          <form action={update} className="card card-pad">
            <input type="hidden" name="_back" value={`${base}?tab=settings`} />
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Configuration</h2>
            <fieldset disabled={!live} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
              {secondary.map((f) => (
                <div
                  key={f.name}
                  className={f.type === "textarea" || f.type === "checkbox" ? "sm:col-span-2" : ""}
                >
                  <FormField
                    field={f}
                    options={optionsByField(data, [f])[f.name]}
                    defaultValue={
                      f.name === "score_options"
                        ? formatScoreOptionsText(record[f.name])
                        : f.type === "checkbox"
                          ? record[f.name] === true || record[f.name] === "true"
                            ? "true"
                            : "false"
                          : record[f.name] == null
                            ? ""
                            : String(record[f.name])
                    }
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed"
                >
                  Save settings
                </button>
              </div>
            </fieldset>
          </form>

          <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 border-red-100 p-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Trash2 className="h-4 w-4 text-red-600" strokeWidth={1.5} />
                Delete {singularLabel(spec)}
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Removes this record{children.length > 0 ? " and everything nested under it" : ""}.
                This cannot be undone.
              </p>
            </div>
            <form action={remove}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="_back" value={`/manage/${spec.slug}`} />
              <button
                type="submit"
                disabled={!live}
                className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            </form>
          </div>
        </>
      )}

      {activeChild && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              {activeChild.rows.length} {activeChild.spec.label.toLowerCase()} linked to this{" "}
              {singularLabel(spec)}.
            </p>
            <RecordFormModal
              title={`Add ${singularLabel(activeChild.spec)}`}
              description={`Create a new ${singularLabel(activeChild.spec)} under ${title}.`}
              submitLabel={`Save ${singularLabel(activeChild.spec)}`}
              triggerLabel={`Add ${singularLabel(activeChild.spec)}`}
              action={createRecord.bind(null, activeChild.spec.slug)}
              fields={activeChild.spec.fields}
              optionsByField={optionsByField(data, activeChild.spec.fields)}
              defaultValues={childDefaults}
              backTo={`${base}?tab=${activeChild.slug}`}
              disabled={!live}
              wide
            />
          </div>

          {activeChild.rows.length === 0 ? (
            <EmptyState>
              No {activeChild.spec.label.toLowerCase()} here yet. Add the first one using the
              button above.
            </EmptyState>
          ) : (
            <CardList>
              {activeChild.rows.map((row) => (
                <RowLink
                  key={row.id}
                  href={`/manage/${activeChild.spec.slug}/${row.id}`}
                  left={
                    <>
                      <div className="truncate text-sm font-medium text-zinc-900">{row.title}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">{row.subtitle}</div>
                    </>
                  }
                  right={
                    <span className="hidden text-xs text-zinc-400 sm:inline">Open</span>
                  }
                />
              ))}
            </CardList>
          )}
        </>
      )}

      {tab === "overview" && children.length > 0 && (
        <div className="mt-6">
          <a
            href={`${base}?tab=${children[0].slug}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
          >
            Manage {children[0].spec.label.toLowerCase()}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>
        </div>
      )}
    </>
  );
}

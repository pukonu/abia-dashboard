import { notFound } from "next/navigation";
import { DemoModeNotice, Flash } from "@/components/forms";
import { DATASET_ICONS } from "@/components/manage/dataset-icons";
import RecordFormModal from "@/components/manage/RecordFormModal";
import StatCard from "@/components/manage/StatCard";
import { CardList, Crumbs, EmptyState, PageHeader, RowLink, Tabs } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import {
  getDataset,
  optionsByField,
  singularLabel,
} from "@/lib/manage-config";
import { createRecord } from "../actions";

export default async function DatasetPage({
  params,
  searchParams,
}: {
  params: Promise<{ dataset: string }>;
  searchParams: Promise<{ tab?: string; msg?: string; err?: string }>;
}) {
  const { dataset } = await params;
  const { tab: rawTab, msg, err } = await searchParams;
  const spec = getDataset(dataset);
  if (!spec) notFound();

  const data = await loadDashboardData();
  const live = data.mode === "live";
  const rows = spec.list(data);
  const tab = rawTab === "records" ? "records" : "overview";
  const create = createRecord.bind(null, spec.slug);
  const fieldOpts = optionsByField(data, spec.fields);
  const recent = rows.slice(0, 5);

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: spec.label }]} />
      <PageHeader
        eyebrow="Configuration"
        title={spec.label}
        subtitle={spec.description}
        actions={
          <RecordFormModal
            title={`Add ${singularLabel(spec)}`}
            description={spec.description}
            submitLabel={`Save ${singularLabel(spec)}`}
            triggerLabel={`Add ${singularLabel(spec)}`}
            action={create}
            fields={spec.fields}
            optionsByField={fieldOpts}
            backTo={`/manage/${spec.slug}?tab=records`}
            disabled={!live}
            wide
          />
        }
      />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={!live} />

      <Tabs
        active={tab}
        items={[
          { id: "overview", label: "Overview", href: `/manage/${spec.slug}` },
          { id: "records", label: `All records (${rows.length})`, href: `/manage/${spec.slug}?tab=records` },
        ]}
      />

      {tab === "overview" ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={DATASET_ICONS[spec.slug] ?? DATASET_ICONS.entities}
              label="Total records"
              value={rows.length}
            />
            {spec.children?.map((child) => {
              const childSpec = getDataset(child.slug)!;
              const childCount = childSpec.list(data).length;
              return (
                <StatCard
                  key={child.slug}
                  icon={DATASET_ICONS[child.slug] ?? DATASET_ICONS.entities}
                  label={childSpec.label}
                  value={childCount}
                  hint={`Linked ${childSpec.label.toLowerCase()}`}
                  accent="blue"
                />
              );
            })}
          </div>

          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Recent records</h2>
            {rows.length > 5 && (
              <a
                href={`/manage/${spec.slug}?tab=records`}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
              >
                View all
              </a>
            )}
          </div>

          {recent.length === 0 ? (
            <EmptyState>
              No {spec.label.toLowerCase()} yet. Use &ldquo;Add {singularLabel(spec)}&rdquo; to
              create the first record.
            </EmptyState>
          ) : (
            <CardList>
              {recent.map((row) => (
                <RowLink
                  key={row.id}
                  href={`/manage/${spec.slug}/${row.id}`}
                  left={
                    <>
                      <div className="truncate text-sm font-medium text-zinc-900">{row.title}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">{row.subtitle}</div>
                    </>
                  }
                />
              ))}
            </CardList>
          )}
        </>
      ) : rows.length === 0 ? (
        <EmptyState>
          No records yet. Use &ldquo;Add {singularLabel(spec)}&rdquo; to get started.
        </EmptyState>
      ) : (
        <CardList>
          {rows.map((row) => (
            <RowLink
              key={row.id}
              href={`/manage/${spec.slug}/${row.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium text-zinc-900">{row.title}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{row.subtitle}</div>
                </>
              }
            />
          ))}
        </CardList>
      )}
    </>
  );
}

import { DemoModeNotice, Flash } from "@/components/forms";
import RecordFormModal from "@/components/manage/RecordFormModal";
import { CardList, Crumbs, EmptyState, PageHeader } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import type { FieldSpec } from "@/lib/manage-config";
import { createSectorFact, deleteSectorFact } from "./actions";

export const metadata = { title: "Sector Facts — Manage" };

export default async function ManageSectorFactsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const data = await loadDashboardData();
  const disabled = data.mode !== "live";
  const sectorName = (id: string) => data.sectors.find((sector) => sector.id === id)?.name ?? "Unknown sector";
  const fields: FieldSpec[] = [
    {
      name: "sector_id",
      label: "Sector",
      type: "select",
      required: true,
      options: data.sectors.map((sector) => ({ value: sector.id, label: sector.name })),
    },
    { name: "label", label: "Label", type: "text", required: true, placeholder: "e.g. Current enrolment" },
    { name: "value", label: "Value", type: "text", required: true, placeholder: "e.g. 312,480 or 43%" },
    {
      name: "caption",
      label: "Caption",
      type: "textarea",
      placeholder: "Short explanation shown under the value.",
    },
    { name: "source", label: "Source", type: "text", placeholder: "e.g. Ministry return, 2026 baseline" },
    { name: "sort_order", label: "Sort order", type: "number", placeholder: "0" },
  ];

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Sector facts" }]} />
      <PageHeader
        eyebrow="Presentation"
        title="Sector facts"
        subtitle="Enter curated executive numbers for sector pages, such as enrolment totals, programme reach, investment pipeline values, or citizen-service counts."
        actions={
          <RecordFormModal
            title="New sector fact"
            description="Use this for important numbers that should be shown on a sector page but are not yet tracked through indicators or entities."
            submitLabel="Save fact"
            triggerLabel="Add sector fact"
            action={createSectorFact}
            fields={fields}
            backTo="/manage/sector-facts"
            disabled={disabled}
            wide
          />
        }
      />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={disabled} />

      {data.sectorFacts.length === 0 ? (
        <EmptyState>No manual sector facts yet. Add one to enrich a sector landing page.</EmptyState>
      ) : (
        <CardList>
          {[...data.sectorFacts]
            .sort((a, b) => {
              const sector = sectorName(a.sector_id).localeCompare(sectorName(b.sector_id));
              return sector || a.sort_order - b.sort_order || a.label.localeCompare(b.label);
            })
            .map((fact) => (
              <div key={fact.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900">
                      {fact.label}: <span className="text-zinc-600">{fact.value}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {sectorName(fact.sector_id)}
                      {fact.caption ? ` · ${fact.caption}` : ""}
                      {fact.source ? ` · Source: ${fact.source}` : ""}
                    </div>
                </div>
                <form action={deleteSectorFact}>
                  <input type="hidden" name="id" value={fact.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                  >
                    Delete
                  </button>
                </form>
              </div>
            ))}
        </CardList>
      )}
    </>
  );
}

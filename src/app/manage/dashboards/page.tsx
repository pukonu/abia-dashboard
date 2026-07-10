import { DemoModeNotice, Flash } from "@/components/forms";
import RecordFormModal from "@/components/manage/RecordFormModal";
import { CardList, Crumbs, EmptyState, PageHeader, RowLink } from "@/components/ui";
import { widgetsOf } from "@/lib/dashboards";
import { loadDashboardData } from "@/lib/datasource";
import type { FieldSpec } from "@/lib/manage-config";
import { createDashboard } from "./actions";

export const metadata = { title: "Dashboards — Manage" };

export default async function ManageDashboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const data = await loadDashboardData();
  const disabled = data.mode !== "live";

  const sectorFields: FieldSpec[] = [
    { name: "sector_id", label: "Sector", type: "select", required: true, options: data.sectors.map((s) => ({ value: s.id, label: s.name })) },
    { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Primary Care at a Glance" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Shown as a hint next to the dashboard title" },
  ];
  const lgaFields: FieldSpec[] = [
    { name: "lga_id", label: "LGA", type: "select", required: true, options: data.lgas.map((l) => ({ value: l.id, label: l.name })) },
    { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Service Delivery Snapshot" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Shown as a hint next to the dashboard title" },
  ];

  const sectorName = (id: string | null) => data.sectors.find((s) => s.id === id)?.name ?? "—";
  const lgaName = (id: string | null) => data.lgas.find((l) => l.id === id)?.name ?? "—";

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Dashboards" }]} />
      <PageHeader
        eyebrow="Presentation"
        title="Dashboard builder"
        subtitle="Compose custom dashboards from the indicators you already track. Published dashboards appear on the sector or LGA page they belong to."
        actions={
          <>
            <RecordFormModal
              title="New sector dashboard"
              description="Shown on the selected sector's page."
              submitLabel="Create dashboard"
              triggerLabel="Sector dashboard"
              action={createDashboard.bind(null, "sector")}
              fields={sectorFields}
              backTo="/manage/dashboards"
              disabled={disabled}
            />
            <RecordFormModal
              title="New LGA dashboard"
              description="Shown on the selected local government's page."
              submitLabel="Create dashboard"
              triggerLabel="LGA dashboard"
              action={createDashboard.bind(null, "lga")}
              fields={lgaFields}
              backTo="/manage/dashboards"
              disabled={disabled}
            />
          </>
        }
      />
      <Flash msg={msg} err={err} />
      <DemoModeNotice show={disabled} />

      {data.dashboards.length === 0 ? (
        <EmptyState>
          No dashboards yet. Create a sector or LGA dashboard, then add chart widgets with the
          drag-and-drop builder.
        </EmptyState>
      ) : (
        <CardList>
          {data.dashboards.map((d) => {
            const widgetCount = widgetsOf(data, d.id).length;
            return (
              <RowLink
                key={d.id}
                href={`/manage/dashboards/${d.id}`}
                left={
                  <>
                    <div className="truncate text-sm font-medium text-zinc-900">{d.name}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {d.scope === "sector"
                        ? `Sector · ${sectorName(d.sector_id)}`
                        : `LGA · ${lgaName(d.lga_id)}`}
                      {" · "}
                      {widgetCount} widget{widgetCount === 1 ? "" : "s"}
                    </div>
                  </>
                }
                right={
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      d.published
                        ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-300"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {d.published ? "Published" : "Draft"}
                  </span>
                }
              />
            );
          })}
        </CardList>
      )}
    </>
  );
}

import { Eye, EyeOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoModeNotice, Flash } from "@/components/forms";
import DashboardBuilder from "@/components/manage/DashboardBuilder";
import GhostTitleField from "@/components/manage/GhostTitleField";
import { Crumbs } from "@/components/ui";
import { dashboardIndicatorData, widgetsOf } from "@/lib/dashboards";
import { loadDashboardData } from "@/lib/datasource";
import { computeDashboard } from "@/lib/scoring";
import { deleteDashboard, patchDashboard } from "../actions";

export const metadata = { title: "Dashboard builder — Manage" };

export default async function DashboardBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const { msg, err } = await searchParams;
  const data = await loadDashboardData();
  const dashboard = data.dashboards.find((d) => d.id === id);
  if (!dashboard) notFound();

  const disabled = data.mode !== "live";
  const c = computeDashboard(data);
  const widgets = widgetsOf(data, dashboard.id);
  const { options, data: indicatorData } = dashboardIndicatorData(c, dashboard);

  const target =
    dashboard.scope === "sector"
      ? data.sectors.find((s) => s.id === dashboard.sector_id)
      : data.lgas.find((l) => l.id === dashboard.lga_id);
  const viewHref =
    dashboard.scope === "sector"
      ? `/sectors/${data.sectors.find((s) => s.id === dashboard.sector_id)?.slug ?? ""}`
      : `/lgas/${dashboard.lga_id}`;
  const backTo = `/manage/dashboards/${dashboard.id}`;

  return (
    <>
      <Crumbs
        items={[
          { href: "/manage", label: "Manage" },
          { href: "/manage/dashboards", label: "Dashboards" },
          { label: dashboard.name },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 lg:hidden">
            {dashboard.scope === "sector" ? "Sector dashboard" : "LGA dashboard"} ·{" "}
            {target?.name ?? "—"}
          </div>
          <GhostTitleField
            name="name"
            label="Dashboard name"
            value={dashboard.name}
            action={patchDashboard.bind(null, dashboard.id)}
            disabled={disabled}
            backTo={backTo}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={viewHref}
            className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            View page
          </Link>
          <form action={patchDashboard.bind(null, dashboard.id)}>
            <input type="hidden" name="_back" value={backTo} />
            <input type="hidden" name="published" value={dashboard.published ? "false" : "true"} />
            <button
              type="submit"
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                dashboard.published
                  ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "bg-abia text-white hover:opacity-90"
              }`}
            >
              {dashboard.published ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} /> Unpublish
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> Publish
                </>
              )}
            </button>
          </form>
          <form action={deleteDashboard.bind(null, dashboard.id)}>
            <button
              type="submit"
              disabled={disabled}
              title="Delete dashboard"
              className="rounded-md border border-red-200 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </div>

      <Flash msg={msg} err={err} />
      <DemoModeNotice show={disabled} />
      {!dashboard.published && (
        <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          This dashboard is a <strong>draft</strong> — it is hidden from{" "}
          {dashboard.scope === "sector" ? "the sector page" : "the LGA page"} until you publish it.
        </div>
      )}

      <DashboardBuilder
        dashboardId={dashboard.id}
        widgets={widgets}
        options={options}
        data={indicatorData}
        disabled={disabled}
      />
    </>
  );
}

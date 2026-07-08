import { SectionTitle } from "@/components/ui";
import {
  dashboardIndicatorData,
  dashboardsFor,
  widgetDataSubset,
  widgetsOf,
} from "@/lib/dashboards";
import type { Computed } from "@/lib/scoring";
import DashboardWidgetChart from "./DashboardWidgetChart";

/**
 * Renders all published custom dashboards for a sector or LGA page.
 * Dashboards are built in the manage console (/manage/dashboards).
 */
export default function CustomDashboards({
  c,
  scope,
  targetId,
}: {
  c: Computed;
  scope: "sector" | "lga";
  targetId: string;
}) {
  const dashboards = dashboardsFor(c.data, scope, targetId);
  if (dashboards.length === 0) return null;

  return (
    <>
      {dashboards.map((dashboard) => {
        const widgets = widgetsOf(c.data, dashboard.id).filter(
          (w) => w.indicator_ids.length > 0
        );
        if (widgets.length === 0) return null;
        const { data } = dashboardIndicatorData(c, dashboard);
        const subset = widgetDataSubset(widgets, data);
        return (
          <section key={dashboard.id}>
            <SectionTitle hint={dashboard.description ?? undefined}>{dashboard.name}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              {widgets.map((w) => (
                <div
                  key={w.id}
                  className={`card card-pad ${w.span === 2 ? "sm:col-span-2" : ""}`}
                >
                  {w.title && (
                    <h3 className="mb-3 text-sm font-semibold text-zinc-900">{w.title}</h3>
                  )}
                  <DashboardWidgetChart
                    chartType={w.chart_type}
                    indicatorIds={w.indicator_ids}
                    data={subset}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

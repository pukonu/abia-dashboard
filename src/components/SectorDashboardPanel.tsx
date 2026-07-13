"use client";

import Link from "next/link";
import { saveResultRow } from "@/app/manage/actions";
import { IndicatorTrendChart } from "@/components/charts";
import IndicatorQuickEdit from "@/components/dashboard/IndicatorQuickEdit";
import { formatIndicatorMetric } from "@/components/indicator-result-line";
import { DeltaTag, ScoreBadge } from "@/components/score";
import { SectionTitle } from "@/components/ui";
import { dashboardIndicatorData } from "@/lib/dashboards";
import { indicatorFrequency } from "@/lib/indicator-frequency";
import { isSectorDashboardThematic, sectorDashboardThematic } from "@/lib/sector-dashboard";
import type { Computed } from "@/lib/scoring";
import type { DashboardData, Sector } from "@/lib/types";

/** Latest Sector Dashboard readings + historical line charts for a sector. */
export default function SectorDashboardPanel({
  data,
  c,
  sector,
  canEdit = false,
}: {
  data: DashboardData;
  c: Computed;
  sector: Sector;
  /** Signed-in live users can hover-edit statewide readings. */
  canEdit?: boolean;
}) {
  const theme = sectorDashboardThematic(data.thematicAreas, sector.id);
  if (!theme) return null;

  const { data: widgetData } = dashboardIndicatorData(c, {
    scope: "sector",
    sector_id: sector.id,
    lga_id: null,
  });

  const indicators = c.indicators
    .filter(
      (i) =>
        i.sector.id === sector.id &&
        i.indicator.indicator_scope !== "entity" &&
        isSectorDashboardThematic(i.thematicArea)
    )
    .sort((a, b) => a.indicator.name.localeCompare(b.indicator.name, undefined, { numeric: true }));

  const domains = data.domains
    .filter((d) => d.thematic_area_id === theme.id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((domain) => ({
      domain,
      indicators: indicators.filter((i) => i.domain.id === domain.id),
    }))
    .filter((g) => g.indicators.length > 0);

  const withData = indicators.filter((i) => i.latest != null);
  const latestAsOf = withData
    .map((i) => i.latest!.period.start_date)
    .reduce((a, b) => (b > a ? b : a), "");

  return (
    <div className="space-y-6">
      <SectionTitle
        hint={
          latestAsOf
            ? `Latest through ${new Date(latestAsOf + "T00:00:00Z").toLocaleDateString("en-NG", {
                month: "long",
                year: "numeric",
              })} · ${withData.length}/${indicators.length} reported`
            : `${indicators.length} indicators · no readings yet`
        }
      >
        Sector Dashboard
      </SectionTitle>

      {domains.map(({ domain, indicators: items }) => (
        <section key={domain.id} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">{domain.name}</h3>
            <span className="text-[11px] text-zinc-400">
              {items.filter((i) => i.latest).length}/{items.length} with latest data
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((item) => {
              const freq = indicatorFrequency(item.indicator, item.thematicArea);
              const change =
                item.latest?.abia != null && item.previous?.abia != null
                  ? item.latest.abia - item.previous.abia
                  : null;
              const trendPoints = [...item.series]
                .sort((a, b) => a.period.start_date.localeCompare(b.period.start_date))
                .map((pt) => ({
                  label: pt.period.label,
                  Abia: pt.abia,
                  Nigeria: pt.nigeria,
                }));
              const widget = widgetData[item.indicator.id];
              return (
                <article
                  key={item.indicator.id}
                  className="group relative card overflow-hidden border border-zinc-100 dark:border-zinc-800"
                >
                  {canEdit && widget ? (
                    <IndicatorQuickEdit indicator={widget} saveAction={saveResultRow} />
                  ) : null}
                  <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <div className="min-w-0 pr-16">
                      <Link
                        href={`/indicators/${item.indicator.id}`}
                        className="text-sm font-semibold text-zinc-900 hover:underline"
                      >
                        {item.indicator.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                        <span className="capitalize">{freq}</span>
                        <span>·</span>
                        <span>
                          Latest:{" "}
                          <span className="font-semibold text-zinc-700">
                            {item.latest?.period.label ?? "—"}
                          </span>
                        </span>
                        {(() => {
                          const mda = data.mdas.find((m) => m.id === item.indicator.responsible_mda_id);
                          if (!mda) return null;
                          const label = mda.abbreviation?.trim() || mda.name;
                          return (
                            <>
                              <span>·</span>
                              <span title={mda.name}>MDA: {label}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <ScoreBadge score={item.score} />
                  </div>

                  <div className="px-4 py-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="display text-2xl font-semibold tabular-nums text-zinc-950">
                          {formatIndicatorMetric(item.latest?.abia ?? null, item.indicator.unit)}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          Nigeria{" "}
                          {formatIndicatorMetric(
                            item.latest?.nigeria ?? item.domain.benchmark_nigeria ?? null,
                            item.indicator.unit
                          )}{" "}
                          · Target{" "}
                          {formatIndicatorMetric(
                            item.domain.benchmark_target ??
                              item.latest?.target ??
                              item.indicator.target_value,
                            item.indicator.unit
                          )}
                        </div>
                      </div>
                      {change != null && (
                        <DeltaTag
                          value={change}
                          suffix={`vs ${item.previous?.period.label ?? "prior"}`}
                          direction={item.indicator.direction}
                        />
                      )}
                    </div>

                    {trendPoints.length > 1 ? (
                      <div className="mt-3">
                        <IndicatorTrendChart
                          points={trendPoints}
                          target={item.latest?.target ?? item.indicator.target_value}
                          unit={item.indicator.unit}
                          height={140}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] text-zinc-400">
                        {trendPoints.length === 1
                          ? `Only ${item.latest?.period.label} reported so far — more periods will build the trend.`
                          : "No historical readings yet for this indicator."}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {indicators.length === 0 && (
        <div className="card card-pad text-sm text-zinc-500">
          No Sector Dashboard indicators configured. Add domains and indicators under{" "}
          <span className="font-semibold text-zinc-800">{theme.name}</span>.
        </div>
      )}
    </div>
  );
}

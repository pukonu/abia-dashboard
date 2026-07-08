"use client";

import {
  BarChart3,
  GripVertical,
  LayoutPanelLeft,
  Pencil,
  Plus,
  Radar,
  Search,
  Sigma,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  deleteWidgetInline,
  reorderWidgetsInline,
  saveWidgetInline,
} from "@/app/manage/dashboards/actions";
import DashboardWidgetChart from "@/components/dashboard/DashboardWidgetChart";
import { inputClass } from "@/components/forms";
import Modal from "@/components/manage/Modal";
import { CHART_TYPES, type IndicatorOption, type WidgetIndicatorDatum } from "@/lib/dashboards";
import type { DashboardChartType, DashboardWidget } from "@/lib/types";

const CHART_ICONS: Record<DashboardChartType, LucideIcon> = {
  trend: TrendingUp,
  bar: BarChart3,
  radar: Radar,
  stat: Sigma,
};

interface EditorState {
  id?: string;
  chart_type: DashboardChartType;
  title: string;
  span: number;
  indicator_ids: string[];
}

function WidgetEditorModal({
  open,
  initial,
  options,
  dashboardId,
  nextPosition,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: EditorState;
  options: IndicatorOption[];
  dashboardId: string;
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  // The modal is mounted fresh each time it opens, so state can seed from props.
  const [draft, setDraft] = useState<EditorState>(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? options.filter(
          (o) => o.name.toLowerCase().includes(q) || o.group.toLowerCase().includes(q)
        )
      : options;
    return matches.map((option, i) => ({
      option,
      showGroup: i === 0 || matches[i - 1].group !== option.group,
    }));
  }, [options, query]);

  const chartSpec = CHART_TYPES.find((t) => t.value === draft.chart_type);

  function toggleIndicator(id: string) {
    setDraft((d) => ({
      ...d,
      indicator_ids: d.indicator_ids.includes(id)
        ? d.indicator_ids.filter((x) => x !== id)
        : [...d.indicator_ids, id],
    }));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await saveWidgetInline({
      id: draft.id,
      dashboard_id: dashboardId,
      chart_type: draft.chart_type,
      title: draft.title || null,
      indicator_ids: draft.indicator_ids,
      span: draft.span,
      position: nextPosition,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? "Edit widget" : "Add widget"}
      description="Pick a chart type, then choose the indicators it should plot."
      wide
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-semibold text-zinc-700">Chart type</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CHART_TYPES.map((t) => {
              const Icon = CHART_ICONS[t.value];
              const active = draft.chart_type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, chart_type: t.value }))}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    active
                      ? "border-zinc-900 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  <div className="mt-1.5 text-xs font-semibold">{t.label}</div>
                  <div className={`mt-0.5 text-[11px] leading-snug ${active ? "text-zinc-300" : "text-zinc-400"}`}>
                    {t.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-zinc-700">Title (optional)</div>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Distance to target"
              className={inputClass}
            />
          </label>
          <div>
            <div className="mb-1 text-xs font-semibold text-zinc-700">Width</div>
            <div className="inline-flex rounded-md border border-zinc-200 p-0.5">
              {[
                { span: 1, label: "Half" },
                { span: 2, label: "Full" },
              ].map((o) => (
                <button
                  key={o.span}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, span: o.span }))}
                  className={`rounded px-4 py-1.5 text-xs font-semibold transition-colors ${
                    draft.span === o.span
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-zinc-700">
              Indicators
              <span className="ml-1.5 font-medium text-zinc-400">
                {draft.indicator_ids.length} selected
                {chartSpec && chartSpec.minIndicators > 1
                  ? ` · needs at least ${chartSpec.minIndicators}`
                  : ""}
              </span>
            </span>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" strokeWidth={1.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search indicators…"
              className={`${inputClass} pl-8`}
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-zinc-200">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-zinc-400">
                No indicators match your search.
              </div>
            )}
            {filtered.map(({ option: o, showGroup }) => (
              <div key={o.id}>
                {showGroup && (
                  <div className="sticky top-0 border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {o.group}
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-2.5 border-b border-zinc-50 px-3 py-2 text-sm text-zinc-800 transition-colors last:border-b-0 hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={draft.indicator_ids.includes(o.id)}
                    onChange={() => toggleIndicator(o.id)}
                    className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                  />
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  <span className="shrink-0 text-[11px] text-zinc-400">
                    {o.hasData ? o.unit : "no data yet"}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-800">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : draft.id ? "Save widget" : "Add widget"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Drag-and-drop dashboard builder: reorder widget cards by dragging,
 * edit them in a modal, and preview each chart with real data.
 */
export default function DashboardBuilder({
  dashboardId,
  widgets,
  options,
  data,
  disabled,
}: {
  dashboardId: string;
  widgets: DashboardWidget[];
  options: IndicatorOption[];
  data: Record<string, WidgetIndicatorDatum>;
  disabled: boolean;
}) {
  const router = useRouter();
  // Local drag order, keyed to the current widget set so it resets whenever
  // the server sends a different set of widgets.
  const widgetIdsKey = widgets.map((w) => w.id).join("|");
  const [orderState, setOrderState] = useState<{ key: string; ids: string[] } | null>(null);
  const order = orderState?.key === widgetIdsKey ? orderState.ids : null;
  const setOrder = (ids: string[] | null) =>
    setOrderState(ids ? { key: widgetIdsKey, ids } : null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const displayed = (order ?? widgets.map((w) => w.id))
    .map((id) => byId.get(id))
    .filter((w): w is DashboardWidget => Boolean(w));

  function moveDragged(overId: string) {
    if (!dragId || dragId === overId) return;
    const current = order ?? widgets.map((w) => w.id);
    const next = current.filter((id) => id !== dragId);
    next.splice(next.indexOf(overId), 0, dragId);
    setOrder(next);
  }

  async function persistOrder() {
    setDragId(null);
    if (!order) return;
    const res = await reorderWidgetsInline(dashboardId, order);
    if (!res.ok) {
      setError(res.error);
      setOrder(null);
      return;
    }
    setError(null);
    router.refresh();
  }

  async function removeWidget(id: string) {
    if (!window.confirm("Remove this widget from the dashboard?")) return;
    const res = await deleteWidgetInline(id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    router.refresh();
  }

  function openEditor(w?: DashboardWidget) {
    setEditor(
      w
        ? {
            id: w.id,
            chart_type: w.chart_type,
            title: w.title ?? "",
            span: w.span,
            indicator_ids: w.indicator_ids,
          }
        : { chart_type: "stat", title: "", span: 1, indicator_ids: [] }
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {widgets.length === 0
            ? "No widgets yet — add your first chart."
            : "Drag cards to rearrange. Changes are saved automatically."}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => openEditor()}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Add widget
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <LayoutPanelLeft className="h-6 w-6 text-zinc-300" strokeWidth={1.5} />
          <p className="max-w-sm text-sm text-zinc-500">
            Widgets are chart cards — stat tiles, trend lines, bars or radars — each plotting the
            indicators you pick.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {displayed.map((w) => {
            const chartLabel = CHART_TYPES.find((t) => t.value === w.chart_type)?.label ?? w.chart_type;
            const Icon = CHART_ICONS[w.chart_type];
            return (
              <div
                key={w.id}
                draggable={!disabled}
                onDragStart={(e) => {
                  setDragId(w.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  moveDragged(w.id);
                }}
                onDragEnd={persistOrder}
                className={`card card-pad ${w.span === 2 ? "sm:col-span-2" : ""} ${
                  dragId === w.id ? "opacity-60 ring-2 ring-zinc-300" : ""
                } ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {!disabled && (
                      <GripVertical className="h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
                    )}
                    <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" strokeWidth={1.5} />
                    <span className="truncate text-sm font-semibold text-zinc-900">
                      {w.title || chartLabel}
                    </span>
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {chartLabel}
                    </span>
                  </div>
                  {!disabled && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditor(w)}
                        title="Edit widget"
                        className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWidget(w.id)}
                        title="Remove widget"
                        className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>
                <DashboardWidgetChart
                  chartType={w.chart_type}
                  indicatorIds={w.indicator_ids}
                  data={data}
                />
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <WidgetEditorModal
          open
          initial={editor}
          options={options}
          dashboardId={dashboardId}
          nextPosition={widgets.length}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

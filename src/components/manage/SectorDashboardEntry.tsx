"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { inputClass } from "@/components/forms";

export interface EntrySector {
  id: string;
  name: string;
  slug: string;
}

export interface EntryThematic {
  id: string;
  sectorId: string;
  name: string;
  frequency: string;
  isSectorDashboard: boolean;
}

export interface EntryDomain {
  id: string;
  thematicAreaId: string;
  name: string;
}

export interface EntryIndicator {
  id: string;
  domainId: string;
  name: string;
  unit: string;
  description: string | null;
  targetValue: number | null;
}

export interface EntryPeriod {
  id: string;
  label: string;
  frequency: string;
}

export interface EntryExistingResult {
  indicatorId: string;
  timePeriodId: string;
  abiaValue: number;
  nigeriaValue: number | null;
  notes: string | null;
}

type SaveAction = (
  formData: FormData
) => Promise<{ ok: true; uploaded: number } | { ok: false; error: string }>;

const numericCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export default function SectorDashboardEntry({
  sectors,
  thematicAreas,
  domains,
  indicators,
  periods,
  existingResults,
  saveRowAction,
  disabled = false,
  initialSectorId,
}: {
  sectors: EntrySector[];
  thematicAreas: EntryThematic[];
  domains: EntryDomain[];
  indicators: EntryIndicator[];
  periods: EntryPeriod[];
  existingResults: EntryExistingResult[];
  saveRowAction: SaveAction;
  disabled?: boolean;
  initialSectorId?: string | null;
}) {
  const sectorOptions = useMemo(() => {
    const withDashboard = thematicAreas
      .filter((t) => t.isSectorDashboard)
      .map((t) => t.sectorId);
    const preferred = sectors.filter((s) => withDashboard.includes(s.id));
    return preferred.length > 0 ? preferred : sectors;
  }, [sectors, thematicAreas]);

  const [sectorId, setSectorId] = useState<string>(
    initialSectorId && sectorOptions.some((s) => s.id === initialSectorId)
      ? initialSectorId
      : sectorOptions[0]?.id ?? ""
  );

  const thematic = useMemo(
    () => thematicAreas.find((t) => t.sectorId === sectorId && t.isSectorDashboard) ?? null,
    [thematicAreas, sectorId]
  );

  const matchingPeriods = useMemo(() => {
    if (!thematic) return periods;
    const matched = periods.filter((p) => p.frequency === thematic.frequency);
    return matched.length > 0 ? matched : periods;
  }, [periods, thematic]);

  const [periodId, setPeriodId] = useState<string>(matchingPeriods[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [statusById, setStatusById] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [draftById, setDraftById] = useState<
    Record<string, { abia: string; nigeria: string; notes: string }>
  >({});

  // Keep period in sync when sector/thematic frequency changes
  const effectivePeriodId = matchingPeriods.some((p) => p.id === periodId)
    ? periodId
    : matchingPeriods[0]?.id ?? "";

  const existingByIndicator = useMemo(
    () =>
      new Map(
        existingResults
          .filter((r) => r.timePeriodId === effectivePeriodId)
          .map((r) => [r.indicatorId, r] as const)
      ),
    [existingResults, effectivePeriodId]
  );

  const groups = useMemo(() => {
    if (!thematic) return [];
    return domains
      .filter((d) => d.thematicAreaId === thematic.id)
      .sort((a, b) => numericCompare(a.name, b.name))
      .map((d) => ({
        domain: d,
        indicators: indicators
          .filter((i) => i.domainId === d.id)
          .sort((a, b) => numericCompare(a.name, b.name)),
      }))
      .filter((g) => g.indicators.length > 0);
  }, [domains, indicators, thematic]);

  const query = search.trim().toLowerCase();
  const filledCount = groups.reduce(
    (n, g) => n + g.indicators.filter((i) => existingByIndicator.has(i.id)).length,
    0
  );
  const totalCount = groups.reduce((n, g) => n + g.indicators.length, 0);

  const draftFor = (indicatorId: string) => {
    if (draftById[indicatorId]) return draftById[indicatorId];
    const existing = existingByIndicator.get(indicatorId);
    return {
      abia: existing != null ? String(existing.abiaValue) : "",
      nigeria: existing?.nigeriaValue != null ? String(existing.nigeriaValue) : "",
      notes: existing?.notes ?? "",
    };
  };

  const setDraft = (indicatorId: string, patch: Partial<{ abia: string; nigeria: string; notes: string }>) => {
    setDraftById((prev) => ({
      ...prev,
      [indicatorId]: { ...draftFor(indicatorId), ...patch },
    }));
    setStatusById((prev) => ({ ...prev, [indicatorId]: "idle" }));
  };

  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const saveRow = (indicatorId: string) => {
    const draft = draftFor(indicatorId);
    if (!draft.abia.trim()) {
      setErrorById((prev) => ({ ...prev, [indicatorId]: "Enter a value before saving." }));
      setStatusById((prev) => ({ ...prev, [indicatorId]: "error" }));
      return;
    }
    if (!effectivePeriodId) {
      setErrorById((prev) => ({ ...prev, [indicatorId]: "Pick a reporting month first." }));
      setStatusById((prev) => ({ ...prev, [indicatorId]: "error" }));
      return;
    }

    const fd = new FormData();
    fd.set("indicator_id", indicatorId);
    fd.set("time_period_id", effectivePeriodId);
    fd.set("abia_value", draft.abia.trim());
    if (draft.nigeria.trim()) fd.set("nigeria_value", draft.nigeria.trim());
    if (draft.notes.trim()) fd.set("notes", draft.notes.trim());

    setStatusById((prev) => ({ ...prev, [indicatorId]: "saving" }));
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[indicatorId];
      return next;
    });

    startTransition(async () => {
      const res = await saveRowAction(fd);
      if (!res.ok) {
        setStatusById((prev) => ({ ...prev, [indicatorId]: "error" }));
        setErrorById((prev) => ({ ...prev, [indicatorId]: res.error }));
        return;
      }
      setStatusById((prev) => ({ ...prev, [indicatorId]: "saved" }));
      router.refresh();
    });
  };

  if (sectorOptions.length === 0) {
    return (
      <div className="card card-pad text-sm text-zinc-500">
        No sectors available. Configure a sector and mark one thematic area as the Sector Dashboard first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <fieldset disabled={disabled || pending} className="disabled:opacity-60">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-700">Sector</span>
              <select
                className={inputClass}
                value={sectorId}
                onChange={(e) => {
                  setSectorId(e.target.value);
                  setDraftById({});
                  setStatusById({});
                }}
              >
                {sectorOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-700">Reporting month</span>
              <select
                className={inputClass}
                value={effectivePeriodId}
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  setDraftById({});
                  setStatusById({});
                }}
              >
                {matchingPeriods.length === 0 && <option value="">No monthly periods yet</option>}
                {matchingPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-700">Filter indicators</span>
              <input
                className={inputClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or domain…"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <div>
              Framework:{" "}
              <span className="font-semibold text-zinc-800">
                {thematic?.name ?? "No Sector Dashboard thematic area for this sector"}
              </span>
              {thematic && (
                <span className="text-zinc-400"> · {thematic.frequency} reporting</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-zinc-800">{filledCount}</span> of {totalCount} filled
              for this month
            </div>
          </div>
        </fieldset>
      </div>

      {!thematic ? (
        <div className="card card-pad text-sm text-zinc-500">
          This sector does not have a Sector Dashboard thematic area yet. Open Measurement framework →
          Thematic areas, create (or edit) one thematic area for this sector, and check{" "}
          <span className="font-semibold text-zinc-800">Sector Dashboard</span>. Only one is allowed per
          sector.
        </div>
      ) : groups.length === 0 ? (
        <div className="card card-pad text-sm text-zinc-500">
          No indicators under {thematic.name} yet.
        </div>
      ) : (
        groups.map((group) => {
          const visible = group.indicators.filter(
            (i) =>
              !query ||
              `${i.name} ${group.domain.name} ${i.description ?? ""}`.toLowerCase().includes(query)
          );
          if (visible.length === 0) return null;
          const groupFilled = visible.filter((i) => existingByIndicator.has(i.id)).length;
          return (
            <section key={group.domain.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{group.domain.name}</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {groupFilled} of {visible.length} indicators have a value this month
                  </p>
                </div>
              </div>
              <div className="divide-y divide-zinc-100">
                {visible.map((ind) => {
                  const draft = draftFor(ind.id);
                  const status = statusById[ind.id] ?? "idle";
                  const existing = existingByIndicator.has(ind.id);
                  return (
                    <div key={ind.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-zinc-900">{ind.name}</div>
                          {ind.description && (
                            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
                              {ind.description}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                            <span>Unit: {ind.unit}</span>
                            {ind.targetValue != null && <span>Target: {ind.targetValue}</span>}
                            {existing && status !== "saved" && (
                              <span className="font-medium text-emerald-700">Saved previously</span>
                            )}
                          </div>
                        </div>
                        {status === "saved" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                            <Check className="h-3 w-3" strokeWidth={2.5} /> Saved
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,140px)_minmax(0,140px)_minmax(0,1fr)_auto]">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            Abia value
                          </span>
                          <input
                            className={inputClass}
                            inputMode="decimal"
                            value={draft.abia}
                            disabled={disabled}
                            onChange={(e) => setDraft(ind.id, { abia: e.target.value })}
                            placeholder={ind.unit === "%" ? "e.g. 79.7" : "e.g. 948"}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            Nigeria (optional)
                          </span>
                          <input
                            className={inputClass}
                            inputMode="decimal"
                            value={draft.nigeria}
                            disabled={disabled}
                            onChange={(e) => setDraft(ind.id, { nigeria: e.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            Notes / source
                          </span>
                          <input
                            className={inputClass}
                            value={draft.notes}
                            disabled={disabled}
                            onChange={(e) => setDraft(ind.id, { notes: e.target.value })}
                            placeholder="Where this figure came from"
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={disabled || status === "saving"}
                            onClick={() => saveRow(ind.id)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          >
                            {status === "saving" ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
                              </>
                            ) : (
                              "Save"
                            )}
                          </button>
                        </div>
                      </div>
                      {status === "error" && errorById[ind.id] && (
                        <p className="mt-2 text-xs text-red-600">{errorById[ind.id]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

"use client";

import { Building2, Check, ChevronLeft, Landmark, Paperclip } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/forms";
import type { IndicatorScoreOption, IndicatorValueType } from "@/lib/types";

export interface WizardSector {
  id: string;
  name: string;
}

export interface WizardMda {
  id: string;
  sectorId: string;
  name: string;
  abbreviation: string;
}

export interface WizardEntity {
  id: string;
  mdaId: string;
  name: string;
  detail: string;
}

export interface WizardIndicator {
  id: string;
  domainId: string;
  name: string;
  unit: string;
  scope: "state" | "entity";
  valueType: IndicatorValueType;
  scoreOptions: IndicatorScoreOption[];
  targetLabel: string;
}

export interface WizardDomain {
  id: string;
  thematicAreaId: string;
  name: string;
}

export interface WizardThematicArea {
  id: string;
  sectorId: string;
  name: string;
  frequency: string;
}

export interface WizardPeriod {
  id: string;
  label: string;
  frequency: string;
}

type RowSaveAction = (
  formData: FormData
) => Promise<{ ok: true; uploaded: number } | { ok: false; error: string }>;

const STEPS = ["Sector & MDA", "Entity", "Data"] as const;

const numericCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function formatMetricPreview(rawValue: string, unit: string): string {
  if (!rawValue.trim()) return unit === "%" ? "xx%" : `xx ${unit}`;
  const value = Number(rawValue);
  const label = Number.isFinite(value) ? String(value) : rawValue.trim();
  return unit === "%" ? `${label}%` : `${label} ${unit}`;
}

function hasMetricPreviewValue(rawValue: string): boolean {
  return rawValue.trim().length > 0;
}

function StepDots({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-px w-5 bg-zinc-200" />}
            <button
              type="button"
              onClick={() => done && onJump(i)}
              disabled={!done}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "bg-zinc-950 text-white"
                  : done
                    ? "bg-green-50 text-green-900 hover:bg-green-100"
                    : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <span>{i + 1}</span>}
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default function ResultWizard({
  sectors,
  mdas,
  entities,
  indicators,
  domains,
  thematicAreas,
  periods,
  saveRowAction,
  disabled = false,
}: {
  sectors: WizardSector[];
  mdas: WizardMda[];
  entities: WizardEntity[];
  indicators: WizardIndicator[];
  domains: WizardDomain[];
  thematicAreas: WizardThematicArea[];
  periods: WizardPeriod[];
  saveRowAction: RowSaveAction;
  disabled?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [mdaId, setMdaId] = useState<string | null>(null);
  /** null = not chosen yet; "" = statewide; otherwise entity id */
  const [entityId, setEntityId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string>(periods[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [filledCount, setFilledCount] = useState(0);
  const [filledRowIds, setFilledRowIds] = useState<string[]>([]);
  const [openEvidenceRowIds, setOpenEvidenceRowIds] = useState<string[]>([]);

  const sector = sectors.find((s) => s.id === sectorId) ?? null;
  const mda = mdas.find((m) => m.id === mdaId) ?? null;
  const entity = entities.find((e) => e.id === entityId) ?? null;
  const statewide = entityId === "";

  const sectorMdas = useMemo(
    () => mdas.filter((m) => m.sectorId === sectorId).sort((a, b) => numericCompare(a.name, b.name)),
    [mdas, sectorId]
  );
  const mdaEntities = useMemo(
    () => entities.filter((e) => e.mdaId === mdaId).sort((a, b) => numericCompare(a.name, b.name)),
    [entities, mdaId]
  );

  /** Domains of the chosen sector, with their indicators for the chosen scope. */
  const grid = useMemo(() => {
    if (sectorId == null || entityId == null) return [];
    const scope = statewide ? "state" : "entity";
    const sectorThematicIds = new Set(thematicAreas.filter((t) => t.sectorId === sectorId).map((t) => t.id));
    const thematicById = new Map(thematicAreas.map((t) => [t.id, t]));

    return domains
      .filter((d) => sectorThematicIds.has(d.thematicAreaId))
      .sort((a, b) => numericCompare(a.name, b.name))
      .map((d) => ({
        domain: d,
        thematic: thematicById.get(d.thematicAreaId),
        indicators: indicators
          .filter((i) => i.domainId === d.id && i.scope === scope)
          .sort((a, b) => numericCompare(a.name, b.name)),
      }))
      .filter((g) => g.indicators.length > 0);
  }, [domains, indicators, thematicAreas, sectorId, entityId, statewide]);

  const gridIndicatorCount = grid.reduce((n, g) => n + g.indicators.length, 0);

  // Search only hides rows visually so already-typed values are never lost.
  const query = search.trim().toLowerCase();
  const matches = (g: { domain: WizardDomain; indicators: WizardIndicator[] }, i: WizardIndicator) =>
    !query || `${i.name} ${g.domain.name}`.toLowerCase().includes(query);
  const visibleCount = grid.reduce((n, g) => n + g.indicators.filter((i) => matches(g, i)).length, 0);

  /** Periods matching the sector's dominant frequency, falling back to all. */
  const gridPeriods = useMemo(() => {
    if (!sectorId) return periods;
    const freqs = new Set(thematicAreas.filter((t) => t.sectorId === sectorId).map((t) => t.frequency));
    const matching = periods.filter((p) => freqs.has(p.frequency));
    return matching.length > 0 ? matching : periods;
  }, [periods, thematicAreas, sectorId]);

  const summary = [
    mda ? (mda.abbreviation || mda.name) : sector?.name,
    entityId == null ? null : statewide ? "Statewide" : entity?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const resetRows = () => {
    setFilledCount(0);
    setFilledRowIds([]);
    setOpenEvidenceRowIds([]);
  };

  const setRowFilled = (indicatorId: string, hasValue: boolean) => {
    setFilledRowIds((prev) => {
      const next = hasValue ? Array.from(new Set([...prev, indicatorId])) : prev.filter((id) => id !== indicatorId);
      setFilledCount(next.length);
      return next;
    });
    if (!hasValue) {
      setOpenEvidenceRowIds((prev) => prev.filter((id) => id !== indicatorId));
    }
  };

  const toggleEvidenceRow = (indicatorId: string) => {
    setOpenEvidenceRowIds((prev) =>
      prev.includes(indicatorId) ? prev.filter((id) => id !== indicatorId) : [...prev, indicatorId]
    );
  };

  return (
    <div className="card card-pad">
      <fieldset disabled={disabled} className="disabled:opacity-60">

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <StepDots current={step} onJump={setStep} />
          {summary && <div className="w-full truncate text-xs text-zinc-500 sm:w-auto">{summary}</div>}
        </div>

        {/* Step 1 — sector & MDA */}
        {step === 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-zinc-900">Which sector and MDA is reporting?</h3>
            <p className="mb-4 text-xs text-zinc-500">Pick the sector first, then the MDA responsible for the data.</p>
            <div className="flex flex-wrap gap-2">
              {sectors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSectorId(s.id);
                    setMdaId(null);
                    setEntityId(null);
                    resetRows();
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    sectorId === s.id
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {sectorId && (
              <div className="mt-4 space-y-1.5">
                {sectorMdas.length === 0 && (
                  <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-xs text-zinc-500">
                    No MDAs configured for {sector?.name}.
                  </p>
                )}
                {sectorMdas.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMdaId(m.id);
                      setEntityId(null);
                      resetRows();
                      setStep(1);
                    }}
                    className={`w-full rounded-lg border px-4 py-2.5 text-left transition-colors ${
                      mdaId === m.id
                        ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="text-sm font-medium text-zinc-900">{m.name}</div>
                    {m.abbreviation && <div className="mt-0.5 text-xs text-zinc-500">{m.abbreviation}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2 — entity or statewide */}
        {step === 1 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-zinc-900">Who is this data for?</h3>
            <p className="mb-4 text-xs text-zinc-500">
              Report statewide figures, or pick one of {mda?.abbreviation || mda?.name}&apos;s entities.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setEntityId("");
                  resetRows();
                  setStep(2);
                }}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  statewide ? "border-zinc-950 ring-1 ring-zinc-950" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <Landmark className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">Statewide</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">State-level indicator results for Abia as a whole</span>
                </span>
              </button>
              <div className={`rounded-xl border p-4 ${entity ? "border-zinc-950 ring-1 ring-zinc-950" : "border-zinc-200"}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <Building2 className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-900">A specific entity</div>
                    <select
                      value={entityId ?? ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEntityId(e.target.value);
                          resetRows();
                          setStep(2);
                        }
                      }}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">
                        {mdaEntities.length === 0 ? "No entities under this MDA" : "Select an entity…"}
                      </option>
                      {mdaEntities.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                          {e.detail ? ` — ${e.detail}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — data grid */}
        {step === 2 && (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Enter values for{" "}
                  {statewide ? (
                    "the whole state"
                  ) : (
                    <span className="text-red-600">{entity?.name}</span>
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Fill only the indicators you have data for — empty rows are skipped.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter indicators…"
                  className={`${inputClass} w-full sm:w-52`}
                />
                <select
                  name="time_period_id"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                  required
                  className={`${inputClass} w-full sm:w-44`}
                >
                  {gridPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {gridIndicatorCount === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
                No {statewide ? "state" : "entity"}-level indicators configured for {sector?.name ?? "this sector"} yet.
              </p>
            ) : (
              <>
                <div className="space-y-4 md:hidden">
                  {grid.map((g) => (
                    <MobileSectionCards
                      key={`mobile-${g.domain.id}`}
                      group={g}
                      statewide={statewide}
                      isVisible={(i) => matches(g, i)}
                      filledRowIds={filledRowIds}
                      openEvidenceRowIds={openEvidenceRowIds}
                      onValueChange={setRowFilled}
                      onToggleEvidence={toggleEvidenceRow}
                      entityId={entityId ?? ""}
                      timePeriodId={periodId}
                      saveRowAction={saveRowAction}
                    />
                  ))}
                </div>
                <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2.5">Indicator</th>
                      <th className="w-28 px-3 py-2.5">Value</th>
                      {statewide && <th className="w-28 px-3 py-2.5">Nigeria</th>}
                      <th className="w-48 px-3 py-2.5">Notes</th>
                      <th className="w-40 px-3 py-2.5 text-right">Evidence</th>
                    </tr>
                  </thead>
                  {grid.map((g) => (
                    <SectionRows
                      key={g.domain.id}
                      group={g}
                      statewide={statewide}
                      isVisible={(i) => matches(g, i)}
                      filledRowIds={filledRowIds}
                      openEvidenceRowIds={openEvidenceRowIds}
                      onValueChange={setRowFilled}
                      onToggleEvidence={toggleEvidenceRow}
                      entityId={entityId ?? ""}
                      timePeriodId={periodId}
                      saveRowAction={saveRowAction}
                    />
                  ))}
                </table>
                </div>
                {visibleCount === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-zinc-500">
                    No indicators match “{search}” — rows you already filled are kept and will still be saved.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Back
            </button>
          ) : (
            <span />
          )}
          {step === 2 && gridIndicatorCount > 0 && (
            <div className="text-right">
              <div className="text-xs font-medium text-zinc-600">Rows save automatically when you leave them.</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">
                {filledCount > 0 ? `${filledCount} row${filledCount === 1 ? "" : "s"} currently filled` : "Start typing to save"}
              </div>
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
}

function SectionRows({
  group,
  statewide,
  isVisible,
  filledRowIds,
  openEvidenceRowIds,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  saveRowAction,
}: {
  group: { domain: WizardDomain; thematic?: WizardThematicArea; indicators: WizardIndicator[] };
  statewide: boolean;
  isVisible: (i: WizardIndicator) => boolean;
  filledRowIds: string[];
  openEvidenceRowIds: string[];
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  saveRowAction: RowSaveAction;
}) {
  const cols = statewide ? 5 : 4;
  const anyVisible = group.indicators.some(isVisible);
  return (
    <>
      <tbody className={anyVisible ? "" : "hidden"}>
        <tr className="border-b border-zinc-100 bg-zinc-50/70">
          <td colSpan={cols} className="px-4 py-2">
            <span className="text-xs font-semibold text-zinc-800">{group.domain.name}</span>
            {group.thematic && <span className="ml-2 text-[11px] text-zinc-400">{group.thematic.name}</span>}
          </td>
        </tr>
      </tbody>
      {group.indicators.map((i) => (
        <RowBlock
          key={i.id}
          indicator={i}
          statewide={statewide}
          visible={isVisible(i)}
          hasValue={filledRowIds.includes(i.id)}
          evidenceOpen={openEvidenceRowIds.includes(i.id)}
          colSpan={cols}
          onValueChange={onValueChange}
          onToggleEvidence={onToggleEvidence}
          entityId={entityId}
          timePeriodId={timePeriodId}
          saveRowAction={saveRowAction}
        />
      ))}
    </>
  );
}

function useRowSaveState({
  indicator,
  entityId,
  timePeriodId,
  saveRowAction,
}: {
  indicator: WizardIndicator;
  entityId: string;
  timePeriodId: string;
  saveRowAction: RowSaveAction;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const submitRow = (reason: "blur" | "files" | "change", force = false) => {
    if (isPending || (!dirty && !force) || !rootRef.current) return;
    const data = new FormData();
    data.set("indicator_id", indicator.id);
    data.set("time_period_id", timePeriodId);
    data.set("entity_id", entityId);

    const controls = rootRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[name]");
    for (const control of controls) {
      if (!control.name) continue;
      const mappedName = control.name.startsWith(`value_${indicator.id}`)
        ? "abia_value"
        : control.name.startsWith(`nigeria_${indicator.id}`)
          ? "nigeria_value"
          : control.name.startsWith(`notes_${indicator.id}`)
            ? "notes"
            : control.name.startsWith(`evidence_caption_${indicator.id}`)
              ? "evidence_caption"
              : control.name.startsWith(`evidence_${indicator.id}`)
                ? "evidence"
                : null;
      if (!mappedName) continue;
      if (control instanceof HTMLInputElement && control.type === "file") {
        for (const file of Array.from(control.files ?? [])) data.append(mappedName, file);
        continue;
      }
      data.set(mappedName, control.value);
    }
    if (!String(data.get("abia_value") ?? "").trim()) return;

    setStatus("saving");
    setStatusText(reason === "files" ? "Uploading…" : "Saving…");
    startTransition(async () => {
      const result = await saveRowAction(data);
      if (!result.ok) {
        setStatus("error");
        setStatusText(result.error);
        return;
      }
      setDirty(false);
      setStatus("saved");
      setStatusText(
        result.uploaded > 0
          ? `Saved with ${result.uploaded} evidence image${result.uploaded === 1 ? "" : "s"}`
          : "Saved"
      );
    });
  };

  const markDirty = () => setDirty(true);
  const clearIfEmpty = (rawValue: string) => {
    if (!rawValue.trim()) {
      setStatus("idle");
      setStatusText("");
    }
  };

  return {
    rootRef,
    status,
    statusText,
    currentValue,
    isPending,
    setCurrentValue,
    markDirty,
    clearIfEmpty,
    submitRow,
  };
}

function RowBlock({
  indicator,
  statewide,
  visible,
  hasValue,
  evidenceOpen,
  colSpan,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  saveRowAction,
}: {
  indicator: WizardIndicator;
  statewide: boolean;
  visible: boolean;
  hasValue: boolean;
  evidenceOpen: boolean;
  colSpan: number;
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  saveRowAction: RowSaveAction;
}) {
  const {
    rootRef,
    status,
    statusText,
    currentValue,
    isPending,
    setCurrentValue,
    markDirty,
    clearIfEmpty,
    submitRow,
  } = useRowSaveState({ indicator, entityId, timePeriodId, saveRowAction });

  return (
    <>
      <tbody
        ref={rootRef as React.RefObject<HTMLTableSectionElement>}
        className={visible ? "" : "hidden"}
        onBlurCapture={(event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
            submitRow("blur");
          }
        }}
      >
      <tr className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
        <td className="px-4 py-2 align-top">
          <div className="text-[13px] leading-snug text-zinc-800">{indicator.name}</div>
          <div className="mt-0.5 text-[11px] text-zinc-400">
            <span className={hasMetricPreviewValue(currentValue) ? "text-red-600" : undefined}>
              {formatMetricPreview(currentValue, indicator.unit)}
            </span>
            {indicator.targetLabel ? ` · ${indicator.targetLabel}` : ""}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          {indicator.valueType === "score" && indicator.scoreOptions.length >= 2 ? (
            <select
              name={`value_${indicator.id}`}
              defaultValue=""
              onChange={(e) => {
                onValueChange(indicator.id, e.target.value.trim() !== "");
                setCurrentValue(e.target.value);
                markDirty();
                if (!e.target.value.trim()) return clearIfEmpty(e.target.value);
                queueMicrotask(() => submitRow("change", true));
              }}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
            >
              <option value="">Select…</option>
              {indicator.scoreOptions.map((option) => (
                <option key={`${indicator.id}-${option.code ?? option.label}-${option.value}`} value={option.value}>
                  {option.code ? `${option.code}. ` : ""}
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              step="any"
              min={indicator.valueType === "percentage" ? 0 : undefined}
              max={indicator.valueType === "percentage" ? 100 : undefined}
              name={`value_${indicator.id}`}
              placeholder="—"
              onChange={(e) => {
                onValueChange(indicator.id, e.target.value.trim() !== "");
                setCurrentValue(e.target.value);
                markDirty();
                clearIfEmpty(e.target.value);
              }}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
            />
          )}
        </td>
        {statewide && (
          <td className="px-3 py-2 align-top">
            <input
              type="number"
              step="any"
              name={`nigeria_${indicator.id}`}
              placeholder="—"
              onChange={markDirty}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
            />
          </td>
        )}
        <td className="px-3 py-2 align-top">
          <input
            type="text"
            name={`notes_${indicator.id}`}
            placeholder="Optional"
            onChange={markDirty}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
          />
        </td>
        <td className="px-3 py-2 align-top text-right">
          <div className="flex flex-col items-end gap-2">
          {hasValue ? (
            <button
              type="button"
              onClick={() => onToggleEvidence(indicator.id)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <Paperclip className="h-3 w-3" strokeWidth={2} />
              {evidenceOpen ? "Hide attachment" : "Attach evidence"}
            </button>
          ) : (
            <span className="pt-1 text-[11px] text-zinc-300">Add a value first</span>
          )}
          {(status !== "idle" || isPending) && (
            <span
              className={`max-w-36 text-right text-[11px] ${
                status === "error" ? "text-red-600" : "text-zinc-400"
              }`}
            >
              {isPending ? "Saving…" : statusText}
            </span>
          )}
          </div>
        </td>
      </tr>
      {visible && hasValue && evidenceOpen && (
        <tr className="border-b border-zinc-100 bg-zinc-50/40">
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Evidence images
                </span>
                <input
                  type="file"
                  name={`evidence_${indicator.id}`}
                  accept="image/*"
                  multiple
                  onChange={() => {
                    markDirty();
                    submitRow("files", true);
                  }}
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-zinc-800"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Caption
                </span>
                <input
                  type="text"
                  name={`evidence_caption_${indicator.id}`}
                  placeholder="Optional caption"
                  onChange={markDirty}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
                />
              </label>
            </div>
          </td>
        </tr>
      )}
      </tbody>
    </>
  );
}

function MobileSectionCards({
  group,
  statewide,
  isVisible,
  filledRowIds,
  openEvidenceRowIds,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  saveRowAction,
}: {
  group: { domain: WizardDomain; thematic?: WizardThematicArea; indicators: WizardIndicator[] };
  statewide: boolean;
  isVisible: (i: WizardIndicator) => boolean;
  filledRowIds: string[];
  openEvidenceRowIds: string[];
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  saveRowAction: RowSaveAction;
}) {
  const visibleIndicators = group.indicators.filter(isVisible);
  if (visibleIndicators.length === 0) return null;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2">
        <div className="text-xs font-semibold text-zinc-800">{group.domain.name}</div>
        {group.thematic && <div className="mt-0.5 text-[11px] text-zinc-400">{group.thematic.name}</div>}
      </div>
      <div className="divide-y divide-zinc-100">
        {visibleIndicators.map((indicator) => (
          <MobileRowCard
            key={`mobile-row-${indicator.id}`}
            indicator={indicator}
            statewide={statewide}
            hasValue={filledRowIds.includes(indicator.id)}
            evidenceOpen={openEvidenceRowIds.includes(indicator.id)}
            onValueChange={onValueChange}
            onToggleEvidence={onToggleEvidence}
            entityId={entityId}
            timePeriodId={timePeriodId}
            saveRowAction={saveRowAction}
          />
        ))}
      </div>
    </section>
  );
}

function MobileRowCard({
  indicator,
  statewide,
  hasValue,
  evidenceOpen,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  saveRowAction,
}: {
  indicator: WizardIndicator;
  statewide: boolean;
  hasValue: boolean;
  evidenceOpen: boolean;
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  saveRowAction: RowSaveAction;
}) {
  const {
    rootRef,
    status,
    statusText,
    currentValue,
    isPending,
    setCurrentValue,
    markDirty,
    clearIfEmpty,
    submitRow,
  } = useRowSaveState({ indicator, entityId, timePeriodId, saveRowAction });

  return (
    <div
      ref={rootRef as React.RefObject<HTMLDivElement>}
      className="space-y-3 p-4"
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          submitRow("blur");
        }
      }}
    >
      <div>
        <div className="text-sm font-medium leading-snug text-zinc-900">{indicator.name}</div>
        <div className="mt-1 text-[11px] text-zinc-400">
          <span className={hasMetricPreviewValue(currentValue) ? "text-red-600" : undefined}>
            {formatMetricPreview(currentValue, indicator.unit)}
          </span>
          {indicator.targetLabel ? ` · ${indicator.targetLabel}` : ""}
        </div>
      </div>

      <div className={`grid gap-3 ${statewide ? "grid-cols-2" : "grid-cols-1"}`}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Value</span>
          {indicator.valueType === "score" && indicator.scoreOptions.length >= 2 ? (
            <select
              name={`value_${indicator.id}`}
              defaultValue=""
              onChange={(e) => {
                onValueChange(indicator.id, e.target.value.trim() !== "");
                setCurrentValue(e.target.value);
                markDirty();
                if (!e.target.value.trim()) return clearIfEmpty(e.target.value);
                queueMicrotask(() => submitRow("change", true));
              }}
              className={`${inputClass} w-full`}
            >
              <option value="">Select…</option>
              {indicator.scoreOptions.map((option) => (
                <option key={`${indicator.id}-m-${option.code ?? option.label}-${option.value}`} value={option.value}>
                  {option.code ? `${option.code}. ` : ""}
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              step="any"
              min={indicator.valueType === "percentage" ? 0 : undefined}
              max={indicator.valueType === "percentage" ? 100 : undefined}
              name={`value_${indicator.id}`}
              placeholder="—"
              onChange={(e) => {
                onValueChange(indicator.id, e.target.value.trim() !== "");
                setCurrentValue(e.target.value);
                markDirty();
                clearIfEmpty(e.target.value);
              }}
              className={`${inputClass} w-full`}
            />
          )}
        </label>
        {statewide && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Nigeria</span>
            <input
              type="number"
              step="any"
              name={`nigeria_${indicator.id}`}
              placeholder="—"
              onChange={markDirty}
              className={`${inputClass} w-full`}
            />
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Notes</span>
        <input
          type="text"
          name={`notes_${indicator.id}`}
          placeholder="Optional"
          onChange={markDirty}
          className={`${inputClass} w-full`}
        />
      </label>

      <div className="flex flex-wrap items-start justify-between gap-2">
        {hasValue ? (
          <button
            type="button"
            onClick={() => onToggleEvidence(indicator.id)}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <Paperclip className="h-3 w-3" strokeWidth={2} />
            {evidenceOpen ? "Hide attachment" : "Attach evidence"}
          </button>
        ) : (
          <span className="pt-1 text-[11px] text-zinc-300">Add a value first</span>
        )}
        {(status !== "idle" || isPending) && (
          <span className={`max-w-40 text-right text-[11px] ${status === "error" ? "text-red-600" : "text-zinc-400"}`}>
            {isPending ? "Saving…" : statusText}
          </span>
        )}
      </div>

      {hasValue && evidenceOpen && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
          <div className="grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Evidence images
              </span>
              <input
                type="file"
                name={`evidence_${indicator.id}`}
                accept="image/*"
                multiple
                onChange={() => {
                  markDirty();
                  submitRow("files", true);
                }}
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-zinc-800"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Caption</span>
              <input
                type="text"
                name={`evidence_caption_${indicator.id}`}
                placeholder="Optional caption"
                onChange={markDirty}
                className={`${inputClass} w-full`}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

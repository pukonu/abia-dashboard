"use client";

import { Building2, Check, ChevronLeft, Landmark, MapPin, Paperclip } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/forms";
import type { CollectedAt, IndicatorScoreOption, IndicatorValueType } from "@/lib/types";

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

export interface WizardLga {
  id: string;
  name: string;
  zone: string;
}

export interface WizardIndicator {
  id: string;
  domainId: string;
  name: string;
  unit: string;
  /** where values are captured: statewide, per LGA or per facility */
  collectedAt: CollectedAt;
  /** LGA/facility indicators that roll up can take a statewide override */
  rollsUp: boolean;
  /** e.g. "Rolled up (average) from facility records" */
  rollupHint: string;
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

export interface WizardExistingResult {
  indicatorId: string;
  timePeriodId: string;
  entityId: string | null;
  lgaId: string | null;
  overrideNote: string | null;
  abiaValue: number;
  nigeriaValue: number | null;
  notes: string | null;
  evidenceCount: number;
}

type RowSaveAction = (
  formData: FormData
) => Promise<{ ok: true; uploaded: number } | { ok: false; error: string }>;

const STEPS = ["Sector & MDA", "Who", "Data"] as const;

/** Wizard target encoding: "" statewide · "lga:<id>" an LGA return · otherwise a facility id. */
const LGA_PREFIX = "lga:";

function targetLocation(target: string): { entityId: string | null; lgaId: string | null } {
  if (!target) return { entityId: null, lgaId: null };
  if (target.startsWith(LGA_PREFIX)) return { entityId: null, lgaId: target.slice(LGA_PREFIX.length) };
  return { entityId: target, lgaId: null };
}

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
                    ? "bg-green-50 text-green-900 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-400"
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
  lgas,
  indicators,
  domains,
  thematicAreas,
  periods,
  existingResults,
  saveRowAction,
  disabled = false,
}: {
  sectors: WizardSector[];
  mdas: WizardMda[];
  entities: WizardEntity[];
  lgas: WizardLga[];
  indicators: WizardIndicator[];
  domains: WizardDomain[];
  thematicAreas: WizardThematicArea[];
  periods: WizardPeriod[];
  existingResults: WizardExistingResult[];
  saveRowAction: RowSaveAction;
  disabled?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [mdaId, setMdaId] = useState<string | null>(null);
  /** null = not chosen yet; "" = statewide; "lga:<id>" = LGA return; otherwise entity id */
  const [entityId, setEntityId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filledCount, setFilledCount] = useState(0);
  const [filledRowIds, setFilledRowIds] = useState<string[]>([]);
  const [openEvidenceRowIds, setOpenEvidenceRowIds] = useState<string[]>([]);

  const sector = sectors.find((s) => s.id === sectorId) ?? null;
  const mda = mdas.find((m) => m.id === mdaId) ?? null;
  const entity = entities.find((e) => e.id === entityId) ?? null;
  const statewide = entityId === "";
  const lgaTarget = entityId?.startsWith(LGA_PREFIX)
    ? (lgas.find((l) => `${LGA_PREFIX}${l.id}` === entityId) ?? null)
    : null;
  const targetLevel: CollectedAt | null =
    entityId == null ? null : statewide ? "state" : lgaTarget ? "lga" : "facility";
  /** a statewide row on an LGA/facility indicator is an override */
  const isOverride = (i: WizardIndicator) => statewide && i.collectedAt !== "state";

  const sectorMdas = useMemo(
    () => mdas.filter((m) => m.sectorId === sectorId).sort((a, b) => numericCompare(a.name, b.name)),
    [mdas, sectorId]
  );
  const mdaEntities = useMemo(
    () => entities.filter((e) => e.mdaId === mdaId).sort((a, b) => numericCompare(a.name, b.name)),
    [entities, mdaId]
  );

  /**
   * Domains of the chosen sector, with the indicators collected at the chosen
   * level. Statewide also lists roll-up indicators, entered as overrides.
   */
  const grid = useMemo(() => {
    if (sectorId == null || entityId == null || targetLevel == null) return [];
    const belongs = (i: WizardIndicator) =>
      i.collectedAt === targetLevel || (targetLevel === "state" && i.rollsUp);
    const sectorThematicIds = new Set(thematicAreas.filter((t) => t.sectorId === sectorId).map((t) => t.id));
    const thematicById = new Map(thematicAreas.map((t) => [t.id, t]));

    return domains
      .filter((d) => sectorThematicIds.has(d.thematicAreaId))
      .sort((a, b) => numericCompare(a.name, b.name))
      .map((d) => ({
        domain: d,
        thematic: thematicById.get(d.thematicAreaId),
        indicators: indicators
          .filter((i) => i.domainId === d.id && belongs(i))
          // statewide figures first, then overrides of rolled-up indicators
          .sort((a, b) =>
            Number(a.collectedAt !== "state") - Number(b.collectedAt !== "state") || numericCompare(a.name, b.name)
          ),
      }))
      .filter((g) => g.indicators.length > 0);
  }, [domains, indicators, thematicAreas, sectorId, entityId, targetLevel]);

  const gridIndicatorCount = grid.reduce((n, g) => n + g.indicators.length, 0);

  // Search only hides rows visually so already-typed values are never lost.
  const query = search.trim().toLowerCase();
  const matches = (g: { domain: WizardDomain; indicators: WizardIndicator[] }, i: WizardIndicator) =>
    !query || `${i.name} ${g.domain.name}`.toLowerCase().includes(query);
  const visibleCount = grid.reduce((n, g) => n + g.indicators.filter((i) => matches(g, i)).length, 0);
  const existingResultKey = entityId === "" ? "__state__" : entityId ?? "__unset__";
  const resultKey = (result: WizardExistingResult) =>
    result.entityId ?? (result.lgaId ? `${LGA_PREFIX}${result.lgaId}` : "__state__");
  const existingResultByIndicator = useMemo(
    () =>
      new Map(
        existingResults
          .filter(
            (result) =>
              result.timePeriodId === periodId &&
              resultKey(result) === existingResultKey
          )
          .map((result) => [result.indicatorId, result] as const)
      ),
    [existingResults, periodId, existingResultKey]
  );

  /** Periods matching indicator/thematic frequencies in the sector — no all-period fallback. */
  const gridPeriods = useMemo(() => {
    if (!sectorId) return [];
    const freqs = new Set(thematicAreas.filter((t) => t.sectorId === sectorId).map((t) => t.frequency));
    return periods.filter((p) => freqs.has(p.frequency));
  }, [periods, thematicAreas, sectorId]);

  const summary = [
    mda ? (mda.abbreviation || mda.name) : sector?.name,
    entityId == null ? null : statewide ? "Statewide" : lgaTarget ? `${lgaTarget.name} LGA` : entity?.name,
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
              Report statewide figures, an LGA&apos;s return, or one of {mda?.abbreviation || mda?.name}&apos;s
              facilities. Each shows only the indicators collected at that level.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
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
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Statewide figures, plus overrides for indicators normally rolled up from LGAs or facilities
                  </span>
                </span>
              </button>
              <div className={`rounded-xl border p-4 ${lgaTarget ? "border-zinc-950 ring-1 ring-zinc-950" : "border-zinc-200"}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <MapPin className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-900">An LGA return</div>
                    <select
                      value={lgaTarget ? `${LGA_PREFIX}${lgaTarget.id}` : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEntityId(e.target.value);
                          resetRows();
                          setStep(2);
                        }
                      }}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Select an LGA…</option>
                      {lgas.map((l) => (
                        <option key={l.id} value={`${LGA_PREFIX}${l.id}`}>
                          {l.name}
                          {l.zone ? ` — ${l.zone}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className={`rounded-xl border p-4 ${entity ? "border-zinc-950 ring-1 ring-zinc-950" : "border-zinc-200"}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <Building2 className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-900">A facility</div>
                    <select
                      value={entity ? entity.id : ""}
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
                        {mdaEntities.length === 0 ? "No facilities under this MDA" : "Select a facility…"}
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
                    <span className="text-red-600">{lgaTarget ? `${lgaTarget.name} LGA` : entity?.name}</span>
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
                  className={`${inputClass} w-full sm:w-52`}
                >
                  <option value="">Select reporting period…</option>
                  {gridPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.frequency})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {gridIndicatorCount === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
                No {statewide ? "statewide" : lgaTarget ? "LGA-collected" : "facility-collected"} indicators configured for{" "}
                {sector?.name ?? "this sector"} yet.
              </p>
            ) : (
              <>
                <div className="space-y-4 md:hidden">
                  {grid.map((g) => (
                    <MobileSectionCards
                      key={`mobile-${g.domain.id}`}
                      group={g}
                      statewide={statewide}
                      isOverride={isOverride}
                      isVisible={(i) => matches(g, i)}
                      filledRowIds={filledRowIds}
                      openEvidenceRowIds={openEvidenceRowIds}
                      onValueChange={setRowFilled}
                      onToggleEvidence={toggleEvidenceRow}
                      entityId={entityId ?? ""}
                      timePeriodId={periodId}
                      existingResultByIndicator={existingResultByIndicator}
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
                      isOverride={isOverride}
                      isVisible={(i) => matches(g, i)}
                      filledRowIds={filledRowIds}
                      openEvidenceRowIds={openEvidenceRowIds}
                      onValueChange={setRowFilled}
                      onToggleEvidence={toggleEvidenceRow}
                      entityId={entityId ?? ""}
                      timePeriodId={periodId}
                      existingResultByIndicator={existingResultByIndicator}
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
                {filledCount + existingResultByIndicator.size > 0
                  ? `${filledCount + existingResultByIndicator.size} row${
                      filledCount + existingResultByIndicator.size === 1 ? "" : "s"
                    } currently filled`
                  : "Start typing to save"}
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
  isOverride,
  isVisible,
  filledRowIds,
  openEvidenceRowIds,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  existingResultByIndicator,
  saveRowAction,
}: {
  group: { domain: WizardDomain; thematic?: WizardThematicArea; indicators: WizardIndicator[] };
  statewide: boolean;
  isOverride: (i: WizardIndicator) => boolean;
  isVisible: (i: WizardIndicator) => boolean;
  filledRowIds: string[];
  openEvidenceRowIds: string[];
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  existingResultByIndicator: Map<string, WizardExistingResult>;
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
          key={`${i.id}:${entityId}:${timePeriodId}`}
          indicator={i}
          statewide={statewide}
          override={isOverride(i)}
          visible={isVisible(i)}
          hasValue={filledRowIds.includes(i.id)}
          evidenceOpen={openEvidenceRowIds.includes(i.id)}
          colSpan={cols}
          onValueChange={onValueChange}
          onToggleEvidence={onToggleEvidence}
          entityId={entityId}
          timePeriodId={timePeriodId}
          existingResult={existingResultByIndicator.get(i.id) ?? null}
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
  existingResult,
  saveRowAction,
}: {
  indicator: WizardIndicator;
  entityId: string;
  timePeriodId: string;
  existingResult: WizardExistingResult | null;
  saveRowAction: RowSaveAction;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  const [currentValue, setCurrentValue] = useState(existingResult ? String(existingResult.abiaValue) : "");
  const [isPending, startTransition] = useTransition();

  const submitRow = (reason: "blur" | "files" | "change", force = false) => {
    if (isPending || (!dirty && !force) || !rootRef.current) return;
    const data = new FormData();
    data.set("indicator_id", indicator.id);
    data.set("time_period_id", timePeriodId);
    const location = targetLocation(entityId);
    data.set("entity_id", location.entityId ?? "");
    data.set("lga_id", location.lgaId ?? "");

    const controls = rootRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[name]");
    for (const control of controls) {
      if (!control.name) continue;
      const mappedName = control.name.startsWith(`value_${indicator.id}`)
        ? "abia_value"
        : control.name.startsWith(`nigeria_${indicator.id}`)
          ? "nigeria_value"
          : control.name.startsWith(`notes_${indicator.id}`)
            ? "notes"
            : control.name.startsWith(`override_${indicator.id}`)
              ? "override_note"
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
  override,
  visible,
  hasValue,
  evidenceOpen,
  colSpan,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  existingResult,
  saveRowAction,
}: {
  indicator: WizardIndicator;
  statewide: boolean;
  override: boolean;
  visible: boolean;
  hasValue: boolean;
  evidenceOpen: boolean;
  colSpan: number;
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  existingResult: WizardExistingResult | null;
  saveRowAction: RowSaveAction;
}) {
  const rowHasValue = hasValue || existingResult !== null;
  const existingEvidenceCount = existingResult?.evidenceCount ?? 0;
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
  } = useRowSaveState({ indicator, entityId, timePeriodId, existingResult, saveRowAction });

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
          {override && <OverrideTag hint={indicator.rollupHint} />}
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
              defaultValue={existingResult ? String(existingResult.abiaValue) : ""}
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
              defaultValue={existingResult ? String(existingResult.abiaValue) : ""}
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
              defaultValue={existingResult?.nigeriaValue == null ? "" : String(existingResult.nigeriaValue)}
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
            defaultValue={existingResult?.notes ?? ""}
            onChange={markDirty}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
          />
          {override && (
            <input
              type="text"
              name={`override_${indicator.id}`}
              placeholder="Override reason (required)"
              defaultValue={existingResult?.overrideNote ?? ""}
              onChange={markDirty}
              className="mt-1.5 w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm text-zinc-900 placeholder:text-amber-700/60 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200/80 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-zinc-100"
            />
          )}
        </td>
        <td className="px-3 py-2 align-top text-right">
          <div className="flex flex-col items-end gap-2">
          {existingEvidenceCount > 0 && (
            <span className="text-[11px] text-zinc-400">
              {existingEvidenceCount} attachment{existingEvidenceCount === 1 ? "" : "s"}
            </span>
          )}
          {rowHasValue ? (
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
      {visible && rowHasValue && evidenceOpen && (
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
  isOverride,
  isVisible,
  filledRowIds,
  openEvidenceRowIds,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  existingResultByIndicator,
  saveRowAction,
}: {
  group: { domain: WizardDomain; thematic?: WizardThematicArea; indicators: WizardIndicator[] };
  statewide: boolean;
  isOverride: (i: WizardIndicator) => boolean;
  isVisible: (i: WizardIndicator) => boolean;
  filledRowIds: string[];
  openEvidenceRowIds: string[];
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  existingResultByIndicator: Map<string, WizardExistingResult>;
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
            key={`mobile-row-${indicator.id}:${entityId}:${timePeriodId}`}
            indicator={indicator}
            statewide={statewide}
            override={isOverride(indicator)}
            hasValue={filledRowIds.includes(indicator.id)}
            evidenceOpen={openEvidenceRowIds.includes(indicator.id)}
            onValueChange={onValueChange}
            onToggleEvidence={onToggleEvidence}
            entityId={entityId}
            timePeriodId={timePeriodId}
            existingResult={existingResultByIndicator.get(indicator.id) ?? null}
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
  override,
  hasValue,
  evidenceOpen,
  onValueChange,
  onToggleEvidence,
  entityId,
  timePeriodId,
  existingResult,
  saveRowAction,
}: {
  indicator: WizardIndicator;
  statewide: boolean;
  override: boolean;
  hasValue: boolean;
  evidenceOpen: boolean;
  onValueChange: (indicatorId: string, hasValue: boolean) => void;
  onToggleEvidence: (indicatorId: string) => void;
  entityId: string;
  timePeriodId: string;
  existingResult: WizardExistingResult | null;
  saveRowAction: RowSaveAction;
}) {
  const rowHasValue = hasValue || existingResult !== null;
  const existingEvidenceCount = existingResult?.evidenceCount ?? 0;
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
  } = useRowSaveState({ indicator, entityId, timePeriodId, existingResult, saveRowAction });

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
        {override && <OverrideTag hint={indicator.rollupHint} />}
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
              defaultValue={existingResult ? String(existingResult.abiaValue) : ""}
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
              defaultValue={existingResult ? String(existingResult.abiaValue) : ""}
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
              defaultValue={existingResult?.nigeriaValue == null ? "" : String(existingResult.nigeriaValue)}
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
          defaultValue={existingResult?.notes ?? ""}
          onChange={markDirty}
          className={`${inputClass} w-full`}
        />
      </label>
      {override && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Override reason (required)
          </span>
          <input
            type="text"
            name={`override_${indicator.id}`}
            placeholder="e.g. LGA returns incomplete — figure from SMoH annual report"
            defaultValue={existingResult?.overrideNote ?? ""}
            onChange={markDirty}
            className={`${inputClass} w-full border-amber-300`}
          />
        </label>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          {existingEvidenceCount > 0 && (
            <div className="text-[11px] text-zinc-400">
              {existingEvidenceCount} attachment{existingEvidenceCount === 1 ? "" : "s"}
            </div>
          )}
          {rowHasValue ? (
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
        </div>
        {(status !== "idle" || isPending) && (
          <span className={`max-w-40 text-right text-[11px] ${status === "error" ? "text-red-600" : "text-zinc-400"}`}>
            {isPending ? "Saving…" : statusText}
          </span>
        )}
      </div>

      {rowHasValue && evidenceOpen && (
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

/** Marks a statewide row that overrides an LGA/facility roll-up. */
function OverrideTag({ hint }: { hint: string }) {
  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-500/40">
      Override · {hint}
    </div>
  );
}

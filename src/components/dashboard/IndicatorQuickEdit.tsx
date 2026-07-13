"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { inputClass } from "@/components/forms";
import Modal from "@/components/manage/Modal";
import type { WidgetIndicatorDatum } from "@/lib/dashboards";
import { isFrequency, reportingPeriodLabel } from "@/lib/indicator-frequency";
import { fmtValue } from "@/lib/scoring";
import type { Frequency } from "@/lib/types";
import {
  isProvisionalPeriodId,
  mondayFromIsoWeekValue,
  periodBoundsForDate,
  provisionalPeriods,
  provisionalStartDate,
  toIsoDate,
  toIsoWeekValue,
} from "@/lib/time-period";

type SaveAction = (
  formData: FormData
) => Promise<{ ok: true; uploaded: number } | { ok: false; error: string }>;

/** Newest non-null Nigeria benchmark for this indicator (across periods). */
function latestNigeriaBenchmark(indicator: WidgetIndicatorDatum): number | null {
  if (indicator.latestNigeria != null) return indicator.latestNigeria;
  for (const period of [...indicator.editPeriods].reverse()) {
    const nigeria = indicator.periodValues[period.id]?.nigeria;
    if (nigeria != null) return nigeria;
  }
  for (const pt of [...indicator.series].reverse()) {
    if (pt.nigeria != null) return pt.nigeria;
  }
  return null;
}

function readingForDate(
  indicator: WidgetIndicatorDatum,
  frequency: Frequency,
  isoDate: string
): { value: number | null; nigeria: number | null; notes: string | null } | undefined {
  const bounds = periodBoundsForDate(frequency, isoDate);
  for (const [periodId, reading] of Object.entries(indicator.periodValues)) {
    const period = indicator.editPeriods.find((p) => p.id === periodId);
    if (period?.startDate === bounds.startDate) return reading;
  }
  for (const pt of indicator.series) {
    if (!pt.periodId) continue;
    const period = indicator.editPeriods.find((p) => p.id === pt.periodId);
    if (period?.startDate === bounds.startDate) {
      return {
        value: pt.value,
        nigeria: pt.nigeria,
        notes: indicator.periodValues[pt.periodId]?.notes ?? null,
      };
    }
  }
  return undefined;
}

export default function IndicatorQuickEdit({
  indicator,
  saveAction,
}: {
  indicator: WidgetIndicatorDatum;
  saveAction: SaveAction;
}) {
  const router = useRouter();
  const frequency = isFrequency(indicator.frequency) ? indicator.frequency : "monthly";
  const isDaily = frequency === "daily";
  const isWeekly = frequency === "weekly";
  const usesCalendarInput = isDaily || isWeekly;
  const todayIso = toIsoDate(new Date());
  const currentWeekValue = toIsoWeekValue(new Date());

  const periods = useMemo(() => {
    if (usesCalendarInput) return [];
    if (indicator.editPeriods.length > 0) {
      return [...indicator.editPeriods].reverse();
    }
    return provisionalPeriods(frequency, frequency === "yearly" ? 8 : 16, todayIso);
  }, [indicator.editPeriods, frequency, usesCalendarInput, todayIso]);

  const defaultPeriodId =
    indicator.editPeriodId && periods.some((p) => p.id === indicator.editPeriodId)
      ? indicator.editPeriodId
      : (periods[0]?.id ?? "");

  const [open, setOpen] = useState(false);
  const [periodId, setPeriodId] = useState(defaultPeriodId);
  const [dailyDate, setDailyDate] = useState(todayIso);
  const [weekValue, setWeekValue] = useState(currentWeekValue);
  const [value, setValue] = useState("");
  const [nigeria, setNigeria] = useState("");
  const [editingNigeria, setEditingNigeria] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedPeriod = periods.find((p) => p.id === periodId) ?? periods[0] ?? null;
  const weeklyMonday = isWeekly ? mondayFromIsoWeekValue(weekValue) : null;
  const selectedReading = isDaily
    ? readingForDate(indicator, frequency, dailyDate)
    : isWeekly && weeklyMonday
      ? readingForDate(indicator, frequency, weeklyMonday)
      : selectedPeriod && !isProvisionalPeriodId(selectedPeriod.id)
        ? indicator.periodValues[selectedPeriod.id]
        : undefined;
  const isEmpty = (selectedReading?.value ?? indicator.latestValue) == null;
  const periodFieldLabel = reportingPeriodLabel(frequency);
  const nigeriaNumber = nigeria.trim() === "" ? null : Number(nigeria);
  const hasNigeriaValue = nigeriaNumber != null && !Number.isNaN(nigeriaNumber);

  function resolveNigeria(periodOrDateKey: string, fromReading?: { nigeria: number | null } | undefined) {
    if (fromReading?.nigeria != null) return String(fromReading.nigeria);
    const latest = latestNigeriaBenchmark(indicator);
    return latest != null ? String(latest) : "";
  }

  function loadPeriod(nextPeriodId: string) {
    setPeriodId(nextPeriodId);
    const reading = indicator.periodValues[nextPeriodId];
    setValue(reading?.value != null ? String(reading.value) : "");
    const nextNigeria = resolveNigeria(nextPeriodId, reading);
    setNigeria(nextNigeria);
    setEditingNigeria(nextNigeria.trim() === "");
    setNotes(reading?.notes ?? "");
    setError(null);
  }

  function loadDailyDate(nextDate: string) {
    setDailyDate(nextDate);
    const reading = readingForDate(indicator, frequency, nextDate);
    setValue(reading?.value != null ? String(reading.value) : "");
    const nextNigeria = resolveNigeria(nextDate, reading);
    setNigeria(nextNigeria);
    setEditingNigeria(nextNigeria.trim() === "");
    setNotes(reading?.notes ?? "");
    setError(null);
  }

  function loadWeek(nextWeek: string) {
    setWeekValue(nextWeek);
    const monday = mondayFromIsoWeekValue(nextWeek);
    if (!monday) {
      setError("Pick a valid reporting week.");
      return;
    }
    const reading = readingForDate(indicator, frequency, monday);
    setValue(reading?.value != null ? String(reading.value) : "");
    const nextNigeria = resolveNigeria(monday, reading);
    setNigeria(nextNigeria);
    setEditingNigeria(nextNigeria.trim() === "");
    setNotes(reading?.notes ?? "");
    setError(null);
  }

  function openEditor() {
    if (isDaily) {
      loadDailyDate(todayIso);
    } else if (isWeekly) {
      loadWeek(currentWeekValue);
    } else {
      const initial =
        indicator.editPeriodId && periods.some((p) => p.id === indicator.editPeriodId)
          ? indicator.editPeriodId
          : (periods[0]?.id ?? "");
      if (initial) loadPeriod(initial);
      else {
        setValue("");
        const nextNigeria = resolveNigeria("");
        setNigeria(nextNigeria);
        setEditingNigeria(nextNigeria.trim() === "");
        setNotes("");
        setError(null);
      }
    }
    setOpen(true);
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a value to save.");
      return;
    }

    const fd = new FormData();
    fd.set("indicator_id", indicator.id);
    fd.set("abia_value", trimmed);
    fd.set("period_frequency", frequency);
    if (nigeria.trim()) fd.set("nigeria_value", nigeria.trim());
    if (indicator.target != null) fd.set("target_value", String(indicator.target));
    if (notes.trim()) fd.set("notes", notes.trim());

    if (isDaily) {
      if (!dailyDate) {
        setError("Select the date this data was captured.");
        return;
      }
      fd.set("period_start_date", dailyDate);
    } else if (isWeekly) {
      const monday = mondayFromIsoWeekValue(weekValue);
      if (!monday) {
        setError("Select the week this data was captured.");
        return;
      }
      fd.set("period_start_date", monday);
    } else {
      if (!selectedPeriod) {
        setError("Select a reporting period.");
        return;
      }
      fd.set("time_period_id", selectedPeriod.id);
      const start =
        provisionalStartDate(selectedPeriod.id) ?? selectedPeriod.startDate ?? null;
      if (start) fd.set("period_start_date", start);
    }

    setError(null);
    startTransition(async () => {
      const result = await saveAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const descriptionSuffix = isDaily
    ? dailyDate
      ? ` · ${periodBoundsForDate(frequency, dailyDate).label}`
      : ""
    : isWeekly && weeklyMonday
      ? ` · ${periodBoundsForDate(frequency, weeklyMonday).label}`
      : selectedPeriod
        ? ` · ${selectedPeriod.label}`
        : "";

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white/95 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm transition-opacity hover:bg-white hover:text-zinc-950 ${
          isEmpty
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
        aria-label={`Manage data for ${indicator.name}`}
      >
        <Pencil className="h-3 w-3" strokeWidth={1.75} />
        Manage data
      </button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Manage data"
        description={`${indicator.name}${descriptionSuffix}`}
      >
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              {isDaily ? "Reporting date" : isWeekly ? "Reporting week" : periodFieldLabel}{" "}
              <span className="font-normal text-zinc-400">(required)</span>
            </label>
            {isDaily ? (
              <>
                <input
                  type="date"
                  className={inputClass}
                  value={dailyDate}
                  max={todayIso}
                  onChange={(e) => loadDailyDate(e.target.value)}
                  required
                  disabled={pending}
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Pick the calendar day this reading was captured. Past dates are allowed for
                  retrospective entry.
                </p>
              </>
            ) : isWeekly ? (
              <>
                <input
                  type="week"
                  className={inputClass}
                  value={weekValue}
                  max={currentWeekValue}
                  onChange={(e) => loadWeek(e.target.value)}
                  required
                  disabled={pending}
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Pick the ISO week this reading covers (defaults to the current week). Earlier weeks
                  are allowed for retrospective entry.
                </p>
              </>
            ) : (
              <>
                <select
                  className={inputClass}
                  value={selectedPeriod?.id ?? ""}
                  onChange={(e) => loadPeriod(e.target.value)}
                  required
                  disabled={pending || periods.length === 0}
                >
                  {periods.length === 0 && <option value="">No periods available</option>}
                  {periods.map((p) => {
                    const hasValue =
                      !isProvisionalPeriodId(p.id) &&
                      indicator.periodValues[p.id]?.value != null;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.label}
                        {hasValue ? " · saved" : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Current {frequency} period is selected by default
                  {indicator.editPeriods.length === 0
                    ? " — new periods are created automatically when you save"
                    : ""}
                  . Choose an earlier period to enter data retrospectively.
                </p>
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Abia value ({indicator.unit})
            </label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
              placeholder={fmtValue(null, indicator.unit)}
              autoFocus
              required
            />
            {indicator.target != null && (
              <p className="mt-1 text-[11px] text-zinc-400">
                Target: {fmtValue(indicator.target, indicator.unit)}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Nigeria benchmark <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            {hasNigeriaValue && !editingNigeria ? (
              <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/50">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtValue(nigeriaNumber, indicator.unit)}
                  </div>
                  <div className="text-[11px] text-zinc-500">Latest Nigeria benchmark applied</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingNigeria(true)}
                  disabled={pending}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  <Pencil className="h-3 w-3" strokeWidth={1.75} />
                  Edit
                </button>
              </div>
            ) : (
              <input
                type="number"
                step="any"
                value={nigeria}
                onChange={(e) => setNigeria(e.target.value)}
                className={inputClass}
                placeholder="Optional national comparison"
                autoFocus={editingNigeria && hasNigeriaValue}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Notes <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              rows={2}
              placeholder="Source or context for this reading"
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                pending ||
                (isDaily ? !dailyDate : isWeekly ? !weekValue : !selectedPeriod)
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />}
              Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

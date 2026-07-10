"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { inputClass } from "@/components/forms";
import Modal from "@/components/manage/Modal";
import type { WidgetIndicatorDatum } from "@/lib/dashboards";
import { fmtValue } from "@/lib/scoring";

type SaveAction = (
  formData: FormData
) => Promise<{ ok: true; uploaded: number } | { ok: false; error: string }>;

export default function IndicatorQuickEdit({
  indicator,
  saveAction,
}: {
  indicator: WidgetIndicatorDatum;
  saveAction: SaveAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    indicator.latestValue != null ? String(indicator.latestValue) : ""
  );
  const [nigeria, setNigeria] = useState(
    indicator.latestNigeria != null ? String(indicator.latestNigeria) : ""
  );
  const [notes, setNotes] = useState(indicator.latestNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!indicator.editPeriodId) return null;

  const isEmpty = indicator.latestValue == null;

  function openEditor() {
    setValue(indicator.latestValue != null ? String(indicator.latestValue) : "");
    setNigeria(indicator.latestNigeria != null ? String(indicator.latestNigeria) : "");
    setNotes(indicator.latestNotes ?? "");
    setError(null);
    setOpen(true);
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!indicator.editPeriodId) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a value to save.");
      return;
    }

    const fd = new FormData();
    fd.set("indicator_id", indicator.id);
    fd.set("time_period_id", indicator.editPeriodId);
    fd.set("abia_value", trimmed);
    if (nigeria.trim()) fd.set("nigeria_value", nigeria.trim());
    if (indicator.target != null) fd.set("target_value", String(indicator.target));
    if (notes.trim()) fd.set("notes", notes.trim());

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
        aria-label={`Edit ${indicator.name}`}
      >
        <Pencil className="h-3 w-3" strokeWidth={1.75} />
        {isEmpty ? "Add" : "Edit"}
      </button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={isEmpty ? "Add reading" : "Edit reading"}
        description={`${indicator.name} · ${indicator.editPeriodLabel ?? "latest period"}`}
      >
        <form onSubmit={onSave} className="space-y-4">
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
            <input
              type="number"
              step="any"
              value={nigeria}
              onChange={(e) => setNigeria(e.target.value)}
              className={inputClass}
            />
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
              disabled={pending}
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

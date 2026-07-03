"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/forms";
import type { FieldSpec } from "@/lib/manage-config";
import Modal from "./Modal";

export default function RecordFormModal({
  title,
  description,
  submitLabel,
  action,
  fields,
  optionsByField,
  defaultValues = {},
  backTo,
  disabled = false,
  wide = false,
  triggerLabel,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: FieldSpec[];
  optionsByField?: Record<string, Array<{ value: string; label: string }>>;
  defaultValues?: Record<string, string>;
  backTo: string;
  disabled?: boolean;
  wide?: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        {triggerLabel ?? submitLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        wide={wide}
      >
        <form
          action={action}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={() => setOpen(false)}
        >
          <input type="hidden" name="_back" value={backTo} />
          <fieldset disabled={disabled} className="contents disabled:opacity-60">
            {fields.map((f) => (
              <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <FormField
                  field={f}
                  options={optionsByField?.[f.name]}
                  defaultValue={defaultValues[f.name]}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed"
              >
                {submitLabel}
              </button>
            </div>
          </fieldset>
        </form>
      </Modal>
    </>
  );
}

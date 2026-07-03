"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { ghostInputClass } from "@/components/forms";

export default function GhostTitleField({
  name,
  label,
  value,
  action,
  disabled = false,
  backTo,
}: {
  name: string;
  label: string;
  value: string;
  action: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
  backTo: string;
}) {
  const [editing, setEditing] = useState(false);

  if (disabled) {
    return (
      <h1 className="display text-2xl font-semibold text-zinc-950 sm:text-3xl">{value}</h1>
    );
  }

  return (
    <form action={action} className="group relative max-w-3xl">
      <input type="hidden" name="_back" value={backTo} />
      <input type="hidden" name="_quiet" value="1" />
      <label className="sr-only" htmlFor={`ghost-${name}`}>
        {label}
      </label>
      <input
        id={`ghost-${name}`}
        name={name}
        defaultValue={value}
        required
        onFocus={() => setEditing(true)}
        onBlur={(e) => {
          setEditing(false);
          if (e.currentTarget.value.trim() && e.currentTarget.value !== value) {
            e.currentTarget.form?.requestSubmit();
          }
        }}
        className={`${ghostInputClass} display text-2xl font-semibold sm:text-3xl ${
          editing ? "ring-2 ring-zinc-200" : ""
        }`}
      />
      {!editing && (
        <Pencil
          className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.5}
        />
      )}
    </form>
  );
}

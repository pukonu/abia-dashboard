import type { FieldSpec } from "@/lib/manage-config";

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80";

export const ghostInputClass =
  "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-zinc-950 placeholder:text-zinc-400 transition-colors hover:border-zinc-200 hover:bg-zinc-50/80 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200/80";

export function FieldLabel({ label, required, help }: { label: string; required?: boolean; help?: string }) {
  return (
    <div className="mb-1">
      <span className="text-xs font-semibold text-zinc-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      {help && <span className="ml-2 text-[11px] text-zinc-400">{help}</span>}
    </div>
  );
}

export function FormField({
  field,
  options,
  defaultValue,
}: {
  field: FieldSpec;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  const opts = options ?? field.options ?? [];
  return (
    <label className="block">
      <FieldLabel label={field.label} required={field.required} help={field.help} />
      {field.type === "textarea" ? (
        <textarea
          name={field.name}
          rows={2}
          required={field.required}
          placeholder={field.placeholder}
          defaultValue={defaultValue}
          className={inputClass}
        />
      ) : field.type === "select" ? (
        <select
          name={field.name}
          required={field.required}
          defaultValue={defaultValue ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            Select…
          </option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : "text"}
          step={field.type === "number" ? "any" : undefined}
          name={field.name}
          required={field.required}
          placeholder={field.placeholder}
          defaultValue={defaultValue}
          className={inputClass}
        />
      )}
    </label>
  );
}

/** Success / error banner fed by ?msg= and ?err= query params. */
export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return (
    <div
      className={`mb-4 rounded-md border px-4 py-3 text-sm ${
        err
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-green-200 bg-green-50 text-green-900"
      }`}
    >
      {err ?? msg}
    </div>
  );
}

export function DemoModeNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      You are viewing <strong>demo data</strong>. Configuration and data entry write to Supabase —
      switch to <strong>Live</strong> mode (sidebar) with Supabase configured in <code>.env</code> to save.
      Forms below are disabled meanwhile.
    </div>
  );
}

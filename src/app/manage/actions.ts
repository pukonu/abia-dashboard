"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataMode } from "@/lib/data-mode";
import { getDataset } from "@/lib/manage-config";
import { ensureEvidenceBucket, evidenceBucket, getAdminClient } from "@/lib/supabase-admin";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function requireAdmin(backTo: string): Promise<SupabaseClient> {
  const mode = await getDataMode();
  if (mode !== "live") {
    redirect(`${backTo}?err=${encodeURIComponent("You are viewing demo data. Switch to Live mode (sidebar) to save real data.")}`);
  }
  const admin = getAdminClient();
  if (!admin) {
    redirect(`${backTo}?err=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY is not set in .env — writes are disabled.")}`);
  }
  return admin;
}

function fail(backTo: string, message: string): never {
  redirect(`${backTo}?err=${encodeURIComponent(message)}`);
}

function ok(backTo: string, message: string): never {
  revalidatePath("/", "layout");
  redirect(`${backTo}?msg=${encodeURIComponent(message)}`);
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

/* ------------------------------------------------------------------ */
/* Generic dataset create / delete                                     */
/* ------------------------------------------------------------------ */

export async function createRecord(slug: string, formData: FormData) {
  const backTo = `/manage/${slug}`;
  const spec = getDataset(slug);
  if (!spec) fail("/manage", "Unknown dataset.");
  const admin = await requireAdmin(backTo);

  const row: Record<string, unknown> = {};
  for (const field of spec.fields) {
    const raw = formData.get(field.name);
    const value = field.type === "number" ? numOrNull(raw) : strOrNull(raw);
    if (field.required && (value === null || value === "")) {
      fail(backTo, `${field.label} is required.`);
    }
    if (value !== null) row[field.name] = value;
  }

  const { error } = await admin.from(spec.table).insert(row);
  if (error) fail(backTo, `Could not save: ${error.message}`);
  ok(backTo, `${spec.labelSingular} saved.`);
}

export async function deleteRecord(slug: string, formData: FormData) {
  const backTo = `/manage/${slug}`;
  const spec = getDataset(slug);
  if (!spec) fail("/manage", "Unknown dataset.");
  const admin = await requireAdmin(backTo);

  const id = strOrNull(formData.get("id"));
  if (!id) fail(backTo, "Missing record id.");

  const { error } = await admin.from(spec.table).delete().eq("id", id);
  if (error) fail(backTo, `Could not delete: ${error.message}`);
  ok(backTo, `${spec.labelSingular} deleted.`);
}

/* ------------------------------------------------------------------ */
/* Result entry (with evidence images)                                 */
/* ------------------------------------------------------------------ */

async function upsertResult(
  admin: SupabaseClient,
  row: {
    indicator_id: string;
    time_period_id: string;
    entity_id: string | null;
    abia_value: number;
    nigeria_value: number | null;
    target_value: number | null;
    notes: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  // Manual upsert so state-level rows (entity_id null) match correctly.
  let query = admin
    .from("results")
    .select("id")
    .eq("indicator_id", row.indicator_id)
    .eq("time_period_id", row.time_period_id);
  query = row.entity_id ? query.eq("entity_id", row.entity_id) : query.is("entity_id", null);
  const existing = await query.maybeSingle();
  if (existing.error) return { error: existing.error.message };

  if (existing.data) {
    const { error } = await admin
      .from("results")
      .update({
        abia_value: row.abia_value,
        nigeria_value: row.nigeria_value,
        target_value: row.target_value,
        notes: row.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);
    return error ? { error: error.message } : { id: existing.data.id };
  }

  const inserted = await admin.from("results").insert(row).select("id").single();
  return inserted.error ? { error: inserted.error.message } : { id: inserted.data.id };
}

export async function saveResult(formData: FormData) {
  const backTo = "/manage/results";
  const admin = await requireAdmin(backTo);

  const indicator_id = strOrNull(formData.get("indicator_id"));
  const time_period_id = strOrNull(formData.get("time_period_id"));
  const abia_value = numOrNull(formData.get("abia_value"));
  if (!indicator_id || !time_period_id) fail(backTo, "Indicator and time period are required.");
  if (abia_value === null) fail(backTo, "Abia value is required and must be a number.");

  const saved = await upsertResult(admin, {
    indicator_id,
    time_period_id,
    entity_id: strOrNull(formData.get("entity_id")),
    abia_value,
    nigeria_value: numOrNull(formData.get("nigeria_value")),
    target_value: numOrNull(formData.get("target_value")),
    notes: strOrNull(formData.get("notes")),
  });
  if ("error" in saved) fail(backTo, `Could not save result: ${saved.error}`);

  // Evidence images (optional, multiple)
  const files = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);
  let uploaded = 0;
  if (files.length) {
    await ensureEvidenceBucket(admin);
    const caption = strOrNull(formData.get("evidence_caption"));
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        fail(backTo, `"${file.name}" is not an image — evidence must be images.`);
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${saved.id}/${Date.now()}-${safeName}`;
      const up = await admin.storage.from(evidenceBucket()).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) fail(backTo, `Result saved, but evidence upload failed: ${up.error.message}`);
      const ins = await admin.from("result_evidence").insert({
        result_id: saved.id,
        storage_path: path,
        caption,
      });
      if (ins.error) fail(backTo, `Result saved, but evidence record failed: ${ins.error.message}`);
      uploaded++;
    }
  }

  ok(backTo, `Result saved${uploaded ? ` with ${uploaded} evidence image${uploaded === 1 ? "" : "s"}` : ""}.`);
}

/* ------------------------------------------------------------------ */
/* CSV import                                                          */
/* ------------------------------------------------------------------ */

/** Minimal CSV parser handling quoted fields, commas and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function importResultsCsv(formData: FormData) {
  const backTo = "/manage/results";
  const admin = await requireAdmin(backTo);

  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) fail(backTo, "Choose a CSV file to upload.");

  const rows = parseCsv(await file.text());
  if (rows.length < 2) fail(backTo, "The CSV has no data rows.");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const required = ["indicator_id", "time_period_id", "abia_value"];
  for (const r of required) {
    if (col(r) === -1) fail(backTo, `The CSV is missing the required "${r}" column. Download the template and try again.`);
  }

  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const [idx, cells] of rows.slice(1).entries()) {
    const get = (name: string) => {
      const i = col(name);
      return i === -1 ? "" : (cells[i] ?? "").trim();
    };
    const abiaRaw = get("abia_value");
    if (!abiaRaw) {
      skipped++;
      continue; // template rows left blank
    }
    const abia = Number(abiaRaw);
    if (!Number.isFinite(abia)) {
      errors.push(`Row ${idx + 2}: abia_value "${abiaRaw}" is not a number`);
      continue;
    }
    const result = await upsertResult(admin, {
      indicator_id: get("indicator_id"),
      time_period_id: get("time_period_id"),
      entity_id: get("entity_id") || null,
      abia_value: abia,
      nigeria_value: get("nigeria_value") ? Number(get("nigeria_value")) : null,
      target_value: get("target_value") ? Number(get("target_value")) : null,
      notes: get("notes") || null,
    });
    if ("error" in result) {
      errors.push(`Row ${idx + 2}: ${result.error}`);
    } else {
      saved++;
    }
    if (errors.length >= 5) break;
  }

  if (errors.length) {
    fail(backTo, `Imported ${saved} result${saved === 1 ? "" : "s"}, but hit errors: ${errors.join("; ")}`);
  }
  ok(backTo, `Imported ${saved} result${saved === 1 ? "" : "s"} from CSV${skipped ? ` (${skipped} blank rows skipped)` : ""}.`);
}

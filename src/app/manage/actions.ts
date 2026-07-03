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
  const url = message ? `${backTo}?msg=${encodeURIComponent(message)}` : backTo;
  redirect(url);
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

function normalizeIndicatorRow(backTo: string, row: Record<string, unknown>, id?: string) {
  const scope = row.indicator_scope;
  if (scope === "entity") {
    if (!row.state_indicator_id) fail(backTo, "Entity-level indicators must select a state-level indicator to roll up into.");
    if (id && row.state_indicator_id === id) fail(backTo, "An indicator cannot roll up into itself.");
  } else {
    row.state_indicator_id = null;
  }
}

/** Optional `_back` field lets detail-page forms return to the tab they came from. */
function resolveBack(formData: FormData, fallback: string): string {
  const b = strOrNull(formData.get("_back"));
  return b && b.startsWith("/manage") ? b : fallback;
}

/* ------------------------------------------------------------------ */
/* Generic dataset create / delete                                     */
/* ------------------------------------------------------------------ */

export async function createRecord(slug: string, formData: FormData) {
  const backTo = resolveBack(formData, `/manage/${slug}`);
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
  if (slug === "indicators") normalizeIndicatorRow(backTo, row);

  const { error } = await admin.from(spec.table).insert(row);
  if (error) fail(backTo, `Could not save: ${error.message}`);
  ok(backTo, `${spec.labelSingular} saved.`);
}

export async function deleteRecord(slug: string, formData: FormData) {
  const backTo = resolveBack(formData, `/manage/${slug}`);
  const spec = getDataset(slug);
  if (!spec) fail("/manage", "Unknown dataset.");
  const admin = await requireAdmin(backTo);

  const id = strOrNull(formData.get("id"));
  if (!id) fail(backTo, "Missing record id.");

  const { error } = await admin.from(spec.table).delete().eq("id", id);
  if (error) fail(backTo, `Could not delete: ${error.message}`);
  ok(backTo, `${spec.labelSingular} deleted.`);
}

export async function updateRecord(slug: string, id: string, formData: FormData) {
  const backTo = resolveBack(formData, `/manage/${slug}/${id}`);
  const spec = getDataset(slug);
  if (!spec) fail("/manage", "Unknown dataset.");
  const admin = await requireAdmin(backTo);

  const row: Record<string, unknown> = {};
  for (const field of spec.fields) {
    const raw = formData.get(field.name);
    const value = field.type === "number" ? numOrNull(raw) : strOrNull(raw);
    if (field.required && value === null) {
      fail(backTo, `${field.label} is required.`);
    }
    row[field.name] = value;
  }
  if (slug === "indicators") normalizeIndicatorRow(backTo, row, id);

  const { error } = await admin.from(spec.table).update(row).eq("id", id);
  if (error) fail(backTo, `Could not save: ${error.message}`);
  const quiet = formData.get("_quiet") === "1";
  ok(backTo, quiet ? "" : `${spec.labelSingular} updated.`);
}

/** Partial update — only fields present in the submitted form are written. */
export async function patchRecord(slug: string, id: string, formData: FormData) {
  const backTo = resolveBack(formData, `/manage/${slug}/${id}`);
  const spec = getDataset(slug);
  if (!spec) fail("/manage", "Unknown dataset.");
  const admin = await requireAdmin(backTo);

  const row: Record<string, unknown> = {};
  for (const field of spec.fields) {
    if (!formData.has(field.name)) continue;
    const raw = formData.get(field.name);
    const value = field.type === "number" ? numOrNull(raw) : strOrNull(raw);
    if (field.required && (value === null || value === "")) {
      fail(backTo, `${field.label} is required.`);
    }
    row[field.name] = value;
  }

  if (Object.keys(row).length === 0) return;

  const { error } = await admin.from(spec.table).update(row).eq("id", id);
  if (error) fail(backTo, `Could not save: ${error.message}`);
  const quiet = formData.get("_quiet") === "1";
  ok(backTo, quiet ? "" : `${spec.labelSingular} updated.`);
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

async function cascadeStateResultFromEntity(
  admin: SupabaseClient,
  indicatorId: string,
  timePeriodId: string
): Promise<{ error?: string }> {
  const child = await admin
    .from("indicators")
    .select("id, indicator_scope, state_indicator_id")
    .eq("id", indicatorId)
    .single();
  if (child.error) return { error: child.error.message };
  if (child.data.indicator_scope !== "entity" || !child.data.state_indicator_id) return {};

  const siblings = await admin
    .from("indicators")
    .select("id, weight")
    .eq("state_indicator_id", child.data.state_indicator_id);
  if (siblings.error) return { error: siblings.error.message };
  const childIndicators = siblings.data ?? [];
  if (childIndicators.length === 0) return {};

  const results = await admin
    .from("results")
    .select("indicator_id, abia_value, entity_id")
    .eq("time_period_id", timePeriodId)
    .in("indicator_id", childIndicators.map((i) => i.id))
    .not("entity_id", "is", null);
  if (results.error) return { error: results.error.message };

  const weightByIndicator = new Map(childIndicators.map((i) => [i.id, Number(i.weight ?? 1)]));
  let sum = 0;
  let wsum = 0;
  for (const r of results.data ?? []) {
    const weight = weightByIndicator.get(r.indicator_id) ?? 1;
    const value = Number(r.abia_value);
    if (!Number.isFinite(value)) continue;
    sum += value * weight;
    wsum += weight;
  }
  if (wsum <= 0) return {};

  const aggregate = Math.round((sum / wsum) * 100) / 100;
  const saved = await upsertResult(admin, {
    indicator_id: child.data.state_indicator_id,
    time_period_id: timePeriodId,
    entity_id: null,
    abia_value: aggregate,
    nigeria_value: null,
    target_value: null,
    notes: "Auto-aggregated from linked entity-level indicator results.",
  });
  return "error" in saved ? { error: saved.error } : {};
}

export async function saveResult(formData: FormData) {
  const backTo = "/manage/results";
  const admin = await requireAdmin(backTo);

  const indicator_id = strOrNull(formData.get("indicator_id"));
  const time_period_id = strOrNull(formData.get("time_period_id"));
  const entity_id = strOrNull(formData.get("entity_id"));
  const abia_value = numOrNull(formData.get("abia_value"));
  if (!indicator_id || !time_period_id) fail(backTo, "Indicator and time period are required.");
  if (abia_value === null) fail(backTo, "Abia value is required and must be a number.");

  const indicator = await admin
    .from("indicators")
    .select("id, indicator_scope")
    .eq("id", indicator_id)
    .single();
  if (indicator.error) fail(backTo, `Could not load indicator: ${indicator.error.message}`);
  if (indicator.data.indicator_scope === "entity" && !entity_id) {
    fail(backTo, "Entity-level indicators require an entity.");
  }
  if (indicator.data.indicator_scope !== "entity" && entity_id) {
    fail(backTo, "State-level indicators must be saved without an entity.");
  }

  const saved = await upsertResult(admin, {
    indicator_id,
    time_period_id,
    entity_id,
    abia_value,
    nigeria_value: numOrNull(formData.get("nigeria_value")),
    target_value: numOrNull(formData.get("target_value")),
    notes: strOrNull(formData.get("notes")),
  });
  if ("error" in saved) fail(backTo, `Could not save result: ${saved.error}`);
  if (indicator.data.indicator_scope === "entity") {
    const cascade = await cascadeStateResultFromEntity(admin, indicator_id, time_period_id);
    if (cascade.error) fail(backTo, `Result saved, but state rollup failed: ${cascade.error}`);
  }

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

/**
 * Batch entry from the wizard grid: one value/notes pair per indicator,
 * posted as `value_<indicatorId>` / `nigeria_<indicatorId>` / `notes_<indicatorId>`.
 */
export async function saveResultsBatch(formData: FormData) {
  const backTo = "/manage/results";
  const admin = await requireAdmin(backTo);

  const time_period_id = strOrNull(formData.get("time_period_id"));
  const entity_id = strOrNull(formData.get("entity_id"));
  if (!time_period_id) fail(backTo, "A reporting period is required.");

  const rows: Array<{ indicatorId: string; value: number; nigeria: number | null; notes: string | null }> = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("value_") || typeof raw !== "string") continue;
    const indicatorId = key.slice("value_".length);
    const value = numOrNull(raw);
    if (value === null) continue;
    rows.push({
      indicatorId,
      value,
      nigeria: numOrNull(formData.get(`nigeria_${indicatorId}`)),
      notes: strOrNull(formData.get(`notes_${indicatorId}`)),
    });
  }
  if (rows.length === 0) fail(backTo, "Fill at least one indicator value before saving.");

  const indicators = await admin
    .from("indicators")
    .select("id, indicator_scope")
    .in("id", rows.map((r) => r.indicatorId));
  if (indicators.error) fail(backTo, `Could not load indicators: ${indicators.error.message}`);
  const scopeById = new Map(indicators.data.map((i) => [i.id, i.indicator_scope]));

  let saved = 0;
  const cascadeIds = new Set<string>();
  for (const row of rows) {
    const scope = scopeById.get(row.indicatorId);
    if (!scope) fail(backTo, "One of the submitted indicators no longer exists.");
    if (scope === "entity" && !entity_id) fail(backTo, "Entity-level indicators require an entity.");
    if (scope !== "entity" && entity_id) fail(backTo, "State-level indicators must be saved without an entity.");

    const result = await upsertResult(admin, {
      indicator_id: row.indicatorId,
      time_period_id,
      entity_id,
      abia_value: row.value,
      nigeria_value: row.nigeria,
      target_value: null,
      notes: row.notes,
    });
    if ("error" in result) {
      fail(backTo, `Saved ${saved} result${saved === 1 ? "" : "s"}, then failed: ${result.error}`);
    }
    saved++;
    if (scope === "entity") cascadeIds.add(row.indicatorId);
  }

  for (const indicatorId of cascadeIds) {
    const cascade = await cascadeStateResultFromEntity(admin, indicatorId, time_period_id);
    if (cascade.error) fail(backTo, `Results saved, but state rollup failed: ${cascade.error}`);
  }

  ok(backTo, `Saved ${saved} result${saved === 1 ? "" : "s"}.`);
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
    const indicatorId = get("indicator_id");
    const entityId = get("entity_id") || null;
    const indicator = await admin
      .from("indicators")
      .select("indicator_scope")
      .eq("id", indicatorId)
      .single();
    if (indicator.error) {
      errors.push(`Row ${idx + 2}: could not load indicator "${indicatorId}"`);
      continue;
    }
    if (indicator.data.indicator_scope === "entity" && !entityId) {
      errors.push(`Row ${idx + 2}: entity-level indicators require entity_id`);
      continue;
    }
    if (indicator.data.indicator_scope !== "entity" && entityId) {
      errors.push(`Row ${idx + 2}: state-level indicators must leave entity_id blank`);
      continue;
    }

    const result = await upsertResult(admin, {
      indicator_id: indicatorId,
      time_period_id: get("time_period_id"),
      entity_id: entityId,
      abia_value: abia,
      nigeria_value: get("nigeria_value") ? Number(get("nigeria_value")) : null,
      target_value: get("target_value") ? Number(get("target_value")) : null,
      notes: get("notes") || null,
    });
    if ("error" in result) {
      errors.push(`Row ${idx + 2}: ${result.error}`);
    } else {
      if (indicator.data.indicator_scope === "entity") {
        const cascade = await cascadeStateResultFromEntity(admin, indicatorId, get("time_period_id"));
        if (cascade.error) {
          errors.push(`Row ${idx + 2}: state rollup failed (${cascade.error})`);
        }
      }
      saved++;
    }
    if (errors.length >= 5) break;
  }

  if (errors.length) {
    fail(backTo, `Imported ${saved} result${saved === 1 ? "" : "s"}, but hit errors: ${errors.join("; ")}`);
  }
  ok(backTo, `Imported ${saved} result${saved === 1 ? "" : "s"} from CSV${skipped ? ` (${skipped} blank rows skipped)` : ""}.`);
}

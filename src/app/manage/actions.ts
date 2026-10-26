"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataMode } from "@/lib/data-mode";
import { collectedAt, resultLocationError } from "@/lib/indicator-collection";
import { isFrequency } from "@/lib/indicator-frequency";
import {
  normalizeIndicatorValueType,
  parseLegacyScoreOptions,
  parseScoreOptionsText,
  resolveIndicatorScoreOptions,
} from "@/lib/indicator-input";
import { getDataset } from "@/lib/manage-config";
import { getServerUser } from "@/lib/supabase-auth";
import { ensureEvidenceBucket, evidenceBucket, getAdminClient } from "@/lib/supabase-admin";
import type { CollectedAt, Frequency } from "@/lib/types";
import { isProvisionalPeriodId, periodBoundsForDate, provisionalStartDate } from "@/lib/time-period";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function requireAdmin(backTo: string): Promise<SupabaseClient> {
  const user = await getServerUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(backTo)}`);
  }
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

async function getInlineAdmin(): Promise<{ admin?: SupabaseClient; error?: string }> {
  const user = await getServerUser();
  if (!user) {
    return { error: "Please sign in to manage data." };
  }
  const mode = await getDataMode();
  if (mode !== "live") {
    return { error: "You are viewing demo data. Switch to Live mode to save real data." };
  }
  const admin = getAdminClient();
  if (!admin) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env — writes are disabled." };
  }
  return { admin };
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

/** Parses "100, 50" into [100, 50]; empty → null. */
function parseCountValues(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw.length ? raw.map(Number) : null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const values = raw
    .split(/[,;\s]+/)
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
  return values.length ? values : null;
}

/** Collection-level columns: defaults, and count settings only for count roll-ups. */
function normalizeCollectionSettings(row: Record<string, unknown>) {
  // indicator_scope / state_indicator_id are derived by a database trigger.
  delete row.indicator_scope;
  delete row.state_indicator_id;
  if ("collected_at" in row && !row.collected_at) row.collected_at = "state";
  if ("rollup_method" in row && !row.rollup_method) row.rollup_method = "average";
  if ("count_values" in row) row.count_values = parseCountValues(row.count_values);
  if ("rollup_method" in row && row.rollup_method !== "count") {
    row.count_operator = null;
    row.count_threshold = null;
    row.count_values = null;
  }
}

function normalizeIndicatorRow(backTo: string, row: Record<string, unknown>) {
  normalizeCollectionSettings(row);

   const valueType = row.value_type;
   if (valueType === "score") {
    const structured =
      parseScoreOptionsText(typeof row.score_options === "string" ? row.score_options : null) ??
      parseLegacyScoreOptions(typeof row.description === "string" ? row.description : null);
    if (!structured) {
      fail(
        backTo,
        "Score-type indicators need at least two score options, e.g. 'Yes = 100' and 'No = 0'."
      );
    }
    row.score_options = structured;
  } else {
    row.score_options = null;
  }
}

function indicatorValueError(
  indicator: { name?: string | null; value_type?: string | null; score_options?: unknown; description?: string | null; unit?: string | null },
  value: number
): string | null {
  const valueType = normalizeIndicatorValueType({
    value_type: indicator.value_type as never,
    score_options: indicator.score_options as never,
    description: indicator.description ?? null,
    unit: indicator.unit ?? undefined,
  });
  if (valueType === "percentage" && (value < 0 || value > 100)) {
    return `${indicator.name ?? "Percentage indicator"} must be between 0 and 100.`;
  }
  if (valueType === "score") {
    const options = resolveIndicatorScoreOptions({
      score_options: indicator.score_options as never,
      description: indicator.description ?? null,
    });
    if (options?.length) {
      const allowed = new Set(options.map((option) => option.value));
      if (!allowed.has(value)) {
        return `${indicator.name ?? "Score indicator"} must use one of its configured option scores.`;
      }
    }
  }
  return null;
}

function validateIndicatorValue(
  backTo: string,
  indicator: { name?: string | null; value_type?: string | null; score_options?: unknown; description?: string | null; unit?: string | null },
  value: number
) {
  const error = indicatorValueError(indicator, value);
  if (error) fail(backTo, error);
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
    if (field.type === "checkbox") {
      row[field.name] = formData.get(field.name) === "true" || formData.get(field.name) === "on";
      continue;
    }
    const raw = formData.get(field.name);
    const value = field.type === "number" ? numOrNull(raw) : strOrNull(raw);
    if (field.required && (value === null || value === "")) {
      fail(backTo, `${field.label} is required.`);
    }
    if (value !== null) row[field.name] = value;
  }
  if (slug === "indicators") normalizeIndicatorRow(backTo, row);
  if (slug === "thematic-areas") await clearOtherSectorDashboards(admin, row, null);

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
    if (field.type === "checkbox") {
      row[field.name] = formData.get(field.name) === "true" || formData.get(field.name) === "on";
      continue;
    }
    const raw = formData.get(field.name);
    const value = field.type === "number" ? numOrNull(raw) : strOrNull(raw);
    if (field.required && value === null) {
      fail(backTo, `${field.label} is required.`);
    }
    row[field.name] = value;
  }
  if (slug === "indicators") normalizeIndicatorRow(backTo, row);
  if (slug === "thematic-areas") await clearOtherSectorDashboards(admin, row, id);

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
    // Unchecked checkboxes omit the key from FormData — treat as false when the
    // field is part of a full settings form that includes the checkbox control.
    if (field.type === "checkbox") {
      if (!formData.has(field.name) && !formData.has(`_has_${field.name}`)) continue;
      row[field.name] = formData.get(field.name) === "true" || formData.get(field.name) === "on";
      continue;
    }
    if (!formData.has(field.name)) continue;
    const raw = formData.get(field.name);
    const value = field.type === "number" ? numOrNull(raw) : strOrNull(raw);
    if (field.required && (value === null || value === "")) {
      fail(backTo, `${field.label} is required.`);
    }
    row[field.name] = value;
  }

  if (Object.keys(row).length === 0) return;
  if (slug === "indicators") normalizeCollectionSettings(row);
  if (slug === "thematic-areas") await clearOtherSectorDashboards(admin, row, id);

  const { error } = await admin.from(spec.table).update(row).eq("id", id);
  if (error) fail(backTo, `Could not save: ${error.message}`);
  const quiet = formData.get("_quiet") === "1";
  ok(backTo, quiet ? "" : `${spec.labelSingular} updated.`);
}

/**
 * Enforce one sector-dashboard thematic area per sector: when marking a row,
 * clear the flag on any other thematic area in the same sector.
 */
async function clearOtherSectorDashboards(
  admin: SupabaseClient,
  row: Record<string, unknown>,
  currentId: string | null
) {
  if (row.is_sector_dashboard !== true) return;
  const sectorId = typeof row.sector_id === "string" ? row.sector_id : null;
  if (!sectorId) return;

  let query = admin
    .from("thematic_areas")
    .update({ is_sector_dashboard: false })
    .eq("sector_id", sectorId)
    .eq("is_sector_dashboard", true);
  if (currentId) query = query.neq("id", currentId);
  await query;
}

/* ------------------------------------------------------------------ */
/* Result entry (with evidence images)                                 */
/* ------------------------------------------------------------------ */

/**
 * Ensures the chosen time period matches the indicator's reporting frequency
 * (explicit on the indicator, otherwise inherited from its thematic area).
 */
async function assertPeriodMatchesIndicatorFrequency(
  admin: SupabaseClient,
  indicatorId: string,
  timePeriodId: string
): Promise<string | null> {
  const [indicatorRes, periodRes] = await Promise.all([
    admin
      .from("indicators")
      .select("id, frequency, domain_id, domains(thematic_area_id, thematic_areas(frequency))")
      .eq("id", indicatorId)
      .single(),
    admin.from("time_periods").select("id, frequency, label").eq("id", timePeriodId).single(),
  ]);
  if (indicatorRes.error) return `Could not load indicator: ${indicatorRes.error.message}`;
  if (periodRes.error) return `Could not load time period: ${periodRes.error.message}`;

  const domains = indicatorRes.data.domains as
    | { thematic_areas?: { frequency?: string } | null }
    | { thematic_areas?: { frequency?: string } | null }[]
    | null;
  const domain = Array.isArray(domains) ? domains[0] : domains;
  const thematicFrequency = domain?.thematic_areas?.frequency;
  const expected = isFrequency(indicatorRes.data.frequency)
    ? indicatorRes.data.frequency
    : isFrequency(thematicFrequency)
      ? thematicFrequency
      : "monthly";
  if (periodRes.data.frequency !== expected) {
    return `Pick a ${expected} period for this indicator (selected “${periodRes.data.label}” is ${periodRes.data.frequency}).`;
  }
  return null;
}

async function ensurePeriodRow(
  admin: SupabaseClient,
  frequency: Frequency,
  isoDate: string
): Promise<{ id: string; label: string } | { error: string }> {
  const bounds = periodBoundsForDate(frequency, isoDate);
  const existing = await admin
    .from("time_periods")
    .select("id, label")
    .eq("frequency", frequency)
    .eq("start_date", bounds.startDate)
    .maybeSingle();
  if (existing.error) return { error: existing.error.message };
  if (existing.data) return { id: existing.data.id, label: existing.data.label };

  const inserted = await admin
    .from("time_periods")
    .insert({
      frequency,
      label: bounds.label,
      start_date: bounds.startDate,
      end_date: bounds.endDate,
    })
    .select("id, label")
    .single();
  if (inserted.error) {
    // Race: another writer may have created the same (frequency, start_date).
    const again = await admin
      .from("time_periods")
      .select("id, label")
      .eq("frequency", frequency)
      .eq("start_date", bounds.startDate)
      .maybeSingle();
    if (again.data) return { id: again.data.id, label: again.data.label };
    return { error: inserted.error.message };
  }
  return { id: inserted.data.id, label: inserted.data.label };
}

/**
 * Create (or reuse) a time period for a frequency + calendar date.
 * Used by daily date-picker entry and when provisional weekly/monthly slots are chosen.
 */
export async function ensureReportingPeriod(
  formData: FormData
): Promise<{ ok: true; id: string; label: string } | { ok: false; error: string }> {
  const inline = await getInlineAdmin();
  if (!inline.admin) return { ok: false, error: inline.error ?? "Writes are disabled." };
  const frequencyRaw = strOrNull(formData.get("frequency"));
  const startDate = strOrNull(formData.get("start_date"));
  if (!isFrequency(frequencyRaw)) return { ok: false, error: "A valid reporting frequency is required." };
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: "A valid reporting date (YYYY-MM-DD) is required." };
  }
  const ensured = await ensurePeriodRow(inline.admin, frequencyRaw, startDate);
  if ("error" in ensured) return { ok: false, error: ensured.error };
  revalidatePath("/", "layout");
  return { ok: true, id: ensured.id, label: ensured.label };
}

async function resolveTimePeriodId(
  admin: SupabaseClient,
  formData: FormData,
  indicatorId: string
): Promise<{ id: string } | { error: string }> {
  const timePeriodId = strOrNull(formData.get("time_period_id"));
  const periodStart = strOrNull(formData.get("period_start_date"));
  const periodFrequencyRaw = strOrNull(formData.get("period_frequency"));

  if (timePeriodId && isProvisionalPeriodId(timePeriodId)) {
    const start = provisionalStartDate(timePeriodId) ?? periodStart;
    if (!start || !isFrequency(periodFrequencyRaw)) {
      return { error: "Could not resolve the selected reporting period." };
    }
    const ensured = await ensurePeriodRow(admin, periodFrequencyRaw, start);
    if ("error" in ensured) return { error: ensured.error };
    return { id: ensured.id };
  }

  if (!timePeriodId && periodStart && isFrequency(periodFrequencyRaw)) {
    const ensured = await ensurePeriodRow(admin, periodFrequencyRaw, periodStart);
    if ("error" in ensured) return { error: ensured.error };
    return { id: ensured.id };
  }

  if (!timePeriodId) return { error: "Indicator and time period are required." };

  const mismatch = await assertPeriodMatchesIndicatorFrequency(admin, indicatorId, timePeriodId);
  if (mismatch) return { error: mismatch };
  return { id: timePeriodId };
}

interface ResultRow {
  indicator_id: string;
  time_period_id: string;
  /** set for facility records */
  entity_id: string | null;
  /** set for LGA returns */
  lga_id: string | null;
  abia_value: number;
  nigeria_value: number | null;
  target_value: number | null;
  notes: string | null;
  entered_by: string | null;
  /** required for statewide overrides of LGA/facility-collected indicators */
  override_note: string | null;
}

async function upsertResult(
  admin: SupabaseClient,
  row: ResultRow
): Promise<{ id: string } | { error: string }> {
  // One row per indicator, period and location (statewide, LGA or facility).
  let query = admin
    .from("results")
    .select("id")
    .eq("indicator_id", row.indicator_id)
    .eq("time_period_id", row.time_period_id);
  query = row.entity_id ? query.eq("entity_id", row.entity_id) : query.is("entity_id", null);
  query = row.lga_id ? query.eq("lga_id", row.lga_id) : query.is("lga_id", null);
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
        entered_by: row.entered_by,
        override_note: row.override_note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);
    return error ? { error: error.message } : { id: existing.data.id };
  }

  const inserted = await admin.from("results").insert(row).select("id").single();
  return inserted.error ? { error: inserted.error.message } : { id: inserted.data.id };
}

/** Shared location rule (state / LGA / facility, overrides need a reason). */
function locationError(
  indicator: { name?: string | null; collected_at?: string | null; indicator_scope?: string | null },
  location: { entity_id: string | null; lga_id: string | null; override_note: string | null }
): string | null {
  return resultLocationError(
    {
      name: indicator.name ?? "This indicator",
      collected_at: (indicator.collected_at ?? undefined) as CollectedAt | undefined,
      indicator_scope: (indicator.indicator_scope ?? undefined) as "state" | "entity" | undefined,
    },
    location
  );
}

/** Name or email of the signed-in admin, stamped on every saved result. */
async function enteredByLabel(): Promise<string | null> {
  const user = await getServerUser();
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return (typeof meta.full_name === "string" && meta.full_name) || user.email || null;
}

const INDICATOR_COLUMNS =
  "id, name, collected_at, indicator_scope, value_type, score_options, description, unit";

async function uploadResultEvidence(
  admin: SupabaseClient,
  resultId: string,
  files: File[],
  caption: string | null,
  backTo: string
): Promise<number> {
  if (!files.length) return 0;

  await ensureEvidenceBucket(admin);
  let uploaded = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      fail(backTo, `"${file.name}" is not an image — evidence must be images.`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${resultId}/${Date.now()}-${safeName}`;
    const up = await admin.storage.from(evidenceBucket()).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (up.error) fail(backTo, `Result saved, but evidence upload failed: ${up.error.message}`);
    const ins = await admin.from("result_evidence").insert({
      result_id: resultId,
      storage_path: path,
      caption,
    });
    if (ins.error) fail(backTo, `Result saved, but evidence record failed: ${ins.error.message}`);
    uploaded++;
  }

  return uploaded;
}

export async function saveResult(formData: FormData) {
  const backTo = "/manage/results";
  const admin = await requireAdmin(backTo);

  const indicator_id = strOrNull(formData.get("indicator_id"));
  const time_period_id = strOrNull(formData.get("time_period_id"));
  const entity_id = strOrNull(formData.get("entity_id"));
  const lga_id = strOrNull(formData.get("lga_id"));
  const override_note = strOrNull(formData.get("override_note"));
  const abia_value = numOrNull(formData.get("abia_value"));
  if (!indicator_id || !time_period_id) fail(backTo, "Indicator and time period are required.");
  if (abia_value === null) fail(backTo, "Abia value is required and must be a number.");

  const periodMismatch = await assertPeriodMatchesIndicatorFrequency(admin, indicator_id, time_period_id);
  if (periodMismatch) fail(backTo, periodMismatch);

  const indicator = await admin.from("indicators").select(INDICATOR_COLUMNS).eq("id", indicator_id).single();
  if (indicator.error) fail(backTo, `Could not load indicator: ${indicator.error.message}`);
  const placement = locationError(indicator.data, { entity_id, lga_id, override_note });
  if (placement) fail(backTo, placement);
  validateIndicatorValue(backTo, indicator.data, abia_value);

  const saved = await upsertResult(admin, {
    indicator_id,
    time_period_id,
    entity_id,
    lga_id,
    abia_value,
    nigeria_value: numOrNull(formData.get("nigeria_value")),
    target_value: numOrNull(formData.get("target_value")),
    notes: strOrNull(formData.get("notes")),
    entered_by: await enteredByLabel(),
    override_note: entity_id || lga_id ? null : override_note,
  });
  if ("error" in saved) fail(backTo, `Could not save result: ${saved.error}`);

  const files = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);
  const uploaded = await uploadResultEvidence(
    admin,
    saved.id,
    files,
    strOrNull(formData.get("evidence_caption")),
    backTo
  );

  ok(backTo, `Result saved${uploaded ? ` with ${uploaded} evidence image${uploaded === 1 ? "" : "s"}` : ""}.`);
}

export async function saveResultRow(
  formData: FormData
): Promise<{ ok: true; uploaded: number } | { ok: false; error: string }> {
  const inline = await getInlineAdmin();
  if (!inline.admin) return { ok: false, error: inline.error ?? "Writes are disabled." };
  const admin = inline.admin;

  const indicator_id = strOrNull(formData.get("indicator_id"));
  const entity_id = strOrNull(formData.get("entity_id"));
  const lga_id = strOrNull(formData.get("lga_id"));
  const override_note = strOrNull(formData.get("override_note"));
  const abia_value = numOrNull(formData.get("abia_value"));
  if (!indicator_id) {
    return { ok: false, error: "Indicator and time period are required." };
  }
  if (abia_value === null) {
    return { ok: false, error: "A value is required before this row can be saved." };
  }

  const resolvedPeriod = await resolveTimePeriodId(admin, formData, indicator_id);
  if ("error" in resolvedPeriod) return { ok: false, error: resolvedPeriod.error };
  const time_period_id = resolvedPeriod.id;

  const indicator = await admin.from("indicators").select(INDICATOR_COLUMNS).eq("id", indicator_id).single();
  if (indicator.error) return { ok: false, error: `Could not load indicator: ${indicator.error.message}` };
  const placement = locationError(indicator.data, { entity_id, lga_id, override_note });
  if (placement) return { ok: false, error: placement };
  const valueError = indicatorValueError(indicator.data, abia_value);
  if (valueError) return { ok: false, error: valueError };

  const saved = await upsertResult(admin, {
    indicator_id,
    time_period_id,
    entity_id,
    lga_id,
    abia_value,
    nigeria_value: numOrNull(formData.get("nigeria_value")),
    target_value: numOrNull(formData.get("target_value")),
    notes: strOrNull(formData.get("notes")),
    entered_by: await enteredByLabel(),
    override_note: entity_id || lga_id ? null : override_note,
  });
  if ("error" in saved) return { ok: false, error: `Could not save result: ${saved.error}` };

  const uploaded = await uploadResultEvidence(
    admin,
    saved.id,
    formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0),
    strOrNull(formData.get("evidence_caption")),
    "/manage/results"
  );
  revalidatePath("/", "layout");
  return { ok: true, uploaded };
}

/**
 * Removes a statewide override so the period falls back to the LGA or
 * facility roll-up. Only LGA- and facility-collected indicators have
 * overrides; statewide values of state-collected indicators are kept.
 */
export async function clearStateOverride(formData: FormData) {
  const backTo = resolveBack(formData, "/manage/results");
  const admin = await requireAdmin(backTo);
  const indicator_id = strOrNull(formData.get("indicator_id"));
  const time_period_id = strOrNull(formData.get("time_period_id"));
  if (!indicator_id || !time_period_id) fail(backTo, "Indicator and time period are required.");

  const indicator = await admin.from("indicators").select(INDICATOR_COLUMNS).eq("id", indicator_id).single();
  if (indicator.error) fail(backTo, `Could not load indicator: ${indicator.error.message}`);
  if (collectedAt(indicator.data as never) === "state") {
    fail(backTo, "This indicator is collected statewide — its values are not overrides.");
  }

  const { error } = await admin
    .from("results")
    .delete()
    .eq("indicator_id", indicator_id)
    .eq("time_period_id", time_period_id)
    .is("entity_id", null)
    .is("lga_id", null);
  if (error) fail(backTo, `Could not clear the override: ${error.message}`);
  ok(backTo, "Override cleared — the statewide figure now comes from the roll-up.");
}

/**
 * Batch entry from the wizard grid: one value/notes pair per indicator,
 * posted as `value_<indicatorId>` / `nigeria_<indicatorId>` / `notes_<indicatorId>`
 * / `override_<indicatorId>`.
 */
export async function saveResultsBatch(formData: FormData) {
  const backTo = "/manage/results";
  const admin = await requireAdmin(backTo);

  const time_period_id = strOrNull(formData.get("time_period_id"));
  const entity_id = strOrNull(formData.get("entity_id"));
  const lga_id = strOrNull(formData.get("lga_id"));
  if (!time_period_id) fail(backTo, "A reporting period is required. Select when this data was captured before saving.");

  const rows: Array<{ indicatorId: string; value: number; nigeria: number | null; notes: string | null; overrideNote: string | null }> = [];
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
      overrideNote: strOrNull(formData.get(`override_${indicatorId}`)),
    });
  }
  if (rows.length === 0) fail(backTo, "Fill at least one indicator value before saving.");

  for (const row of rows) {
    const mismatch = await assertPeriodMatchesIndicatorFrequency(admin, row.indicatorId, time_period_id);
    if (mismatch) fail(backTo, mismatch);
  }

  const indicators = await admin
    .from("indicators")
    .select(INDICATOR_COLUMNS)
    .in("id", rows.map((r) => r.indicatorId));
  if (indicators.error) fail(backTo, `Could not load indicators: ${indicators.error.message}`);
  const indicatorById = new Map(indicators.data.map((i) => [i.id, i]));
  const enteredBy = await enteredByLabel();

  let saved = 0;
  let uploaded = 0;
  for (const row of rows) {
    const indicator = indicatorById.get(row.indicatorId);
    if (!indicator) fail(backTo, "One of the submitted indicators no longer exists.");
    const placement = locationError(indicator, { entity_id, lga_id, override_note: row.overrideNote });
    if (placement) fail(backTo, placement);
    validateIndicatorValue(backTo, indicator, row.value);

    const result = await upsertResult(admin, {
      indicator_id: row.indicatorId,
      time_period_id,
      entity_id,
      lga_id,
      abia_value: row.value,
      nigeria_value: row.nigeria,
      target_value: null,
      notes: row.notes,
      entered_by: enteredBy,
      override_note: entity_id || lga_id ? null : row.overrideNote,
    });
    if ("error" in result) {
      fail(backTo, `Saved ${saved} result${saved === 1 ? "" : "s"}, then failed: ${result.error}`);
    }
    uploaded += await uploadResultEvidence(
      admin,
      result.id,
      formData.getAll(`evidence_${row.indicatorId}`).filter((f): f is File => f instanceof File && f.size > 0),
      strOrNull(formData.get(`evidence_caption_${row.indicatorId}`)),
      backTo
    );
    saved++;
  }

  ok(
    backTo,
    `Saved ${saved} result${saved === 1 ? "" : "s"}${uploaded ? ` with ${uploaded} evidence image${uploaded === 1 ? "" : "s"}` : ""}.`
  );
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
  const enteredBy = await enteredByLabel();
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
    const lgaId = get("lga_id") || null;
    const overrideNote = get("override_note") || null;
    const indicator = await admin.from("indicators").select(INDICATOR_COLUMNS).eq("id", indicatorId).single();
    if (indicator.error) {
      errors.push(`Row ${idx + 2}: could not load indicator "${indicatorId}"`);
      continue;
    }
    const placement = locationError(indicator.data, { entity_id: entityId, lga_id: lgaId, override_note: overrideNote });
    if (placement) {
      errors.push(`Row ${idx + 2}: ${placement}`);
      continue;
    }
    const valueError = indicatorValueError(indicator.data, abia);
    if (valueError) {
      errors.push(`Row ${idx + 2}: ${valueError}`);
      continue;
    }

    const result = await upsertResult(admin, {
      indicator_id: indicatorId,
      time_period_id: get("time_period_id"),
      entity_id: entityId,
      lga_id: lgaId,
      abia_value: abia,
      nigeria_value: get("nigeria_value") ? Number(get("nigeria_value")) : null,
      target_value: get("target_value") ? Number(get("target_value")) : null,
      notes: get("notes") || null,
      entered_by: enteredBy,
      override_note: entityId || lgaId ? null : overrideNote,
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

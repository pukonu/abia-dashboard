"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataMode } from "@/lib/data-mode";
import { getServerUser } from "@/lib/supabase-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import type { DashboardChartType, DashboardScope } from "@/lib/types";

const CHART_TYPES: DashboardChartType[] = ["trend", "bar", "radar", "stat", "pie"];

/* ------------------------------------------------------------------ */
/* Helpers (mirror manage/actions.ts patterns)                         */
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
  if (!user) return { error: "Please sign in to manage dashboards." };
  const mode = await getDataMode();
  if (mode !== "live") {
    return { error: "You are viewing demo data. Switch to Live mode to save real dashboards." };
  }
  const admin = getAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env — writes are disabled." };
  return { admin };
}

function fail(backTo: string, message: string): never {
  redirect(`${backTo}?err=${encodeURIComponent(message)}`);
}

function ok(backTo: string, message: string): never {
  revalidatePath("/", "layout");
  redirect(message ? `${backTo}?msg=${encodeURIComponent(message)}` : backTo);
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

/* ------------------------------------------------------------------ */
/* Dashboard CRUD                                                      */
/* ------------------------------------------------------------------ */

export async function createDashboard(scope: DashboardScope, formData: FormData) {
  const backTo = "/manage/dashboards";
  const admin = await requireAdmin(backTo);

  const name = strOrNull(formData.get("name"));
  const targetId = strOrNull(formData.get(scope === "sector" ? "sector_id" : "lga_id"));
  if (!name) fail(backTo, "Name is required.");
  if (!targetId) fail(backTo, scope === "sector" ? "Pick a sector." : "Pick an LGA.");

  const { data, error } = await admin
    .from("dashboards")
    .insert({
      name,
      description: strOrNull(formData.get("description")),
      scope,
      sector_id: scope === "sector" ? targetId : null,
      lga_id: scope === "lga" ? targetId : null,
    })
    .select("id")
    .single();
  if (error) fail(backTo, `Could not create dashboard: ${error.message}`);

  revalidatePath("/", "layout");
  redirect(`/manage/dashboards/${data.id}?msg=${encodeURIComponent("Dashboard created — add your first widget.")}`);
}

/** Partial update: only fields present in the form are written. */
export async function patchDashboard(id: string, formData: FormData) {
  const backTo = strOrNull(formData.get("_back")) ?? `/manage/dashboards/${id}`;
  const admin = await requireAdmin(backTo);

  const row: Record<string, unknown> = {};
  if (formData.has("name")) {
    const name = strOrNull(formData.get("name"));
    if (!name) fail(backTo, "Name is required.");
    row.name = name;
  }
  if (formData.has("description")) row.description = strOrNull(formData.get("description"));
  if (formData.has("published")) row.published = formData.get("published") === "true";
  if (Object.keys(row).length === 0) return;

  const { error } = await admin.from("dashboards").update(row).eq("id", id);
  if (error) fail(backTo, `Could not save: ${error.message}`);
  const quiet = formData.get("_quiet") === "1";
  ok(backTo, quiet ? "" : "Dashboard updated.");
}

export async function deleteDashboard(id: string) {
  const backTo = "/manage/dashboards";
  const admin = await requireAdmin(backTo);
  const { error } = await admin.from("dashboards").delete().eq("id", id);
  if (error) fail(`/manage/dashboards/${id}`, `Could not delete: ${error.message}`);
  ok(backTo, "Dashboard deleted.");
}

/* ------------------------------------------------------------------ */
/* Widgets (inline actions used by the drag-and-drop builder)          */
/* ------------------------------------------------------------------ */

export interface WidgetInput {
  id?: string;
  dashboard_id: string;
  chart_type: DashboardChartType;
  title: string | null;
  indicator_ids: string[];
  span: number;
  position?: number;
}

export async function saveWidgetInline(
  input: WidgetInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const inline = await getInlineAdmin();
  if (!inline.admin) return { ok: false, error: inline.error ?? "Writes are disabled." };

  if (!CHART_TYPES.includes(input.chart_type)) {
    return { ok: false, error: "Unknown chart type." };
  }
  const indicatorIds = [...new Set(input.indicator_ids.map(String))];
  if (indicatorIds.length === 0) {
    return { ok: false, error: "Select at least one indicator." };
  }
  if (input.chart_type === "radar" && indicatorIds.length < 3) {
    return { ok: false, error: "Radar charts need at least 3 indicators." };
  }
  if (input.chart_type === "pie" && indicatorIds.length < 2) {
    return { ok: false, error: "Pie charts need at least 2 indicators." };
  }

  const row = {
    dashboard_id: input.dashboard_id,
    chart_type: input.chart_type,
    title: input.title?.trim() || null,
    indicator_ids: indicatorIds,
    span: input.span === 2 ? 2 : 1,
  };

  if (input.id) {
    const { error } = await inline.admin.from("dashboard_widgets").update(row).eq("id", input.id);
    if (error) return { ok: false, error: `Could not save widget: ${error.message}` };
    revalidatePath("/", "layout");
    return { ok: true, id: input.id };
  }

  const { data, error } = await inline.admin
    .from("dashboard_widgets")
    .insert({ ...row, position: input.position ?? 0 })
    .select("id")
    .single();
  if (error) return { ok: false, error: `Could not add widget: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

export async function deleteWidgetInline(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const inline = await getInlineAdmin();
  if (!inline.admin) return { ok: false, error: inline.error ?? "Writes are disabled." };
  const { error } = await inline.admin.from("dashboard_widgets").delete().eq("id", id);
  if (error) return { ok: false, error: `Could not delete widget: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Persists a new widget order after drag-and-drop. */
export async function reorderWidgetsInline(
  dashboardId: string,
  orderedIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const inline = await getInlineAdmin();
  if (!inline.admin) return { ok: false, error: inline.error ?? "Writes are disabled." };
  for (const [position, id] of orderedIds.entries()) {
    const { error } = await inline.admin
      .from("dashboard_widgets")
      .update({ position })
      .eq("id", id)
      .eq("dashboard_id", dashboardId);
    if (error) return { ok: false, error: `Could not reorder widgets: ${error.message}` };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

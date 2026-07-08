"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataMode } from "@/lib/data-mode";
import { getAdminClient } from "@/lib/supabase-admin";
import { getServerUser } from "@/lib/supabase-auth";

async function requireAdmin(backTo: string): Promise<SupabaseClient> {
  const user = await getServerUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(backTo)}`);
  const mode = await getDataMode();
  if (mode !== "live") {
    redirect(`${backTo}?err=${encodeURIComponent("You are viewing demo data. Switch to Live mode to save sector facts.")}`);
  }
  const admin = getAdminClient();
  if (!admin) {
    redirect(`${backTo}?err=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY is not set in .env — writes are disabled.")}`);
  }
  return admin;
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function numOrZero(value: FormDataEntryValue | null): number {
  const text = typeof value === "string" ? value.trim() : "";
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function done(backTo: string, message: string): never {
  revalidatePath("/", "layout");
  redirect(`${backTo}?msg=${encodeURIComponent(message)}`);
}

function fail(backTo: string, message: string): never {
  redirect(`${backTo}?err=${encodeURIComponent(message)}`);
}

export async function createSectorFact(formData: FormData) {
  const backTo = "/manage/sector-facts";
  const admin = await requireAdmin(backTo);
  const sectorId = strOrNull(formData.get("sector_id"));
  const label = strOrNull(formData.get("label"));
  const value = strOrNull(formData.get("value"));
  if (!sectorId) fail(backTo, "Pick a sector.");
  if (!label) fail(backTo, "Label is required.");
  if (!value) fail(backTo, "Value is required.");

  const { error } = await admin.from("sector_facts").insert({
    sector_id: sectorId,
    label,
    value,
    caption: strOrNull(formData.get("caption")),
    source: strOrNull(formData.get("source")),
    sort_order: numOrZero(formData.get("sort_order")),
  });
  if (error) fail(backTo, `Could not save sector fact: ${error.message}`);
  done(backTo, "Sector fact saved.");
}

export async function deleteSectorFact(formData: FormData) {
  const backTo = "/manage/sector-facts";
  const admin = await requireAdmin(backTo);
  const id = strOrNull(formData.get("id"));
  if (!id) fail(backTo, "Missing sector fact id.");
  const { error } = await admin.from("sector_facts").delete().eq("id", id);
  if (error) fail(backTo, `Could not delete sector fact: ${error.message}`);
  done(backTo, "Sector fact deleted.");
}

import { cookies } from "next/headers";
import type { DataMode } from "./types";

export const DATA_MODE_COOKIE = "abia-data-mode";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasServiceRole(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Resolves the active data mode:
 * - explicit cookie choice wins (live only when Supabase is configured)
 * - otherwise defaults to live when Supabase is configured, else demo
 */
export async function getDataMode(): Promise<DataMode> {
  const store = await cookies();
  const choice = store.get(DATA_MODE_COOKIE)?.value;
  if (choice === "demo") return "demo";
  if (choice === "live" && isSupabaseConfigured()) return "live";
  return isSupabaseConfigured() ? "live" : "demo";
}

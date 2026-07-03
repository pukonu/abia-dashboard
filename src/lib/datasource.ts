import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDataMode, isSupabaseConfigured } from "./data-mode";
import { getDemoData } from "./demo-data";
import type { DashboardData, Indicator, Result, ResultEvidence } from "./types";

/** Fetch every row of a table, paging past Supabase's 1,000-row response cap. */
async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  orderBy: string
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy)
      .range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

function demoSnapshot(): DashboardData {
  return { ...getDemoData(), supabaseConfigured: isSupabaseConfigured() };
}

function isMissingTableError(message: string): boolean {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    message.includes("does not exist")
  );
}

/**
 * Loads the full dashboard snapshot for the active data mode.
 *
 * Demo mode serves the built-in generated dataset. Live mode reads the
 * Supabase database (schema in prisma/schema.prisma, managed with Prisma
 * migrations) and shows exactly what has been entered — including empty
 * states when no data exists yet.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const mode = await getDataMode();
  if (mode === "demo" || !isSupabaseConfigured()) return demoSnapshot();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const bucket = process.env.NEXT_PUBLIC_EVIDENCE_BUCKET || "evidence";

  try {
    const supabase = createClient(url, key);
    const [
      sectors, lgas, mdas, entities, thematicAreas,
      domains, indicators, timePeriods, results, evidence,
    ] = await Promise.all([
      supabase.from("sectors").select("*").order("sort_order"),
      supabase.from("lgas").select("*").order("name"),
      supabase.from("mdas").select("*").order("name"),
      supabase.from("entities").select("*").order("name"),
      supabase.from("thematic_areas").select("*").order("name"),
      supabase.from("domains").select("*").order("name"),
      fetchAll<Indicator>(supabase, "indicators", "name"),
      supabase.from("time_periods").select("*").order("start_date"),
      fetchAll<Result>(supabase, "results", "id"),
      supabase.from("result_evidence").select("*"),
    ]);

    const tables = { sectors, lgas, mdas, entities, thematicAreas, domains, indicators, timePeriods, results, evidence };
    for (const [name, res] of Object.entries(tables)) {
      if (res.error) throw new Error(`Supabase query failed for ${name}: ${res.error.message}`);
    }

    const evidenceRows: ResultEvidence[] = (evidence.data ?? []).map((e) => ({
      id: e.id,
      result_id: e.result_id,
      storage_path: e.storage_path,
      caption: e.caption ?? null,
      url: `${url}/storage/v1/object/public/${bucket}/${e.storage_path}`,
    }));

    return {
      sectors: sectors.data ?? [],
      lgas: lgas.data ?? [],
      mdas: mdas.data ?? [],
      entities: entities.data ?? [],
      thematicAreas: thematicAreas.data ?? [],
      domains: domains.data ?? [],
      indicators: (indicators.data ?? []).map((i) => ({
        ...i,
        indicator_scope: i.indicator_scope ?? "state",
        state_indicator_id: i.state_indicator_id ?? null,
        target_value: i.target_value == null ? null : Number(i.target_value),
        weight: Number(i.weight ?? 1),
      })),
      timePeriods: timePeriods.data ?? [],
      results: (results.data ?? []).map((r) => ({
        ...r,
        abia_value: Number(r.abia_value),
        nigeria_value: r.nigeria_value == null ? null : Number(r.nigeria_value),
        target_value: r.target_value == null ? null : Number(r.target_value),
      })),
      evidence: evidenceRows,
      mode: "live",
      supabaseConfigured: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingTableError(message)) {
      console.error("Live data load failed, serving demo data:", err);
    }
    return demoSnapshot();
  }
}

import { NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/datasource";

/**
 * Full live dashboard snapshot in one response — the "en masse" endpoint
 * the PWA's background sync uses to fill its IndexedDB offline cache in a
 * single request instead of a dozen table queries. Everything returned is
 * already publicly readable through the Supabase anon key; this endpoint
 * just batches it.
 */

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const data = await loadDashboardData({ forceLive: true });
    return NextResponse.json(data, {
      headers: {
        ...CORS_HEADERS,
        // Small shared cache so a fleet of devices syncing at once doesn't
        // hammer the database, while staying effectively fresh.
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Snapshot failed: ${message}` },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

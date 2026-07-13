import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

/**
 * Public PWA release config — comparable build stamps and force-update flags.
 * The PWA polls this on launch (and periodically) to decide soft update vs
 * blocking reload / reinstall. Service-role read; no public RLS.
 */

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

const EMPTY = {
  minClientBuild: null as string | null,
  latestBuild: null as string | null,
  forceReload: false,
  forceReinstall: false,
  message: null as string | null,
  effectiveAt: null as string | null,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(EMPTY, {
      headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
    });
  }

  try {
    const { data, error } = await admin
      .from("pwa_release_config")
      .select(
        "min_client_build, latest_build, force_reload, force_reinstall, message, effective_at"
      )
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      // Table may not be migrated yet — fail open so the PWA still works.
      const missing = /pwa_release_config|relation|does not exist/i.test(error.message);
      if (missing) {
        return NextResponse.json(EMPTY, {
          headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
        });
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        minClientBuild: data?.min_client_build ?? null,
        latestBuild: data?.latest_build ?? null,
        forceReload: Boolean(data?.force_reload),
        forceReinstall: Boolean(data?.force_reinstall),
        message: data?.message ?? null,
        effectiveAt: data?.effective_at ?? null,
      },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

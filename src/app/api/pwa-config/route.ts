import { NextResponse } from "next/server";
import { formatViteBuildStamp } from "@/lib/pwa-build-id";
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

/**
 * Coerce legacy YYYYMMDDNN stamps to Vite-comparable YYYYMMDDHHmmss.
 * Uses effective_at when present so same-day clients that already rebuilt
 * after the publish are not stuck in a force-reload loop.
 */
function coerceBuildStamp(
  raw: string | null | undefined,
  effectiveAt: string | null | undefined
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length === 14) return digits;
  if (effectiveAt) {
    const d = new Date(effectiveAt);
    if (!Number.isNaN(d.getTime())) return formatViteBuildStamp(d);
  }
  if (digits.length >= 8) {
    return `${digits.slice(0, 8)}120000`;
  }
  return digits.padEnd(14, "0").slice(0, 14);
}

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

    const effectiveAt = data?.effective_at ?? null;

    return NextResponse.json(
      {
        minClientBuild: coerceBuildStamp(data?.min_client_build, effectiveAt),
        latestBuild: coerceBuildStamp(data?.latest_build, effectiveAt),
        forceReload: Boolean(data?.force_reload),
        forceReinstall: Boolean(data?.force_reinstall),
        message: data?.message ?? null,
        effectiveAt,
      },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

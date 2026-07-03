import { NextRequest, NextResponse } from "next/server";
import { DATA_MODE_COOKIE, isSupabaseConfigured } from "@/lib/data-mode";

/** Switches between demo and live data. Body: { mode: "demo" | "live" } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "live" ? "live" : "demo";

  if (mode === "live" && !isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env first." },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ mode });
  res.cookies.set(DATA_MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}

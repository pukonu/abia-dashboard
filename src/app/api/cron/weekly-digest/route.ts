import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/digest";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Friday weekly digest sender.
 * Protect with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 * or ?secret=<CRON_SECRET> for simple external schedulers.
 *
 * On Amplify, schedule this with EventBridge (see webapp/infrastructure/terraform).
 * vercel.json crons only apply if the app is hosted on Vercel.
 */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Cron injects Authorization: Bearer <CRON_SECRET> when the env var is set.
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  // Allow external schedulers (GitHub Actions, curl) via query param.
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const only = url.searchParams.get("only");
  const onlyEmails = only
    ? only
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : undefined;

  try {
    const result = await sendWeeklyDigest({ onlyEmails });
    return NextResponse.json({
      ok: result.failed.length === 0 && !result.skippedReason,
      ...result,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Digest send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

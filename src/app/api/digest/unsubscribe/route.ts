import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

/**
 * One-click unsubscribe from weekly digest emails.
 * GET /api/digest/unsubscribe?token=<uuid>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return htmlResponse(400, "Invalid unsubscribe link", "This unsubscribe link is not valid.");
  }

  const admin = getAdminClient();
  if (!admin) {
    return htmlResponse(503, "Unavailable", "Subscriptions are temporarily unavailable.");
  }

  const { data, error } = await admin
    .from("digest_subscriptions")
    .select("id, email, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (error || !data) {
    return htmlResponse(404, "Not found", "We could not find a subscription for this link.");
  }

  if (!data.unsubscribed_at) {
    await admin
      .from("digest_subscriptions")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  return htmlResponse(
    200,
    "Unsubscribed",
    `You have been unsubscribed from the Abia weekly digest (${data.email}). You can resubscribe anytime at /subscribe.`
  );
}

function htmlResponse(status: number, title: string, message: string) {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · Abia State Dashboard</title>
  <style>
    body { margin: 0; font-family: Georgia, Times, serif; background: #fafafa; color: #18181b; }
    main { max-width: 32rem; margin: 4rem auto; padding: 0 1.25rem; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { font-family: Helvetica, Arial, sans-serif; font-size: 0.95rem; line-height: 1.55; color: #52525b; }
    a { color: #14683c; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="/subscribe">Manage subscription</a> · <a href="/">Back to dashboard</a></p>
  </main>
</body>
</html>`;

  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

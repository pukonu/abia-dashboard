/**
 * Weekly digest: build the combined PDF, email body, and deliver to subscribers.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { appBaseUrl, isEmailConfigured, sendEmail } from "./email";
import { WeeklyDigestReport } from "./report";
import { computeDashboard, delta, fmt, ratingFor, type Computed } from "./scoring";
import { isSectorDashboardThematic } from "./sector-dashboard";
import { getAdminClient } from "./supabase-admin";
import { loadDashboardData } from "./datasource";

export type DigestSubscriber = {
  id: string;
  email: string;
  name: string | null;
  unsubscribe_token: string;
};

function weekLabel(): string {
  return new Date().toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function deltaLabel(pair: { score: number | null; prevScore: number | null }): string {
  const d = delta(pair);
  if (d == null) return "—";
  if (Math.abs(d) < 0.05) return "steady";
  return `${d > 0 ? "+" : "−"}${fmt(Math.abs(d), 1)} pts`;
}

export function buildDigestEmail(c: Computed, unsubscribeUrl: string): { subject: string; html: string; text: string } {
  const label = weekLabel();
  const stateScore = c.stateScore.score == null ? "—" : fmt(c.stateScore.score, 1);
  const stateRating = ratingFor(c.stateScore.score).label;
  const stateDelta = deltaLabel(c.stateScore);

  const digestThematicIds = new Set(
    c.data.thematicAreas.filter(isSectorDashboardThematic).map((t) => t.id)
  );
  const digestSectors = c.data.sectors.filter((s) =>
    c.data.thematicAreas.some((t) => t.sector_id === s.id && isSectorDashboardThematic(t))
  );

  const sectorLines = digestSectors.map((s) => {
    const pair = c.sectorScores.get(s.id) ?? { score: null, prevScore: null };
    const score = pair.score == null ? "—" : fmt(pair.score, 1);
    const ta = c.data.thematicAreas.find((t) => t.sector_id === s.id && isSectorDashboardThematic(t));
    const taScore = ta ? c.thematicScores.get(ta.id)?.score : null;
    const dashScore = taScore == null ? score : fmt(taScore, 1);
    return `• ${s.name}: Sector Dashboard ${dashScore} (sector composite ${score}, ${ratingFor(pair.score).label}, ${deltaLabel(pair)})`;
  });

  const attention = [...c.indicators]
    .filter((i) => i.indicator.indicator_scope !== "entity")
    .filter((i) => digestThematicIds.has(i.thematicArea.id))
    .filter((i) => i.score != null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 5);

  const subject = `Abia Weekly Digest — ${label}`;

  const text = [
    `Weekly State of Abia Digest — ${label}`,
    "",
    `State Performance Index: ${stateScore} (${stateRating}, ${stateDelta} vs previous period)`,
    "",
    "Sector Dashboards in this digest:",
    ...(sectorLines.length > 0 ? sectorLines : ["• No sectors have a Sector Dashboard thematic area marked yet."]),
    "",
    "Sector Dashboard indicators requiring attention:",
    ...(attention.length > 0
      ? attention.map(
          (i) => `• ${i.indicator.name} (${i.sector.name}): score ${i.score == null ? "—" : fmt(i.score, 0)}`
        )
      : ["• None"]),
    "",
    "The attached PDF covers only Sector Dashboard thematic areas (one per sector).",
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,Times,serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#14683c;padding:20px 28px;">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-family:Helvetica,Arial,sans-serif;">
                Government of Abia State
              </div>
              <div style="margin-top:6px;font-size:22px;font-weight:700;color:#ffffff;">
                Weekly State of Abia Digest
              </div>
              <div style="margin-top:4px;font-size:13px;color:rgba(255,255,255,0.85);font-family:Helvetica,Arial,sans-serif;">
                Week of ${label}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">
                Abia State Performance Index
              </div>
              <div style="margin-top:4px;font-size:36px;font-weight:700;line-height:1;">
                ${stateScore}
              </div>
              <div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3f3f46;">
                ${stateRating} overall · ${stateDelta} vs previous period
              </div>

              <div style="margin-top:28px;font-size:16px;font-weight:700;">Sector Dashboards</div>
              <p style="margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#71717a;line-height:1.45;">
                Only thematic areas marked as Sector Dashboard are included (${digestSectors.length} sector${digestSectors.length === 1 ? "" : "s"}).
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;font-family:Helvetica,Arial,sans-serif;font-size:13px;">
                ${
                  digestSectors.length === 0
                    ? `<tr><td style="padding:8px 0;color:#71717a;">No Sector Dashboard thematic areas configured yet.</td></tr>`
                    : digestSectors
                        .map((s) => {
                          const pair = c.sectorScores.get(s.id) ?? { score: null, prevScore: null };
                          const ta = c.data.thematicAreas.find(
                            (t) => t.sector_id === s.id && isSectorDashboardThematic(t)
                          );
                          const taScore = ta ? c.thematicScores.get(ta.id)?.score : null;
                          const score = taScore == null ? (pair.score == null ? "—" : fmt(pair.score, 1)) : fmt(taScore, 1);
                          return `<tr>
                      <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;color:#18181b;">${s.name}</td>
                      <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;color:#3f3f46;">${score} · ${ratingFor(taScore ?? pair.score).label}</td>
                    </tr>`;
                        })
                        .join("")
                }
              </table>

              <div style="margin-top:28px;font-size:16px;font-weight:700;">Needs attention</div>
              <ul style="margin:10px 0 0;padding-left:18px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#3f3f46;line-height:1.55;">
                ${
                  attention.length === 0
                    ? "<li>No Sector Dashboard indicators currently flagged.</li>"
                    : attention
                        .map(
                          (i) =>
                            `<li><strong style="color:#18181b;">${i.indicator.name}</strong> — ${i.sector.name} (score ${i.score == null ? "—" : fmt(i.score, 0)})</li>`
                        )
                        .join("")
                }
              </ul>

              <p style="margin:24px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#52525b;line-height:1.55;">
                The attached PDF includes the statewide summary plus each sector’s Sector Dashboard thematic area only.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #f4f4f5;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#a1a1aa;line-height:1.5;">
              You are receiving this because you subscribed to the Abia State weekly digest.
              <a href="${unsubscribeUrl}" style="color:#71717a;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html, text };
}

export async function renderWeeklyDigestPdf(c: Computed): Promise<Buffer> {
  const buffer = await renderToBuffer(WeeklyDigestReport({ c }));
  return Buffer.from(buffer);
}

export async function listActiveSubscribers(): Promise<DigestSubscriber[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("digest_subscriptions")
    .select("id, email, name, unsubscribe_token")
    .is("unsubscribed_at", null)
    .order("subscribed_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load subscribers: ${error.message}`);
  }
  return (data ?? []) as DigestSubscriber[];
}

export type DigestSendResult = {
  total: number;
  sent: number;
  failed: Array<{ email: string; error: string }>;
  skippedReason?: string;
};

/**
 * Generate one PDF for the current dashboard snapshot and email it to every
 * active subscriber. Safe to call from the Friday cron route or manually.
 */
export async function sendWeeklyDigest(options?: {
  /** Limit to specific emails (for testing). */
  onlyEmails?: string[];
}): Promise<DigestSendResult> {
  if (!isEmailConfigured()) {
    return { total: 0, sent: 0, failed: [], skippedReason: "Email is not configured (SENDGRID_API_KEY)." };
  }

  const admin = getAdminClient();
  if (!admin) {
    return { total: 0, sent: 0, failed: [], skippedReason: "Supabase service role is not configured." };
  }

  let subscribers = await listActiveSubscribers();
  if (options?.onlyEmails?.length) {
    const allow = new Set(options.onlyEmails.map((e) => e.toLowerCase()));
    subscribers = subscribers.filter((s) => allow.has(s.email.toLowerCase()));
  }

  if (subscribers.length === 0) {
    return { total: 0, sent: 0, failed: [], skippedReason: "No active subscribers." };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      total: subscribers.length,
      sent: 0,
      failed: [],
      skippedReason: "Digest requires Supabase credentials (live data).",
    };
  }

  const data = await loadDashboardData({ forceLive: true });
  if (data.mode !== "live") {
    return {
      total: subscribers.length,
      sent: 0,
      failed: [],
      skippedReason: "Could not load live dashboard data for the digest.",
    };
  }

  const c = computeDashboard(data);
  const pdf = await renderWeeklyDigestPdf(c);
  const filename = `abia-weekly-digest-${new Date().toISOString().slice(0, 10)}.pdf`;
  const base = appBaseUrl();

  const failed: Array<{ email: string; error: string }> = [];
  let sent = 0;

  for (const sub of subscribers) {
    const unsubscribeUrl = `${base}/api/digest/unsubscribe?token=${sub.unsubscribe_token}`;
    const { subject, html, text } = buildDigestEmail(c, unsubscribeUrl);
    const result = await sendEmail({
      to: sub.email,
      subject,
      html,
      text,
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    });

    if (!result.ok) {
      failed.push({ email: sub.email, error: result.error });
      continue;
    }

    sent += 1;
    await admin
      .from("digest_subscriptions")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", sub.id);
  }

  return { total: subscribers.length, sent, failed };
}

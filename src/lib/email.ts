/**
 * Transactional email via SendGrid (weekly digest + attachments).
 */
import sgMail from "@sendgrid/mail";

const DEFAULT_FROM = "Abia State Dashboard <noreply@abiaworkspace.com>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY);
}

export function digestFromEmail(): string {
  return process.env.DIGEST_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/\/$/, "");
    return host.startsWith("http") ? host : `https://${host}`;
  }
  return "http://localhost:7401";
}

function parseFrom(from: string): { email: string; name?: string } {
  const match = from.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: from.trim() };
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "SENDGRID_API_KEY is not configured." };
  }

  sgMail.setApiKey(apiKey);

  try {
    await sgMail.send({
      to: opts.to,
      from: parseFrom(digestFromEmail()),
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        type: a.contentType ?? "application/pdf",
        content: a.content.toString("base64"),
        disposition: "attachment",
      })),
    });
    return { ok: true };
  } catch (err) {
    const message =
      err && typeof err === "object" && "response" in err
        ? JSON.stringify((err as { response?: { body?: unknown } }).response?.body ?? err)
        : err instanceof Error
          ? err.message
          : "SendGrid send failed";
    return { ok: false, error: typeof message === "string" ? message : String(message) };
  }
}

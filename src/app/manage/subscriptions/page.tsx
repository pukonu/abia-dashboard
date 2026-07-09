import { Mail } from "lucide-react";
import Link from "next/link";
import { Flash } from "@/components/forms";
import { PageHeader, SectionTitle } from "@/components/ui";
import { isEmailConfigured } from "@/lib/email";
import { getAdminClient } from "@/lib/supabase-admin";
import { sendTestDigest, removeSubscriber } from "./actions";

export const metadata = { title: "Digest subscriptions" };

type Row = {
  id: string;
  email: string;
  name: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  last_sent_at: string | null;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ManageSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const admin = getAdminClient();
  const emailReady = isEmailConfigured();

  let rows: Row[] = [];
  let loadError: string | null = null;

  if (!admin) {
    loadError = "Supabase service role is not configured.";
  } else {
    const { data, error } = await admin
      .from("digest_subscriptions")
      .select("id, email, name, subscribed_at, unsubscribed_at, last_sent_at")
      .order("subscribed_at", { ascending: false });
    if (error) {
      loadError = error.message.includes("digest_subscriptions")
        ? "The digest_subscriptions table is missing. Run yarn db:deploy (migration 8)."
        : error.message;
    } else {
      rows = (data ?? []) as Row[];
    }
  }

  const active = rows.filter((r) => !r.unsubscribed_at);
  const inactive = rows.filter((r) => r.unsubscribed_at);

  return (
    <>
      <PageHeader
        eyebrow="Outreach"
        title="Weekly digest subscribers"
        subtitle="People who signed up at /subscribe to receive the Friday State of Abia PDF digest."
        actions={
          <Link
            href="/api/reports/weekly-digest"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Preview digest PDF
          </Link>
        }
      />

      <Flash msg={msg} err={err} />

      {!emailReady && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Email delivery needs <code className="rounded bg-amber-100 px-1">SENDGRID_API_KEY</code> in{" "}
          <code className="rounded bg-amber-100 px-1">.env</code>. Mail is sent from{" "}
          <code className="rounded bg-amber-100 px-1">noreply@abiaworkspace.com</code>. Subscriptions can
          still be collected.
        </div>
      )}

      {loadError ? (
        <div className="card card-pad text-sm text-red-800">{loadError}</div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="card card-pad">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Active</div>
              <div className="mt-1 display text-2xl font-semibold text-zinc-900">{active.length}</div>
            </div>
            <div className="card card-pad">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Unsubscribed</div>
              <div className="mt-1 display text-2xl font-semibold text-zinc-900">{inactive.length}</div>
            </div>
            <div className="card card-pad">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Public signup</div>
              <Link href="/subscribe" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-abia hover:underline">
                <Mail className="h-4 w-4" strokeWidth={1.5} />
                Open subscribe form
              </Link>
            </div>
          </div>

          <SectionTitle hint="Currently receiving Friday emails">Active subscribers</SectionTitle>
          {active.length === 0 ? (
            <div className="card card-pad text-sm text-zinc-500">No active subscribers yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Name</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Subscribed</th>
                    <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Last sent</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {active.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.email}</td>
                      <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">{row.name ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-zinc-500 md:table-cell">{fmtWhen(row.subscribed_at)}</td>
                      <td className="hidden px-4 py-3 text-zinc-500 lg:table-cell">{fmtWhen(row.last_sent_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <form action={sendTestDigest}>
                            <input type="hidden" name="email" value={row.email} />
                            <button
                              type="submit"
                              disabled={!emailReady}
                              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Send test
                            </button>
                          </form>
                          <form action={removeSubscriber}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inactive.length > 0 && (
            <>
              <SectionTitle hint="Opted out">Unsubscribed</SectionTitle>
              <div className="card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Email</th>
                      <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Name</th>
                      <th className="px-4 py-2.5 font-medium">Unsubscribed</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {inactive.map((row) => (
                      <tr key={row.id} className="text-zinc-500">
                        <td className="px-4 py-3">{row.email}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">{row.name ?? "—"}</td>
                        <td className="px-4 py-3">{fmtWhen(row.unsubscribed_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <form action={removeSubscriber}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                            >
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

import { Mail } from "lucide-react";
import { Flash, inputClass } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { subscribeToDigest } from "./actions";

export const metadata = {
  title: "Weekly digest",
  description:
    "Subscribe by email to receive the State of Abia weekly digest — statewide indicators and sector dashboard PDFs every Friday.",
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  return (
    <>
      <PageHeader
        eyebrow="Stay informed"
        title="Weekly State of Abia digest"
        subtitle="Enter your email to receive a Friday summary of statewide performance, with a PDF covering every sector dashboard."
      />

      <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Flash msg={msg} err={err} />
          <form action={subscribeToDigest} className="card card-pad space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-abia/10 text-abia">
                <Mail className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <div>
                <div className="text-sm font-semibold text-zinc-900">Email subscription</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  No account required. We only use your address to send the weekly digest. You can
                  unsubscribe from any email.
                </p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-700">Email address</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-700">
                Name <span className="font-normal text-zinc-400">(optional)</span>
              </span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                placeholder="How should we address you?"
                className={inputClass}
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Subscribe for Friday digests
            </button>
          </form>
        </div>

        <aside className="card card-pad space-y-4 text-sm leading-relaxed text-zinc-600">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">What you receive</div>
            <ul className="mt-3 space-y-2.5">
              <li>
                <span className="font-medium text-zinc-900">Statewide summary</span> — Abia Performance
                Index, sector scores, LGA ranking, and indicators needing attention.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Sector Dashboards only</span> — one PDF
                covering each sector’s flagged Sector Dashboard thematic area (not the full framework).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Every Friday</span> — generated from the latest
                live dashboard data and emailed as a PDF attachment.
              </li>
            </ul>
          </div>
          <p className="border-t border-zinc-100 pt-4 text-xs text-zinc-400">
            Digests use live Supabase data. Public dashboards remain available anytime at the overview
            and sector pages.
          </p>
        </aside>
      </div>
    </>
  );
}

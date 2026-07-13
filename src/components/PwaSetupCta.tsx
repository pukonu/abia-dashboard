"use client";

import {
  BookOpen,
  Download,
  Laptop,
  MonitorDown,
  MoreVertical,
  Share,
  Smartphone,
  SquarePlus,
  TabletSmartphone,
} from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { pwaInstallUrl, pwaUrl, pwaUrlLabel } from "@/lib/pwa-url";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const subscribeToPlatform = () => () => {};

/**
 * Same "Get the app" section as the PWA Overview/Landing install UI, adapted
 * for the Next.js webapp. Always points at the canonical PWA host.
 */
export default function PwaSetupCta() {
  const platform = useSyncExternalStore(subscribeToPlatform, detectPlatform, () => "desktop");

  return (
    <section id="get-the-app" className="card card-pad scroll-mt-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-abia/10 text-abia dark:bg-abia/20">
          <Smartphone className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="display text-base font-semibold text-zinc-900 dark:text-zinc-50 sm:text-lg">
            Take this dashboard with you
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Install it as an app on your phone or computer — it launches from your home screen and
            keeps working offline in the field. Or simply continue using it right here in the
            browser.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={pwaInstallUrl}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          Get the app
        </a>
        <a
          href={pwaInstallUrl}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          Install guide — iPhone · Android · Computer
        </a>
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Install from the official address:{" "}
        <a
          href={pwaUrl}
          className="font-medium text-abia-dark underline-offset-2 hover:underline dark:text-abia"
        >
          {pwaUrlLabel}
        </a>
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <InstallCard
          title="iPhone & iPad"
          icon={Smartphone}
          highlight={platform === "ios"}
          steps={[
            <>
              Open{" "}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{pwaUrlLabel}</strong>{" "}
              in <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Safari</strong>.
            </>,
            <>
              Tap the <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Share</strong>{" "}
              button <Share className="inline h-3.5 w-3.5 align-text-bottom" strokeWidth={1.5} /> in
              the toolbar.
            </>,
            <>
              Scroll and tap{" "}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                Add to Home Screen
              </strong>{" "}
              <SquarePlus className="inline h-3.5 w-3.5 align-text-bottom" strokeWidth={1.5} />.
            </>,
            <>
              Tap <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Add</strong> —
              the dashboard icon appears on your home screen.
            </>,
          ]}
        />
        <InstallCard
          title="Android"
          icon={TabletSmartphone}
          highlight={platform === "android"}
          steps={[
            <>
              Open{" "}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{pwaUrlLabel}</strong>{" "}
              in <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Chrome</strong>.
            </>,
            <>
              Tap <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Install app</strong>{" "}
              when prompted, or open the{" "}
              <MoreVertical className="inline h-3.5 w-3.5 align-text-bottom" strokeWidth={1.5} />{" "}
              menu.
            </>,
            <>
              Choose{" "}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Install app</strong>{" "}
              (or Add to Home screen).
            </>,
            <>Confirm — it installs like a normal app, icon and all.</>,
          ]}
        />
        <InstallCard
          title="Computer"
          icon={Laptop}
          highlight={platform === "desktop"}
          steps={[
            <>
              Open{" "}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{pwaUrlLabel}</strong>{" "}
              in <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Chrome</strong> or{" "}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Edge</strong>.
            </>,
            <>
              Click the install icon{" "}
              <MonitorDown className="inline h-3.5 w-3.5 align-text-bottom" strokeWidth={1.5} /> at
              the right of the address bar.
            </>,
            <>
              Click <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Install</strong>{" "}
              — it opens in its own window on your dock or taskbar.
            </>,
          ]}
        />
      </div>
    </section>
  );
}

function InstallCard({
  title,
  icon: Icon,
  highlight,
  steps,
}: {
  title: string;
  icon: typeof Smartphone;
  highlight: boolean;
  steps: ReactNode[];
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-abia/40 bg-abia/5 dark:border-abia/50 dark:bg-abia/10"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50"
      }`}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-abia/10 text-abia dark:bg-abia/20">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        {highlight && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-abia">
            Your device
          </span>
        )}
      </div>
      <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

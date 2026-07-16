import { RefreshCw, Sparkles, Smartphone } from "lucide-react";
import { Flash } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { nextAutoBuildId } from "@/lib/pwa-build-id";
import { getAdminClient } from "@/lib/supabase-admin";
import {
  clearForceFlags,
  forceReloadToLatest,
  publishAutoPwaUpdate,
  saveMaintenanceGate,
  savePwaReleaseConfig,
} from "./actions";

export const metadata = { title: "PWA releases" };

type ConfigRow = {
  min_client_build: string | null;
  latest_build: string | null;
  force_reload: boolean;
  force_reinstall: boolean;
  message: string | null;
  maintenance_active: boolean;
  maintenance_message: string | null;
  effective_at: string | null;
  updated_at: string | null;
};

export default async function ManagePwaReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const admin = getAdminClient();

  let row: ConfigRow | null = null;
  let loadError: string | null = null;

  if (!admin) {
    loadError = "Supabase service role is not configured.";
  } else {
    const { data, error } = await admin
      .from("pwa_release_config")
      .select(
        "min_client_build, latest_build, force_reload, force_reinstall, message, maintenance_active, maintenance_message, effective_at, updated_at"
      )
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      loadError = /pwa_release_config|relation|does not exist/i.test(error.message)
        ? "The pwa_release_config table is missing. Run yarn db:deploy (migration 11)."
        : error.message;
    } else {
      row = (data as ConfigRow | null) ?? null;
    }
  }

  const previewBuild = nextAutoBuildId(row?.latest_build ?? null);

  return (
    <>
      <PageHeader
        eyebrow="Mobile app"
        title="PWA release control"
        subtitle="Announce updates to installed Abia Dashboard PWAs. Soft updates show a banner; force reload clears caches and reloads; force reinstall asks users to delete and re-add the home-screen icon."
      />

      <Flash msg={msg} err={err} />

      {loadError ? (
        <div className="card card-pad text-sm text-red-800">{loadError}</div>
      ) : (
        <>
          <form
            action={saveMaintenanceGate}
            className="card card-pad mb-6 space-y-4 border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20"
          >
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                App-wide maintenance message
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                When enabled, every PWA user sees only this message on opening or returning to the app.
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-zinc-800 dark:text-zinc-200">
                Message
              </span>
              <textarea
                name="maintenance_message"
                rows={3}
                defaultValue={row?.maintenance_message ?? ""}
                placeholder="e.g. Scheduled maintenance until 5 PM WAT."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="maintenance_active"
                  defaultChecked={row?.maintenance_active ?? false}
                  className="rounded border-zinc-300"
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Block the app</span>
              </label>
              <button
                type="submit"
                className="rounded-md bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-600"
              >
                Save maintenance message
              </button>
            </div>
          </form>

          <div className="card card-pad mb-6 space-y-4 border-orange-200 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Publish update now
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                One click creates a Vite-compatible build stamp (UTC{" "}
                <span className="font-mono text-xs">YYYYMMDDHHmmss</span>, preview{" "}
                <span className="font-mono text-xs">{previewBuild}</span>), sets it as
                latest/minimum, and turns on force reload. You do not need to paste a build ID.
              </p>
            </div>
            <form action={publishAutoPwaUpdate} className="flex flex-wrap items-end gap-3">
              <label className="min-w-[14rem] flex-1 text-sm">
                <span className="mb-1.5 block font-medium text-zinc-800 dark:text-zinc-200">
                  Message (optional)
                </span>
                <input
                  name="message"
                  defaultValue={row?.message ?? ""}
                  placeholder="Shown in the orange update banner"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-orange-500"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                Publish update now
              </button>
            </form>
          </div>

          <div className="mb-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Manual control (optional)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Deploy a new PWA build to production when you have code changes.</li>
              <li>
                Prefer <strong>Publish update now</strong> above — or paste a Build ID from the
                installed app → Settings into <strong>Latest build</strong> and save.
              </li>
              <li>
                Use <strong>Force reinstall</strong> only when icons / manifest identity changed
                (mostly iOS).
              </li>
            </ol>
          </div>

          <form action={savePwaReleaseConfig} className="card card-pad space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-zinc-800">Latest build</span>
                <input
                  name="latest_build"
                  defaultValue={row?.latest_build ?? ""}
                  placeholder="e.g. 2026071301 (auto) or 20260713094122"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  Soft “update available” when the client build is older than this.
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-zinc-800">Minimum build</span>
                <input
                  name="min_client_build"
                  defaultValue={row?.min_client_build ?? ""}
                  placeholder="e.g. 2026071301"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  Clients older than this must update when a force flag is on.
                </span>
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-zinc-800">Message (optional)</span>
              <textarea
                name="message"
                rows={3}
                defaultValue={row?.message ?? ""}
                placeholder="Shown in the update banner / blocking modal"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <div className="flex flex-wrap gap-5 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="force_reload"
                  defaultChecked={row?.force_reload ?? false}
                  className="rounded border-zinc-300"
                />
                <span className="font-medium text-zinc-800">Force reload</span>
                <span className="text-zinc-500">(clear caches &amp; reload)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="force_reinstall"
                  defaultChecked={row?.force_reinstall ?? false}
                  className="rounded border-zinc-300"
                />
                <span className="font-medium text-zinc-800">Force reinstall</span>
                <span className="text-zinc-500">(home-screen remove &amp; re-add)</span>
              </label>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950"
            >
              Save release settings
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={forceReloadToLatest}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                Require reload to latest
              </button>
            </form>
            <form action={clearForceFlags}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              >
                Clear force flags
              </button>
            </form>
          </div>

          {row?.updated_at && (
            <p className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
              <Smartphone className="h-3.5 w-3.5" strokeWidth={1.5} />
              Last updated {new Date(row.updated_at).toLocaleString("en-NG")}
              {row.effective_at ? ` · effective ${new Date(row.effective_at).toLocaleString("en-NG")}` : ""}
              {row.latest_build ? ` · latest ${row.latest_build}` : ""}
            </p>
          )}
        </>
      )}
    </>
  );
}

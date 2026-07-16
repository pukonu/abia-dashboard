"use server";

import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase-admin";
import { nextAutoBuildId } from "@/lib/pwa-build-id";
import { requireSuperAdmin } from "@/lib/manage-access";

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function cleanBuild(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value.length > 0 ? value : null;
}

export async function savePwaReleaseConfig(formData: FormData) {
  await requireSuperAdmin("/manage/pwa-release");

  const admin = getAdminClient();
  if (!admin) {
    redirect(
      "/manage/pwa-release?err=" + encodeURIComponent("Service role is not configured.")
    );
  }

  const payload = {
    id: "default",
    min_client_build: cleanBuild(formData.get("min_client_build")),
    latest_build: cleanBuild(formData.get("latest_build")),
    force_reload: formData.get("force_reload") === "on",
    force_reinstall: formData.get("force_reinstall") === "on",
    message: cleanBuild(formData.get("message")),
    effective_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await admin.from("pwa_release_config").upsert(payload, { onConflict: "id" });
    if (error) {
      redirect("/manage/pwa-release?err=" + encodeURIComponent(error.message));
    }
    redirect("/manage/pwa-release?msg=" + encodeURIComponent("PWA release settings saved."));
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Failed to save.";
    redirect("/manage/pwa-release?err=" + encodeURIComponent(message));
  }
}

/**
 * One-click: mint the next date+increment build stamp, set it as latest/minimum,
 * and require clients to reload. No manual build ID needed.
 */
export async function publishAutoPwaUpdate(formData: FormData) {
  await requireSuperAdmin("/manage/pwa-release");

  const admin = getAdminClient();
  if (!admin) {
    redirect(
      "/manage/pwa-release?err=" + encodeURIComponent("Service role is not configured.")
    );
  }

  const { data, error } = await admin
    .from("pwa_release_config")
    .select("latest_build, message")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    redirect("/manage/pwa-release?err=" + encodeURIComponent(error.message));
  }

  const buildId = nextAutoBuildId(data?.latest_build ?? null);
  const message =
    cleanBuild(formData.get("message")) ??
    (typeof data?.message === "string" && data.message.trim() ? data.message.trim() : null) ??
    "A new version of the Abia Dashboard is ready. Tap Update to reload.";

  const { error: upErr } = await admin.from("pwa_release_config").upsert(
    {
      id: "default",
      min_client_build: buildId,
      latest_build: buildId,
      force_reload: true,
      force_reinstall: false,
      message,
      effective_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upErr) {
    redirect("/manage/pwa-release?err=" + encodeURIComponent(upErr.message));
  }

  redirect(
    "/manage/pwa-release?msg=" +
      encodeURIComponent(`Update published · build ${buildId} · force reload on.`)
  );
}

/** Convenience: require reload for anyone below the latest build stamp. */
export async function forceReloadToLatest() {
  await requireSuperAdmin("/manage/pwa-release");

  const admin = getAdminClient();
  if (!admin) {
    redirect(
      "/manage/pwa-release?err=" + encodeURIComponent("Service role is not configured.")
    );
  }

  const { data, error } = await admin
    .from("pwa_release_config")
    .select("latest_build")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    redirect("/manage/pwa-release?err=" + encodeURIComponent(error.message));
  }

  const latest = data?.latest_build?.trim();
  if (!latest) {
    redirect(
      "/manage/pwa-release?err=" +
        encodeURIComponent(
          "No build stamp yet — use “Publish update now” to auto-create one, or save a Latest build first."
        )
    );
  }

  const { error: upErr } = await admin.from("pwa_release_config").upsert(
    {
      id: "default",
      min_client_build: latest,
      latest_build: latest,
      force_reload: true,
      force_reinstall: false,
      effective_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upErr) {
    redirect("/manage/pwa-release?err=" + encodeURIComponent(upErr.message));
  }

  redirect(
    "/manage/pwa-release?msg=" +
      encodeURIComponent(`Force reload enabled for builds older than ${latest}.`)
  );
}

export async function clearForceFlags() {
  await requireSuperAdmin("/manage/pwa-release");

  const admin = getAdminClient();
  if (!admin) {
    redirect(
      "/manage/pwa-release?err=" + encodeURIComponent("Service role is not configured.")
    );
  }

  const { error } = await admin
    .from("pwa_release_config")
    .update({
      force_reload: false,
      force_reinstall: false,
      min_client_build: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) {
    redirect("/manage/pwa-release?err=" + encodeURIComponent(error.message));
  }

  redirect("/manage/pwa-release?msg=" + encodeURIComponent("Force flags cleared."));
}

export async function saveMaintenanceGate(formData: FormData) {
  await requireSuperAdmin("/manage/pwa-release");
  const admin = getAdminClient();
  if (!admin) {
    redirect(
      "/manage/pwa-release?err=" + encodeURIComponent("Service role is not configured.")
    );
  }

  const active = formData.get("maintenance_active") === "on";
  const message = cleanBuild(formData.get("maintenance_message"));
  if (active && !message) {
    redirect(
      "/manage/pwa-release?err=" +
        encodeURIComponent("Add the message users should see before enabling maintenance mode.")
    );
  }

  const { error } = await admin
    .from("pwa_release_config")
    .upsert(
      {
        id: "default",
        maintenance_active: active,
        maintenance_message: active ? message : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) redirect("/manage/pwa-release?err=" + encodeURIComponent(error.message));
  redirect(
    "/manage/pwa-release?msg=" +
      encodeURIComponent(active ? "Maintenance mode enabled." : "Maintenance mode disabled.")
  );
}

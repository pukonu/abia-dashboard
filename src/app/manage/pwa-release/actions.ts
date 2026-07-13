"use server";

import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase-admin";
import { getServerUser } from "@/lib/supabase-auth";

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
  const user = await getServerUser();
  if (!user) redirect("/login?next=/manage/pwa-release");

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

/** Convenience: require reload for anyone below the latest build stamp. */
export async function forceReloadToLatest() {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/manage/pwa-release");

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
        encodeURIComponent("Set Latest build first (paste the build ID from the PWA Settings screen).")
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
  const user = await getServerUser();
  if (!user) redirect("/login?next=/manage/pwa-release");

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

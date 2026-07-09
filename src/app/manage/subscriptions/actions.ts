"use server";

import { redirect } from "next/navigation";
import { sendWeeklyDigest } from "@/lib/digest";
import { getAdminClient } from "@/lib/supabase-admin";

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function sendTestDigest(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/manage/subscriptions?err=" + encodeURIComponent("Missing email."));
  }

  try {
    const result = await sendWeeklyDigest({ onlyEmails: [email] });
    if (result.skippedReason) {
      redirect("/manage/subscriptions?err=" + encodeURIComponent(result.skippedReason));
    }
    if (result.failed.length > 0) {
      redirect(
        "/manage/subscriptions?err=" +
          encodeURIComponent(result.failed[0]?.error ?? "Failed to send test digest.")
      );
    }
    redirect(
      "/manage/subscriptions?msg=" + encodeURIComponent(`Test digest sent to ${email}.`)
    );
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Failed to send test digest.";
    redirect("/manage/subscriptions?err=" + encodeURIComponent(message));
  }
}

export async function removeSubscriber(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/manage/subscriptions?err=" + encodeURIComponent("Missing subscriber id."));
  }

  const admin = getAdminClient();
  if (!admin) {
    redirect("/manage/subscriptions?err=" + encodeURIComponent("Service role is not configured."));
  }

  const { error } = await admin.from("digest_subscriptions").delete().eq("id", id);
  if (error) {
    redirect("/manage/subscriptions?err=" + encodeURIComponent(error.message));
  }

  redirect("/manage/subscriptions?msg=" + encodeURIComponent("Subscriber removed."));
}

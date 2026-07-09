"use server";

import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase-admin";

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  // Practical validation — Resend will reject invalid addresses at send time.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function subscribeToDigest(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const nameRaw = String(formData.get("name") ?? "").trim();
  const name = nameRaw ? nameRaw.slice(0, 120) : null;

  if (!email) {
    redirect("/subscribe?err=" + encodeURIComponent("Please enter a valid email address."));
  }

  const admin = getAdminClient();
  if (!admin) {
    redirect(
      "/subscribe?err=" +
        encodeURIComponent("Subscriptions are unavailable right now. Live database credentials are not configured.")
    );
  }

  const { data: existing, error: lookupError } = await admin
    .from("digest_subscriptions")
    .select("id, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    redirect("/subscribe?err=" + encodeURIComponent("Could not save your subscription. Please try again."));
  }

  if (existing) {
    if (existing.unsubscribed_at) {
      const { error } = await admin
        .from("digest_subscriptions")
        .update({
          name,
          unsubscribed_at: null,
          subscribed_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        redirect("/subscribe?err=" + encodeURIComponent("Could not reactivate your subscription. Please try again."));
      }
      redirect("/subscribe?msg=" + encodeURIComponent("Welcome back — your weekly digest subscription is active again."));
    }

    redirect("/subscribe?msg=" + encodeURIComponent("You are already subscribed to the weekly digest."));
  }

  const { error } = await admin.from("digest_subscriptions").insert({
    email,
    name,
  });

  if (error) {
    redirect("/subscribe?err=" + encodeURIComponent("Could not save your subscription. Please try again."));
  }

  redirect(
    "/subscribe?msg=" +
      encodeURIComponent("You are subscribed. You will receive the State of Abia weekly digest every Friday.")
  );
}

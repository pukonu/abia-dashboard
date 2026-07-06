"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase, getServerUser } from "@/lib/supabase-auth";
import { getAdminClient } from "@/lib/supabase-admin";

function safeManagePath(value: string | null | undefined): string {
  return value && value.startsWith("/manage") ? value : "/manage";
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function signInManageUser(formData: FormData) {
  const next = safeManagePath(asString(formData.get("next")));
  const email = asString(formData.get("email"));
  const password = asString(formData.get("password"));
  if (!email || !password) {
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent("Email and password are required.")}`);
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign in.";
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent(message)}`);
  }

  redirect(next);
}

export async function signOutManageUser() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login?msg=" + encodeURIComponent("Signed out."));
}

export async function bootstrapManageUser(formData: FormData) {
  const next = safeManagePath(asString(formData.get("next")));
  const admin = getAdminClient();
  if (!admin) {
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY is not set in .env — first-user setup is unavailable.")}`);
  }

  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (existing.error) {
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent(existing.error.message)}`);
  }
  if ((existing.data?.users ?? []).length > 0) {
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent("A manage user already exists. Please sign in instead.")}`);
  }

  const email = asString(formData.get("email"));
  const password = asString(formData.get("password"));
  if (!email || !password) {
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent("Email and password are required.")}`);
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) {
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent(created.error.message)}`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}

async function requireManageUser(backTo: string) {
  const user = await getServerUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(backTo)}`);
  }
  return user;
}

export async function createManageUser(formData: FormData) {
  const backTo = "/manage/users";
  await requireManageUser(backTo);
  const admin = getAdminClient();
  if (!admin) redirect(`${backTo}?err=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY is not set in .env — user management is disabled.")}`);

  const email = asString(formData.get("email"));
  const password = asString(formData.get("password"));
  if (!email || !password) {
    redirect(`${backTo}?err=${encodeURIComponent("Email and password are required.")}`);
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    redirect(`${backTo}?err=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/manage/users");
  redirect(`${backTo}?msg=${encodeURIComponent("User created.")}`);
}

export async function deleteManageUser(formData: FormData) {
  const backTo = "/manage/users";
  const currentUser = await requireManageUser(backTo);
  const admin = getAdminClient();
  if (!admin) redirect(`${backTo}?err=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY is not set in .env — user management is disabled.")}`);

  const userId = asString(formData.get("user_id"));
  if (!userId) redirect(`${backTo}?err=${encodeURIComponent("Missing user id.")}`);
  if (userId === currentUser.id) {
    redirect(`${backTo}?err=${encodeURIComponent("You cannot delete the user you are currently signed in as.")}`);
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) redirect(`${backTo}?err=${encodeURIComponent(error.message)}`);

  revalidatePath("/manage/users");
  redirect(`${backTo}?msg=${encodeURIComponent("User deleted.")}`);
}

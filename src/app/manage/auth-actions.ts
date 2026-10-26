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

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    redirect(`${backTo}?err=${encodeURIComponent(error.message)}`);
  }
  const access = await saveUserAccess(admin, created.user.id, formData);
  revalidatePath("/manage/users");
  redirect(
    access.error
      ? `${backTo}?err=${encodeURIComponent(`User created, but access could not be saved: ${access.error}`)}`
      : `${backTo}?msg=${encodeURIComponent("User created.")}`
  );
}

const ROLES = new Set(["super_admin", "data_analyst", "mda_admin", "lga_officer", "guest"]);

/**
 * Writes a user's role and MDA / LGA assignments, which the database's
 * capture policies use to decide what the PWA and native app may save.
 */
async function saveUserAccess(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  userId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const roleRaw = asString(formData.get("role"));
  const role = ROLES.has(roleRaw) ? roleRaw : "guest";
  const mdaIds = formData.getAll("mda_ids").map(String).filter(Boolean);
  const lgaIds = formData.getAll("lga_ids").map(String).filter(Boolean);

  const roleSave = await admin
    .from("manage_user_roles")
    .upsert({ user_id: userId, role, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (roleSave.error) return { error: roleSave.error.message };

  const mdaClear = await admin.from("manage_user_mdas").delete().eq("user_id", userId);
  if (mdaClear.error) return { error: mdaClear.error.message };
  if (mdaIds.length) {
    const mdaSave = await admin.from("manage_user_mdas").insert(mdaIds.map((mda_id) => ({ user_id: userId, mda_id })));
    if (mdaSave.error) return { error: mdaSave.error.message };
  }

  const lgaClear = await admin.from("manage_user_lgas").delete().eq("user_id", userId);
  if (lgaClear.error) {
    // Older databases (before migration 18) have no LGA assignments.
    return lgaIds.length ? { error: lgaClear.error.message } : {};
  }
  if (lgaIds.length) {
    const lgaSave = await admin.from("manage_user_lgas").insert(lgaIds.map((lga_id) => ({ user_id: userId, lga_id })));
    if (lgaSave.error) return { error: lgaSave.error.message };
  }
  return {};
}

export async function updateManageUserAccess(formData: FormData) {
  const backTo = "/manage/users";
  await requireManageUser(backTo);
  const admin = getAdminClient();
  if (!admin) redirect(`${backTo}?err=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY is not set in .env — user management is disabled.")}`);

  const userId = asString(formData.get("user_id"));
  if (!userId) redirect(`${backTo}?err=${encodeURIComponent("Missing user id.")}`);
  const access = await saveUserAccess(admin, userId, formData);
  revalidatePath("/manage/users");
  redirect(
    access.error
      ? `${backTo}?err=${encodeURIComponent(access.error)}`
      : `${backTo}?msg=${encodeURIComponent("Access updated.")}`
  );
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

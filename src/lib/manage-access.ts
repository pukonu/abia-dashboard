import { redirect } from "next/navigation";
import { getAdminClient } from "./supabase-admin";
import { getServerUser } from "./supabase-auth";

export type ManageRole = "super_admin" | "data_analyst" | "mda_admin" | "lga_officer" | "guest";

export const MANAGE_ROLE_OPTIONS: Array<{ value: ManageRole; label: string; hint: string }> = [
  { value: "super_admin", label: "Super admin", hint: "Everything, including users and settings" },
  { value: "data_analyst", label: "Data analyst", hint: "Enter any result, statewide overrides included" },
  { value: "mda_admin", label: "MDA admin", hint: "Results for their MDAs' facilities and indicators" },
  { value: "lga_officer", label: "LGA officer", hint: "LGA returns and facility results in their LGAs" },
  { value: "guest", label: "Guest", hint: "View only" },
];

export type ManageAccess = {
  userId: string;
  role: ManageRole;
  mdaIds: string[];
  lgaIds: string[];
};

export async function getManageAccess(): Promise<ManageAccess | null> {
  const user = await getServerUser();
  if (!user) return null;
  const admin = getAdminClient();
  if (!admin) return { userId: user.id, role: "guest", mdaIds: [], lgaIds: [] };

  const [{ data: roleRow }, { data: assignments }, { data: lgaAssignments }] = await Promise.all([
    admin.from("manage_user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    admin.from("manage_user_mdas").select("mda_id").eq("user_id", user.id),
    // manage_user_lgas arrives with migration 18; older databases return an error → no LGAs.
    admin.from("manage_user_lgas").select("lga_id").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    role: (roleRow?.role as ManageRole | undefined) ?? "guest",
    mdaIds: (assignments ?? []).map((assignment) => assignment.mda_id),
    lgaIds: (lgaAssignments ?? []).map((assignment) => assignment.lga_id),
  };
}

export async function requireSuperAdmin(backTo = "/manage"): Promise<ManageAccess> {
  const access = await getManageAccess();
  if (!access) redirect(`/login?next=${encodeURIComponent(backTo)}`);
  if (access.role !== "super_admin") redirect("/manage/results?err=You do not have access to that area.");
  return access;
}

export async function requireResultEntryAccess(backTo = "/manage/results"): Promise<ManageAccess> {
  const access = await getManageAccess();
  if (!access) redirect(`/login?next=${encodeURIComponent(backTo)}`);
  if (access.role === "guest") redirect("/?err=Your account has view-only access.");
  return access;
}

export function canWriteMda(access: ManageAccess, mdaId: string | null): boolean {
  if (access.role === "super_admin") return true;
  if (!mdaId) return false;
  // Analysts without assignments may enter results across all MDAs; an
  // assignment list narrows that permission. MDA Admins always need one.
  if (access.role === "data_analyst" && access.mdaIds.length === 0) return true;
  return access.mdaIds.includes(mdaId);
}

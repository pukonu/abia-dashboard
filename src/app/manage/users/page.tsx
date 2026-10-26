import { redirect } from "next/navigation";
import { Flash } from "@/components/forms";
import { Crumbs, PageHeader, SectionTitle } from "@/components/ui";
import { MANAGE_ROLE_OPTIONS } from "@/lib/manage-access";
import { getServerUser } from "@/lib/supabase-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { createManageUser, deleteManageUser, updateManageUserAccess } from "../auth-actions";

const selectClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80";

/** Role picker plus MDA / LGA assignments, shared by the create and edit forms. */
function AccessFields({
  mdas,
  lgas,
  role = "data_analyst",
  mdaIds = [],
  lgaIds = [],
}: {
  mdas: Array<{ id: string; label: string }>;
  lgas: Array<{ id: string; label: string }>;
  role?: string;
  mdaIds?: string[];
  lgaIds?: string[];
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-zinc-700">Role</span>
        <select name="role" defaultValue={role} className={selectClass}>
          {MANAGE_ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-zinc-700">MDAs (MDA admins, optional for analysts)</span>
        <select name="mda_ids" multiple defaultValue={mdaIds} className={`${selectClass} h-24`}>
          {mdas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-zinc-700">LGAs (LGA officers)</span>
        <select name="lga_ids" multiple defaultValue={lgaIds} className={`${selectClass} h-24`}>
          {lgas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export const metadata = { title: "Manage users" };

export default async function ManageUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const currentUser = await getServerUser();
  if (!currentUser) redirect("/login?next=/manage/users");

  const admin = getAdminClient();
  if (!admin) {
    return (
      <>
        <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Users" }]} />
        <PageHeader
          eyebrow="Administration"
          title="Manage users"
          subtitle="Create and manage who can access the management console."
        />
        <div className="card card-pad text-sm text-zinc-500">
          `SUPABASE_SERVICE_ROLE_KEY` is not configured, so user management is unavailable.
        </div>
      </>
    );
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = error ? [] : data.users;

  const [roles, mdaAssignments, lgaAssignments, mdaRows, lgaRows] = await Promise.all([
    admin.from("manage_user_roles").select("user_id, role"),
    admin.from("manage_user_mdas").select("user_id, mda_id"),
    admin.from("manage_user_lgas").select("user_id, lga_id"),
    admin.from("mdas").select("id, name, abbreviation").order("name"),
    admin.from("lgas").select("id, name").order("name"),
  ]);
  const roleByUser = new Map((roles.data ?? []).map((r) => [r.user_id as string, r.role as string]));
  const mdasByUser = new Map<string, string[]>();
  for (const a of mdaAssignments.data ?? []) mdasByUser.set(a.user_id, [...(mdasByUser.get(a.user_id) ?? []), a.mda_id]);
  const lgasByUser = new Map<string, string[]>();
  for (const a of lgaAssignments.data ?? []) lgasByUser.set(a.user_id, [...(lgasByUser.get(a.user_id) ?? []), a.lga_id]);
  const mdaOptions = (mdaRows.data ?? []).map((m) => ({
    id: m.id as string,
    label: m.abbreviation ? `${m.name} (${m.abbreviation})` : (m.name as string),
  }));
  const lgaOptions = (lgaRows.data ?? []).map((l) => ({ id: l.id as string, label: l.name as string }));
  const roleLabel = (role: string | undefined) =>
    MANAGE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? "Guest (no role set)";

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Users" }]} />
      <PageHeader
        eyebrow="Administration"
        title="Manage users"
        subtitle="Only signed-in users can access the management console and enter data. Roles and MDA / LGA assignments decide what the PWA and mobile app may save."
      />
      <Flash msg={msg} err={err ?? (error ? error.message : undefined)} />

      <SectionTitle>Create user</SectionTitle>
      <form action={createManageUser} className="card card-pad grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-700">Email</span>
          <input
            type="email"
            name="email"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-700">Temporary password</span>
          <input
            type="password"
            name="password"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
          />
        </label>
        <AccessFields mdas={mdaOptions} lgas={lgaOptions} />
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Create user
          </button>
        </div>
      </form>

      <SectionTitle hint={`${users.length} account${users.length === 1 ? "" : "s"}`}>Current users</SectionTitle>
      <div className="card overflow-hidden">
        <div className="divide-y divide-zinc-100">
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-900">{user.email ?? user.id}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  Created {new Date(user.created_at).toLocaleString("en-NG")}
                  {user.last_sign_in_at ? ` · Last sign-in ${new Date(user.last_sign_in_at).toLocaleString("en-NG")}` : " · Never signed in"}
                  {user.id === currentUser.id ? " · Current session" : ""}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-700">
                    {roleLabel(roleByUser.get(user.id))}
                    {(mdasByUser.get(user.id)?.length ?? 0) > 0 ? ` · ${mdasByUser.get(user.id)!.length} MDA(s)` : ""}
                    {(lgasByUser.get(user.id)?.length ?? 0) > 0 ? ` · ${lgasByUser.get(user.id)!.length} LGA(s)` : ""}
                    {" "}· edit access
                  </summary>
                  <form action={updateManageUserAccess} className="mt-3 grid gap-3 sm:grid-cols-3">
                    <input type="hidden" name="user_id" value={user.id} />
                    <AccessFields
                      mdas={mdaOptions}
                      lgas={lgaOptions}
                      role={roleByUser.get(user.id) ?? "guest"}
                      mdaIds={mdasByUser.get(user.id) ?? []}
                      lgaIds={lgasByUser.get(user.id) ?? []}
                    />
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
                      >
                        Save access
                      </button>
                    </div>
                  </form>
                </details>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    user.banned_until
                      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  }`}
                >
                  {user.banned_until ? "Disabled" : "Active"}
                </span>
                {user.id !== currentUser.id && (
                  <form action={deleteManageUser}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

import { redirect } from "next/navigation";
import { Flash } from "@/components/forms";
import { Crumbs, PageHeader, SectionTitle } from "@/components/ui";
import { getServerUser } from "@/lib/supabase-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { createManageUser, deleteManageUser } from "../auth-actions";

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

  return (
    <>
      <Crumbs items={[{ href: "/manage", label: "Manage" }, { label: "Users" }]} />
      <PageHeader
        eyebrow="Administration"
        title="Manage users"
        subtitle="Only signed-in users can access the management console and enter data."
      />
      <Flash msg={msg} err={err ?? (error ? error.message : undefined)} />

      <SectionTitle>Create user</SectionTitle>
      <form action={createManageUser} className="card card-pad grid gap-4 sm:grid-cols-2">
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

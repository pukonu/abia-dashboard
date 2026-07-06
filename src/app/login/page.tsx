import { redirect } from "next/navigation";
import { Flash } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { getServerUser } from "@/lib/supabase-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { bootstrapManageUser, signInManageUser } from "../manage/auth-actions";

export const metadata = { title: "Manage sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; msg?: string; err?: string }>;
}) {
  const { next, msg, err } = await searchParams;
  const user = await getServerUser();
  const safeNext = next && next.startsWith("/manage") ? next : "/manage";
  if (user) {
    redirect(safeNext);
  }

  const admin = getAdminClient();
  const firstUserCheck = admin ? await admin.auth.admin.listUsers({ page: 1, perPage: 1 }) : null;
  const needsBootstrap = !firstUserCheck?.error && (firstUserCheck?.data?.users ?? []).length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Manage access"
        title="Sign in to manage data"
        subtitle="Public dashboards remain open to everyone. Only signed-in users can access the management console and enter data."
      />
      <div className="mx-auto max-w-md">
        <Flash msg={msg} err={err} />
        <form action={needsBootstrap ? bootstrapManageUser : signInManageUser} className="card card-pad space-y-4">
          <input type="hidden" name="next" value={safeNext} />
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500">
            {needsBootstrap
              ? "No manage user exists yet. Create the first account here, then use Manage Users inside the console for additional accounts."
              : "Use your manage account to enter data and administer the console."}
          </div>
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
            <span className="mb-1 block text-xs font-semibold text-zinc-700">Password</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            {needsBootstrap ? "Create first manage user" : "Sign in"}
          </button>
        </form>
      </div>
    </>
  );
}

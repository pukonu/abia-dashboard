import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser, isAuthConfigured } from "@/lib/supabase-auth";
import { signOutManageUser } from "./auth-actions";

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAuthConfigured()) {
    return (
      <div className="card card-pad">
        <h2 className="text-base font-semibold text-zinc-900">Manage access is not configured</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env` to enable
          login for the management console.
        </p>
      </div>
    );
  }

  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/manage");
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Manage access</div>
          <div className="mt-1 text-sm font-medium text-zinc-900">{user.email ?? "Signed-in user"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/manage/users"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Manage users
          </Link>
          <form action={signOutManageUser}>
            <button
              type="submit"
              className="rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </>
  );
}

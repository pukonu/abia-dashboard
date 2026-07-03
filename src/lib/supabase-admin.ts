import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side writes (manage forms,
 * CSV import, evidence uploads). Bypasses RLS — never expose to the client.
 */
export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function evidenceBucket(): string {
  return process.env.NEXT_PUBLIC_EVIDENCE_BUCKET || "evidence";
}

/** Creates the evidence bucket on first use; ignores "already exists". */
export async function ensureEvidenceBucket(admin: SupabaseClient): Promise<void> {
  await admin.storage.createBucket(evidenceBucket(), { public: true }).catch(() => {});
}

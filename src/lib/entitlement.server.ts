import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;

/** Ensure every authenticated user has a profiles row before reading/consuming free credits. */
export async function ensureUserProfile(
  admin: AdminClient,
  userId: string,
  opts: { email?: string; name?: string } = {},
): Promise<void> {
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  const email = (opts.email?.trim() || `${userId}@users.local`).slice(0, 320);
  const name =
    opts.name?.trim() ||
    (email.includes("@") ? email.split("@")[0] : "User");

  const { error } = await admin.from("profiles").insert({
    user_id: userId,
    email,
    name: name.slice(0, 200),
  });

  // Race: another request may have created the row between select and insert.
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn("[entitlement] ensureUserProfile insert failed", error.message);
  }
}

export async function readFilesProcessed(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("files_processed")
    .eq("user_id", userId)
    .maybeSingle();

  return profile?.files_processed ?? 0;
}

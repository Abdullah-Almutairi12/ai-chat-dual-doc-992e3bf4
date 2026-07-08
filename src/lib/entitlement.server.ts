import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;

/** Ensure every authenticated user has a profiles row before reading/consuming free credits. Never throws. */
export async function ensureUserProfile(
  admin: AdminClient,
  userId: string,
  opts: { email?: string; name?: string } = {},
): Promise<void> {
  try {
    const { data: existing, error: readError } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (readError) {
      console.warn("[entitlement] ensureUserProfile read failed", readError.message);
      return;
    }
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

    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn("[entitlement] ensureUserProfile insert failed", error.message);
    }
  } catch (err) {
    console.warn("[entitlement] ensureUserProfile unexpected error", err);
  }
}

export async function readFilesProcessed(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("files_processed")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[entitlement] readFilesProcessed failed", error.message);
      return 0;
    }

    return profile?.files_processed ?? 0;
  } catch (err) {
    console.warn("[entitlement] readFilesProcessed unexpected error", err);
    return 0;
  }
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

/** Whether the current signed-in user is an admin, and whether any admin exists yet. */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    return { isAdmin: !!isAdmin, adminExists: (count ?? 0) > 0 };
  });

/** Bootstrap: grant admin to the current user ONLY if no admin exists yet. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      throw new Error("An admin already exists. Ask an existing admin for access.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOverviewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: profiles }, { data: documents }, { data: transactions }] = await Promise.all([
      context.supabase.from("profiles").select("id, credits, tier, created_at"),
      context.supabase.from("documents").select("id, created_at"),
      context.supabase.from("transactions").select("amount, status, created_at"),
    ]);

    const totalUsers = profiles?.length ?? 0;
    const totalDocuments = documents?.length ?? 0;
    const premiumUsers = (profiles ?? []).filter((p: any) => p.tier === "premium").length;
    const totalRevenue = (transactions ?? [])
      .filter((t: any) => t.status === "succeeded")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    const creditsUsed = (profiles ?? []).reduce(
      (sum: number, p: any) => sum + Math.max(0, 1000 - Number(p.credits)),
      0,
    );

    // Monthly trends for the last 6 months
    const months: { key: string; label: string; users: number; documents: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en", { month: "short" }),
        users: 0,
        documents: 0,
      });
    }
    const bucket = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };
    (profiles ?? []).forEach((p: any) => {
      const m = months.find((x) => x.key === bucket(p.created_at));
      if (m) m.users += 1;
    });
    (documents ?? []).forEach((doc: any) => {
      const m = months.find((x) => x.key === bucket(doc.created_at));
      if (m) m.documents += 1;
    });

    return {
      totalUsers,
      totalDocuments,
      totalRevenue,
      creditsUsed,
      premiumUsers,
      trends: months.map((m) => ({ label: m.label, users: m.users, documents: m.documents })),
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, name, email, tier, credits, banned, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; tier?: string; credits?: number; banned?: boolean }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const patch: { tier?: string; credits?: number; banned?: boolean } = {};
    if (data.tier !== undefined) patch.tier = data.tier;
    if (data.credits !== undefined) patch.credits = data.credits;
    if (data.banned !== undefined) patch.banned = data.banned;
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, user_email, file_name, file_size, tool_used, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, invoice_id, user_email, amount, currency, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("system_settings")
      .select("key, value, label")
      .order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { key: string; value: string }) => data)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("system_settings")
      .update({ value: data.value, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
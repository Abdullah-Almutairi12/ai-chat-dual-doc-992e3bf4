/** Resolve Supabase config from Vercel / local env (multiple naming conventions). */

/**
 * Runtime server env lookup. Uses bracket access so Vite/Nitro do not inline
 * missing values at build time — required for Vercel secrets that exist only at
 * runtime (SUPABASE_SERVICE_ROLE_KEY, TAP_SECRET_KEY, etc.).
 */
export function readServerEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const raw = process.env[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function readPublicEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined") {
    const fromImport = (import.meta.env as Record<string, string | undefined>)[key];
    if (typeof fromImport === "string" && fromImport.trim()) return fromImport.trim();
  }
  return readServerEnv(key);
}

function firstPublicEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readPublicEnv(key);
    if (value) return value;
  }
  return undefined;
}

function firstServerEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readServerEnv(key);
    if (value) return value;
  }
  return undefined;
}

export function resolveSupabaseUrl(): string | undefined {
  return firstPublicEnv("SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
}

export function resolveSupabasePublishableKey(): string | undefined {
  return firstPublicEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export function resolveSupabaseServiceRoleKey(): string | undefined {
  return firstServerEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

export function missingSupabasePublicEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSupabaseUrl()) missing.push("SUPABASE_URL");
  if (!resolveSupabasePublishableKey()) {
    missing.push("SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)");
  }
  return missing;
}

export function missingSupabaseServiceEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSupabaseUrl()) missing.push("SUPABASE_URL");
  if (!resolveSupabaseServiceRoleKey()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export function supabaseEnvError(missing: string[]): string {
  return (
    `Missing Supabase environment variable(s): ${missing.join(", ")}. ` +
    "Add them in Vercel → Project Settings → Environment Variables " +
    "(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY; " +
    "SUPABASE_SERVICE_ROLE_KEY for server-side billing and admin routes). " +
    "After saving, redeploy Production so server functions pick up runtime secrets."
  );
}

/** Server-only billing secrets — never read from import.meta.env. */
export function resolveTapSecretKey(): string | undefined {
  return readServerEnv("TAP_SECRET_KEY");
}

export function isTapLiveMode(): boolean {
  return (resolveTapSecretKey() ?? "").startsWith("sk_live_");
}

export function missingBillingServerEnv(): string[] {
  const missing: string[] = [];
  if (missingSupabaseServiceEnv().length) missing.push(...missingSupabaseServiceEnv());
  if (!resolveTapSecretKey()) missing.push("TAP_SECRET_KEY");
  return [...new Set(missing)];
}

export function billingEnvError(missing: string[]): string {
  return (
    `Missing billing environment variable(s): ${missing.join(", ")}. ` +
    "Add them in Vercel → Project Settings → Environment Variables for Production, " +
    "then redeploy (or run vercel --prod)."
  );
}

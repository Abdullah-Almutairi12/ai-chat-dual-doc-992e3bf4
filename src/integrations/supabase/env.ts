/** Resolve Supabase config from Vercel / local env (multiple naming conventions). */

import {
  SERVER_ENV_ALIASES,
  readServerEnv,
  readServerEnvAlias,
  firstServerEnv,
} from "@/lib/runtime-env";

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

export { readServerEnv, firstServerEnv } from "@/lib/runtime-env";

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
  return readServerEnvAlias(SERVER_ENV_ALIASES.supabaseServiceRole);
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
    "SUPABASE_SERVICE_ROLE_KEY for server-side billing and admin routes)."
  );
}

export function resolveTapSecretKey(): string | undefined {
  return readServerEnvAlias(SERVER_ENV_ALIASES.tapSecret);
}

export function isTapLiveMode(): boolean {
  return (resolveTapSecretKey() ?? "").startsWith("sk_live_");
}

/** Billing secrets only — no extra gates (URL is checked separately at checkout). */
export function missingBillingServerEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSupabaseServiceRoleKey()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!resolveTapSecretKey()) missing.push("TAP_SECRET_KEY");
  return missing;
}

export function billingEnvError(missing: string[]): string {
  if (missing.length === 0) return "";
  return (
    `Missing billing environment variable(s): ${missing.join(", ")}. ` +
    "Add them in Vercel → Project Settings → Environment Variables (Production), then redeploy."
  );
}

export function getBillingEnvDiagnostics() {
  const missing = missingBillingServerEnv();
  return {
    ok: missing.length === 0,
    hasSupabaseUrl: Boolean(resolveSupabaseUrl()),
    hasServiceRole: Boolean(resolveSupabaseServiceRoleKey()),
    hasTapSecret: Boolean(resolveTapSecretKey()),
    missing,
  };
}

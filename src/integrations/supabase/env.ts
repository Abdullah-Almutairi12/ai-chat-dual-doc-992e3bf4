/** Public Supabase config (safe for client + server public reads). */

import { readServerEnv } from "@/lib/runtime-env";

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

export function missingSupabasePublicEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSupabaseUrl()) missing.push("SUPABASE_URL");
  if (!resolveSupabasePublishableKey()) {
    missing.push("SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)");
  }
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

/** Server secrets: import from @/integrations/supabase/env.server inside handlers only. */

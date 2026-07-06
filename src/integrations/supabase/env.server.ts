/**
 * SERVER-ONLY secrets and billing env.
 * Import only from:
 *   - *.server.ts modules
 *   - dynamic import() inside server route / serverFn handlers
 * NEVER import this file from client components or env.ts.
 */

declare global {
  var __PDFQUANTA_REQUEST_ENV__: Record<string, string> | undefined;
}

const SERVICE_ROLE_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_KEY",
] as const;

const TAP_SECRET_KEYS = ["TAP_SECRET_KEY"] as const;

function normalize(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Strip quotes, Bearer prefix, and newlines accidentally pasted into Vercel env. */
export function sanitizeTapSecretKey(raw: string): string {
  let key = raw.trim().replace(/^['"]|['"]$/g, "");
  if (key.toLowerCase().startsWith("bearer ")) {
    key = key.slice(7).trim();
  }
  key = key.replace(/[\r\n]+/g, "");
  return key;
}

export function isValidTapSecretKey(key: string): boolean {
  return /^sk_(test|live)_[A-Za-z0-9]+$/.test(key);
}

/**
 * Sync live Vercel Production env into memory before reading secrets.
 * Call at the start of every server API handler that needs billing keys.
 */
export function hydrateVercelProductionEnv(platformEnv?: unknown): void {
  const bag: Record<string, string> = {};

  if (typeof process !== "undefined" && process.env) {
    for (const key of Object.keys(process.env)) {
      const value = normalize(process.env[key]);
      if (value) bag[key] = value;
    }
  }

  if (platformEnv && typeof platformEnv === "object") {
    for (const [key, value] of Object.entries(platformEnv as Record<string, unknown>)) {
      const normalized = normalize(value);
      if (normalized) bag[key] = normalized;
    }
  }

  globalThis.__PDFQUANTA_REQUEST_ENV__ = bag;
}

/** Bracket lookup — Vite must not inline these at build time. */
function readKey(name: string): string | undefined {
  const fromBag = normalize(globalThis.__PDFQUANTA_REQUEST_ENV__?.[name]);
  if (fromBag) return fromBag;

  if (typeof process !== "undefined" && process.env) {
    const fromProcess = normalize(process.env[name]);
    if (fromProcess) return fromProcess;
  }

  return undefined;
}

function readKeyInsensitive(name: string): string | undefined {
  const direct = readKey(name);
  if (direct) return direct;

  const target = name.toLowerCase();
  const sources: Array<Record<string, string | undefined>> = [];

  if (globalThis.__PDFQUANTA_REQUEST_ENV__) {
    sources.push(globalThis.__PDFQUANTA_REQUEST_ENV__);
  }
  if (typeof process !== "undefined" && process.env) {
    sources.push(process.env as Record<string, string | undefined>);
  }

  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (key.toLowerCase() !== target) continue;
      const value = normalize(source[key]);
      if (value) return value;
    }
  }

  return undefined;
}

function firstKey(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = readKeyInsensitive(name);
    if (value) return value;
  }
  return undefined;
}

export function resolveSupabaseServiceRoleKey(): string | undefined {
  return firstKey(SERVICE_ROLE_KEYS);
}

export function resolveTapSecretKey(): string | undefined {
  const raw = firstKey(TAP_SECRET_KEYS);
  if (!raw) return undefined;
  const key = sanitizeTapSecretKey(raw);
  return isValidTapSecretKey(key) ? key : undefined;
}

export function isTapLiveMode(): boolean {
  return (resolveTapSecretKey() ?? "").startsWith("sk_live_");
}

export function missingSupabaseServiceEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSupabaseServiceRoleKey()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export function supabaseEnvError(missing: string[]): string {
  return (
    `Missing Supabase environment variable(s): ${missing.join(", ")}. ` +
    "Add them in Vercel → Project Settings → Environment Variables."
  );
}

export { readServerEnvAlias, SERVER_ENV_ALIASES } from "@/lib/runtime-env";

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
  hydrateVercelProductionEnv();

  const missing = missingBillingServerEnv();
  const envKeys =
    typeof process !== "undefined" && process.env
      ? Object.keys(process.env).filter(
          (k) => k.includes("SUPABASE") || k.includes("TAP") || k.includes("VERCEL"),
        )
      : [];

  return {
    ok: missing.length === 0,
    hasServiceRole: Boolean(resolveSupabaseServiceRoleKey()),
    hasTapSecret: Boolean(resolveTapSecretKey()),
    missing,
    runtime: typeof process !== "undefined" ? "node" : "edge",
    preset: normalize(process.env?.NITRO_PRESET) ?? "unknown",
    matchedEnvKeyNames: envKeys.sort(),
  };
}

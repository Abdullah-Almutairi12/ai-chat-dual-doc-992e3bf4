/**
 * Server env access for Vercel Production, Cloudflare Workers, and local Node.
 * Always use readServerEnv() — never static process.env.KEY (Vite inlines at build).
 */

type EnvBag = Record<string, string | undefined>;

let requestEnvStore: EnvBag | undefined;

function isServerRuntime(): boolean {
  return typeof window === "undefined";
}

function normalizeEnvValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Called at the start of each server fetch (see src/server.ts). */
export function bindRequestEnv(env: unknown): void {
  const bag: EnvBag = {};

  // Vercel Production: secrets are on process.env at request time.
  if (typeof process !== "undefined" && process.env) {
    for (const key of Object.keys(process.env)) {
      const value = normalizeEnvValue(process.env[key]);
      if (value) bag[key] = value;
    }
  }

  // Cloudflare / edge bindings override or supplement process.env.
  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      const normalized = normalizeEnvValue(value);
      if (normalized) bag[key] = normalized;
    }
  }

  requestEnvStore = Object.keys(bag).length > 0 ? bag : undefined;
}

export function clearRequestEnv(): void {
  requestEnvStore = undefined;
}

/** Dynamic lookup — not replaced by Vite at build time. */
export function readServerEnv(key: string): string | undefined {
  // Lazy-init from process.env when no request binding ran yet (server functions).
  if (!requestEnvStore && typeof process !== "undefined" && process.env) {
    bindRequestEnv(undefined);
  }

  const fromStore = normalizeEnvValue(requestEnvStore?.[key]);
  if (fromStore) return fromStore;

  if (typeof process !== "undefined" && process.env) {
    const fromProcess = normalizeEnvValue(process.env[key]);
    if (fromProcess) return fromProcess;
  }

  // Vercel build may embed SUPABASE_* / APP_* into the server bundle via envPrefix.
  if (isServerRuntime() && typeof import.meta !== "undefined") {
    const fromMeta = normalizeEnvValue(
      (import.meta.env as Record<string, string | undefined>)[key],
    );
    if (fromMeta) return fromMeta;
  }

  return undefined;
}

export function firstServerEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readServerEnv(key);
    if (value) return value;
  }
  return undefined;
}

export const SERVER_ENV_ALIASES = {
  supabaseServiceRole: [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_KEY",
  ],
  tapSecret: ["TAP_SECRET_KEY", "TAP_API_KEY", "TAP_SECRET"],
  cronSecret: ["CRON_SECRET"],
  resendApiKey: ["RESEND_API_KEY"],
  appOrigin: ["APP_ORIGIN", "VERCEL_URL", "VITE_APP_ORIGIN"],
  tapWebhookUrl: ["TAP_WEBHOOK_URL"],
} as const;

export function readServerEnvAlias(aliases: readonly string[]): string | undefined {
  return firstServerEnv(...aliases);
}

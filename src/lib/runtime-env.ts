/**
 * Per-request env binding (used by src/server.ts).
 * For billing secrets use @/integrations/supabase/env.server instead.
 */

declare global {
  var __PDFQUANTA_REQUEST_ENV__: Record<string, string> | undefined;
}

type EnvBag = Record<string, string>;

function normalize(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildEnvBag(platformEnv: unknown): EnvBag {
  const bag: EnvBag = {};

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

  return bag;
}

/** Called at the start of each server fetch (see src/server.ts). */
export function bindRequestEnv(env: unknown): void {
  globalThis.__PDFQUANTA_REQUEST_ENV__ = buildEnvBag(env);
}

export function clearRequestEnv(): void {
  globalThis.__PDFQUANTA_REQUEST_ENV__ = undefined;
}

/** Public/non-secret server reads only. Secrets → env.server.ts */
export function readServerEnv(key: string): string | undefined {
  if (!globalThis.__PDFQUANTA_REQUEST_ENV__ && typeof process !== "undefined" && process.env) {
    globalThis.__PDFQUANTA_REQUEST_ENV__ = buildEnvBag(undefined);
  }

  const bag = globalThis.__PDFQUANTA_REQUEST_ENV__;
  if (bag?.[key]) return bag[key];

  if (typeof process !== "undefined" && process.env) {
    return normalize(process.env[key]);
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
  tapSecret: ["TAP_SECRET_KEY"],
  cronSecret: ["CRON_SECRET"],
  resendApiKey: ["RESEND_API_KEY"],
  appOrigin: ["APP_ORIGIN", "VERCEL_URL", "VITE_APP_ORIGIN"],
  tapWebhookUrl: ["TAP_WEBHOOK_URL"],
} as const;

export function readServerEnvAlias(aliases: readonly string[]): string | undefined {
  return firstServerEnv(...aliases);
}

import { createClient } from "@supabase/supabase-js";

import { hydrateVercelProductionEnv } from "@/integrations/supabase/env.server";
import type { Database } from "@/integrations/supabase/types";
import {
  missingSupabasePublicEnv,
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
  supabaseEnvError,
} from "@/integrations/supabase/env";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConfigError";
  }
}

export type RequestAuth = {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
  email: string;
};

/** Validate Bearer JWT on API routes (same rules as serverFn auth middleware). */
export async function authenticateRequest(request: Request): Promise<RequestAuth> {
  hydrateVercelProductionEnv();

  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_PUBLISHABLE_KEY = resolveSupabasePublishableKey();
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new ApiConfigError(supabaseEnvError(missingSupabasePublicEnv()));
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("Unauthorized");
  }

  const email =
    typeof data.claims.email === "string"
      ? data.claims.email
      : typeof (data.claims as { user_email?: string }).user_email === "string"
        ? (data.claims as { user_email: string }).user_email
        : "";

  return { supabase, userId: data.claims.sub, email };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function unauthorizedResponse(): Response {
  return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
}

export function configErrorResponse(err: ApiConfigError): Response {
  return jsonResponse({ ok: false, error: err.message, code: "SERVER_NOT_CONFIGURED" }, 503);
}

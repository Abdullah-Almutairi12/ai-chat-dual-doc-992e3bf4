import { AuthError, createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  missingSupabasePublicEnv,
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
  supabaseEnvError,
} from "./env";

export type SupabaseBrowserClient = ReturnType<typeof createClient<Database>>;

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

/** True when public Supabase env vars are available in this runtime. */
export function isSupabaseConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabasePublishableKey());
}

const NOT_CONFIGURED = new AuthError("Supabase is not configured", 503, "supabase_not_configured");

function createAuthStub(): SupabaseBrowserClient["auth"] {
  const noopSub = { subscription: { unsubscribe: () => {} } };
  const emptySession = { data: { session: null }, error: null as AuthError | null };
  const emptyUser = { data: { user: null }, error: null as AuthError | null };
  const fail = { data: { user: null, session: null }, error: NOT_CONFIGURED };

  return {
    getSession: async () => emptySession,
    getUser: async () => emptyUser,
    onAuthStateChange: () => noopSub,
    signInWithPassword: async () => fail,
    signUp: async () => fail,
    signOut: async () => ({ error: null }),
    exchangeCodeForSession: async () => fail,
    signInWithOAuth: async () => fail,
    refreshSession: async () => emptySession,
    setSession: async () => fail,
    updateUser: async () => fail,
    resetPasswordForEmail: async () => ({ data: {}, error: NOT_CONFIGURED }),
  } as SupabaseBrowserClient["auth"];
}

function createStorageStub(): SupabaseBrowserClient["storage"] {
  const err = { message: "Supabase is not configured" };
  return {
    from: () =>
      ({
        upload: async () => ({ data: null, error: err }),
        download: async () => ({ data: null, error: err }),
        remove: async () => ({ data: null, error: err }),
        list: async () => ({ data: null, error: err }),
      }) as ReturnType<SupabaseBrowserClient["storage"]["from"]>,
  } as SupabaseBrowserClient["storage"];
}

function createSupabaseClient(): SupabaseBrowserClient | null {
  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_PUBLISHABLE_KEY = resolveSupabasePublishableKey();

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const message = supabaseEnvError(missingSupabasePublicEnv());
    console.warn(`[Supabase] ${message} — public pages will render without auth.`);
    return null;
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}

let _supabase: SupabaseBrowserClient | null | undefined;
let _warnedMissing = false;

function getSupabaseClient(): SupabaseBrowserClient | null {
  if (_supabase !== undefined) return _supabase;
  _supabase = createSupabaseClient();
  if (!_supabase && !_warnedMissing) {
    _warnedMissing = true;
  }
  return _supabase;
}

/** Lazy Supabase client — never throws; returns auth/storage stubs when env is missing. */
export const supabase = new Proxy({} as SupabaseBrowserClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    if (client) return Reflect.get(client, prop, receiver);
    if (prop === "auth") return createAuthStub();
    if (prop === "storage") return createStorageStub();
    if (prop === "from") {
      return () => ({
        select: async () => ({ data: null, error: NOT_CONFIGURED }),
        insert: async () => ({ data: null, error: NOT_CONFIGURED }),
        update: async () => ({ data: null, error: NOT_CONFIGURED }),
        delete: async () => ({ data: null, error: NOT_CONFIGURED }),
      });
    }
    return Reflect.get({} as SupabaseBrowserClient, prop, receiver);
  },
});

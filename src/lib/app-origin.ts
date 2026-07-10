/** Canonical app origin for auth redirects (Vercel / custom domain / local dev). */

import { firstServerEnv } from "@/lib/runtime-env";

export function resolveAppOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  const fromEnv =
    (typeof import.meta !== "undefined" &&
      (import.meta.env as Record<string, string | undefined>).APP_ORIGIN) ||
    firstServerEnv("APP_ORIGIN", "VERCEL_URL", "VITE_APP_ORIGIN");

  if (!fromEnv?.trim()) return "http://localhost:5173";

  const value = fromEnv.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  return `https://${value.replace(/\/$/, "")}`;
}

export function authCallbackUrl(nextPath = "/dashboard"): string {
  const origin = resolveAppOrigin();
  const next =
    typeof nextPath === "string" && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/dashboard";
  const url = new URL("/auth/callback", origin);
  if (next !== "/dashboard") url.searchParams.set("next", next);
  return url.toString();
}

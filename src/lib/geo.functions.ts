import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** ISO country codes of the 22 Arab League member states. */
const ARAB_COUNTRIES = new Set([
  "SA", "AE", "EG", "DZ", "BH", "DJ", "IQ", "JO", "KW", "LB", "LY",
  "MA", "MR", "OM", "PS", "QA", "SO", "SD", "SY", "TN", "YE", "KM",
]);

function firstIp(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0].trim();
}

/**
 * Detect the visitor's country from their IP and map it to a default UI
 * language. Prefers the edge/CDN-provided country header (no external call),
 * and falls back to a lightweight geo-IP API when unavailable.
 * Arab countries → Arabic, everything else → English.
 */
export const detectCountryLang = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ country: string | null; lang: "ar" | "en" }> => {
    const headers = getRequest().headers;

    // 1) Edge-provided country code (Cloudflare / other CDNs) — instant, no fetch.
    let country =
      headers.get("cf-ipcountry") ??
      headers.get("x-vercel-ip-country") ??
      headers.get("x-country-code") ??
      "";

    // 2) Fallback: lightweight geo-IP lookup using the client IP.
    if (!country || country === "XX" || country === "T1") {
      const ip = firstIp(
        headers.get("cf-connecting-ip") ??
          headers.get("x-forwarded-for") ??
          headers.get("x-real-ip"),
      );
      try {
        const url = ip ? `https://ipapi.co/${ip}/country/` : "https://ipapi.co/country/";
        const res = await fetch(url, { headers: { "User-Agent": "pdfquanta/1.0" } });
        if (res.ok) {
          const text = (await res.text()).trim();
          if (/^[A-Za-z]{2}$/.test(text)) country = text;
        }
      } catch {
        // Network/geo failure → safe default (English) below.
      }
    }

    const code = country.toUpperCase();
    const lang = ARAB_COUNTRIES.has(code) ? "ar" : "en";
    return { country: code || null, lang };
  },
);

import { resolveAppOrigin } from "@/lib/app-origin";

function siteUrl(): string {
  return resolveAppOrigin();
}

function ogImage(): string {
  return `${siteUrl()}/og-image.jpg`;
}

/**
 * Build a route head() config with title, description, Open Graph / Twitter
 * card tags, and a self-referencing canonical URL for the active domain.
 */
export function pageHead(opts: { path: string; title: string; description: string }) {
  const url = `${siteUrl()}${opts.path}`;
  const image = ogImage();
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

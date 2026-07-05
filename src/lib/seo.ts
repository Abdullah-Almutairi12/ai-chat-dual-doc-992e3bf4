const SITE_URL = "https://pdfquanta.online";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

/**
 * Build a route head() config with title, description, Open Graph / Twitter
 * card tags, and a self-referencing canonical URL pointing at the HTTPS
 * custom domain. Use for shareable leaf routes.
 */
export function pageHead(opts: { path: string; title: string; description: string }) {
  const url = `${SITE_URL}${opts.path}`;
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

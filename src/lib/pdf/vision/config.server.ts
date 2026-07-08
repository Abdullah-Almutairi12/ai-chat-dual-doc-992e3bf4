import { hydrateVercelProductionEnv } from "@/integrations/supabase/env.server";

export type VisionProvider = "openai" | "anthropic";

export type VisionConfig = {
  /** At least one provider API key is present. */
  configured: boolean;
  /** Provider selected from env + key availability (used first). */
  provider: VisionProvider;
  /** Raw VISION_AI_PROVIDER preference before key-based fallback. */
  preferredProvider: VisionProvider;
  /** True when the preferred provider key was missing and the other key was used. */
  keyFallback: boolean;
  openaiKey?: string;
  anthropicKey?: string;
  /** OpenAI vision model — defaults to gpt-4o. */
  openaiModel: string;
  anthropicModel: string;
};

const OPENAI_KEY_NAMES = ["OPENAI_API_KEY"] as const;
const ANTHROPIC_KEY_NAMES = ["ANTHROPIC_API_KEY"] as const;

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

function readEnv(name: string): string | undefined {
  const fromBag = globalThis.__PDFQUANTA_REQUEST_ENV__?.[name]?.trim();
  if (fromBag) return fromBag;
  const fromProcess = process.env[name]?.trim();
  return fromProcess || undefined;
}

function firstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return undefined;
}

export function parseVisionProvider(raw: string | undefined): VisionProvider {
  const normalized = (raw ?? "openai").toLowerCase().trim();
  return normalized === "anthropic" ? "anthropic" : "openai";
}

/** Pick active provider: honor VISION_AI_PROVIDER, fall back to the other if its key is missing. */
export function resolveActiveProvider(
  preferred: VisionProvider,
  openaiKey?: string,
  anthropicKey?: string,
): { provider: VisionProvider; keyFallback: boolean } {
  const primaryKey = preferred === "openai" ? openaiKey : anthropicKey;
  if (primaryKey) return { provider: preferred, keyFallback: false };

  const alternate: VisionProvider = preferred === "openai" ? "anthropic" : "openai";
  const alternateKey = alternate === "openai" ? openaiKey : anthropicKey;
  if (alternateKey) return { provider: alternate, keyFallback: true };

  return { provider: preferred, keyFallback: false };
}

export function providerHasKey(config: VisionConfig, provider: VisionProvider): boolean {
  return provider === "openai" ? Boolean(config.openaiKey) : Boolean(config.anthropicKey);
}

export function modelForProvider(config: VisionConfig, provider: VisionProvider): string {
  return provider === "openai" ? config.openaiModel : config.anthropicModel;
}

export function alternateProvider(provider: VisionProvider): VisionProvider {
  return provider === "openai" ? "anthropic" : "openai";
}

/** Resolve Vision AI credentials from server env (never exposed to client). */
export function resolveVisionConfig(): VisionConfig {
  hydrateVercelProductionEnv();

  const openaiKey = firstEnv(OPENAI_KEY_NAMES);
  const anthropicKey = firstEnv(ANTHROPIC_KEY_NAMES);
  const preferredProvider = parseVisionProvider(readEnv("VISION_AI_PROVIDER"));
  const { provider, keyFallback } = resolveActiveProvider(preferredProvider, openaiKey, anthropicKey);

  const configured = Boolean(openaiKey || anthropicKey);

  if (keyFallback) {
    console.warn(
      `[vision] VISION_AI_PROVIDER=${preferredProvider} but key missing — using ${provider} instead`,
    );
  }

  return {
    configured,
    provider,
    preferredProvider,
    keyFallback,
    openaiKey,
    anthropicKey,
    openaiModel: readEnv("OPENAI_VISION_MODEL") ?? DEFAULT_OPENAI_MODEL,
    anthropicModel: readEnv("ANTHROPIC_VISION_MODEL") ?? DEFAULT_ANTHROPIC_MODEL,
  };
}

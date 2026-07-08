import { hydrateVercelProductionEnv } from "@/integrations/supabase/env.server";

export type VisionProvider = "openai" | "anthropic";

export type VisionConfig = {
  configured: boolean;
  provider: VisionProvider;
  openaiKey?: string;
  anthropicKey?: string;
  openaiModel: string;
  anthropicModel: string;
};

const OPENAI_KEY_NAMES = ["OPENAI_API_KEY"] as const;
const ANTHROPIC_KEY_NAMES = ["ANTHROPIC_API_KEY"] as const;

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

/** Resolve Vision AI credentials from server env (never exposed to client). */
export function resolveVisionConfig(): VisionConfig {
  hydrateVercelProductionEnv();

  const openaiKey = firstEnv(OPENAI_KEY_NAMES);
  const anthropicKey = firstEnv(ANTHROPIC_KEY_NAMES);
  const providerRaw = (readEnv("VISION_AI_PROVIDER") ?? "openai").toLowerCase();
  const provider: VisionProvider =
    providerRaw === "anthropic" && anthropicKey
      ? "anthropic"
      : openaiKey
        ? "openai"
        : anthropicKey
          ? "anthropic"
          : "openai";

  const configured = provider === "anthropic" ? Boolean(anthropicKey) : Boolean(openaiKey);

  return {
    configured,
    provider,
    openaiKey,
    anthropicKey,
    openaiModel: readEnv("OPENAI_VISION_MODEL") ?? "gpt-4o",
    anthropicModel: readEnv("ANTHROPIC_VISION_MODEL") ?? "claude-3-5-sonnet-20241022",
  };
}

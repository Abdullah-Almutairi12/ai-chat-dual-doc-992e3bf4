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
  /** OpenAI-compatible API base (cloud / Azure / OpenRouter). */
  openaiBaseUrl: string;
  /** OpenAI vision model — defaults to gpt-4o. */
  openaiModel: string;
  anthropicModel: string;
};

const OPENAI_KEY_NAMES = ["OPENAI_API_KEY", "AZURE_OPENAI_API_KEY"] as const;
const ANTHROPIC_KEY_NAMES = ["ANTHROPIC_API_KEY"] as const;
const OPENAI_BASE_NAMES = ["OPENAI_API_BASE_URL", "OPENAI_BASE_URL", "AZURE_OPENAI_ENDPOINT"] as const;

const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";
// claude-3-5-sonnet-20241022 was retired by Anthropic on 2025-10-28 — every
// vision call silently failed and fell back to the old client-side renderer.
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

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

/**
 * Retired/deprecated model snapshots → current replacement. Guards against a
 * stale env var (or an old default baked into a previous deploy) silently
 * failing every single AI call forever with no visible error to the user.
 */
const RETIRED_MODEL_REPLACEMENTS: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "claude-sonnet-5",
  "claude-3-5-sonnet-20240620": "claude-sonnet-5",
  "claude-3-7-sonnet-20250219": "claude-sonnet-5",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5-20251001",
  "claude-3-haiku-20240307": "claude-haiku-4-5-20251001",
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "claude-opus-4-20250514": "claude-opus-4-8",
  "gpt-4-vision-preview": "gpt-5.5",
  "gpt-4-32k": "gpt-5.5",
};

function resolveModelId(raw: string): string {
  const replacement = RETIRED_MODEL_REPLACEMENTS[raw.trim()];
  if (replacement) {
    console.warn(`[vision] model "${raw}" is retired — using "${replacement}" instead`);
    return replacement;
  }
  return raw;
}

function normalizeOpenAiBase(raw: string | undefined): string {
  const trimmed = (raw ?? DEFAULT_OPENAI_BASE).trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) return trimmed;
  if (trimmed.includes("/openai/deployments/")) return trimmed;
  return `${trimmed}/v1`;
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
    openaiBaseUrl: normalizeOpenAiBase(firstEnv(OPENAI_BASE_NAMES)),
    openaiModel: resolveModelId(readEnv("OPENAI_VISION_MODEL") ?? readEnv("AZURE_OPENAI_DEPLOYMENT") ?? DEFAULT_OPENAI_MODEL),
    anthropicModel: resolveModelId(readEnv("ANTHROPIC_VISION_MODEL") ?? DEFAULT_ANTHROPIC_MODEL),
  };
}

/** Safe diagnostics for admin / health checks (never exposes keys). */
export function getVisionEnvDiagnostics() {
  hydrateVercelProductionEnv();
  const config = resolveVisionConfig();
  return {
    ok: config.configured,
    provider: config.provider,
    preferredProvider: config.preferredProvider,
    keyFallback: config.keyFallback,
    openaiModel: config.openaiModel,
    anthropicModel: config.anthropicModel,
    openaiBaseUrl: config.openaiBaseUrl,
    hasOpenAiKey: Boolean(config.openaiKey),
    hasAnthropicKey: Boolean(config.anthropicKey),
  };
}

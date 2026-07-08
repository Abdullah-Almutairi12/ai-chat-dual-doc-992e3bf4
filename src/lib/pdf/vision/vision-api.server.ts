import {
  alternateProvider,
  modelForProvider,
  providerHasKey,
  type VisionConfig,
  type VisionProvider,
} from "@/lib/pdf/vision/config.server";
import {
  PPT_PAGE_SYSTEM_PROMPT,
  pptPageUserPrompt,
  WORD_PAGE_SYSTEM_PROMPT,
  wordPageUserPrompt,
} from "@/lib/pdf/vision/prompts.server";
import type { VisionConvertTool } from "@/lib/pdf/vision/schema";
import {
  VisionPageSchema,
  VisionSlideSchema,
  type VisionPage,
  type VisionSlide,
} from "@/lib/pdf/vision/schema";

export type VisionCallMeta = {
  provider: VisionProvider;
  model: string;
  usedProviderFallback: boolean;
};

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseJson<T>(raw: string): T {
  return JSON.parse(stripJsonFences(raw)) as T;
}

/** OpenAI Vision — gpt-4o (or OPENAI_VISION_MODEL) with high-detail page images. */
async function callOpenAiVision(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  if (!config.openaiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = config.openaiModel || "gpt-4o";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI Vision error ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI Vision returned empty content");
  return content;
}

/** Anthropic Vision — Claude 3.5 Sonnet (or ANTHROPIC_VISION_MODEL). */
async function callAnthropicVision(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  if (!config.anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 8192,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: imageBase64 },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic Vision error ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = json.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) throw new Error("Anthropic Vision returned empty content");
  return text;
}

async function callVisionProvider(
  config: VisionConfig,
  provider: VisionProvider,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  if (provider === "openai") {
    return callOpenAiVision(config, systemPrompt, userText, imageBase64);
  }
  return callAnthropicVision(config, systemPrompt, userText, imageBase64);
}

/**
 * Call the configured Vision provider with symmetric runtime fallback:
 * if the primary provider errors and the alternate key exists, retry once.
 */
async function callVisionModel(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<{ content: string; meta: VisionCallMeta }> {
  const primary = config.provider;
  const fallback = alternateProvider(primary);

  try {
    const content = await callVisionProvider(config, primary, systemPrompt, userText, imageBase64);
    return {
      content,
      meta: {
        provider: primary,
        model: modelForProvider(config, primary),
        usedProviderFallback: false,
      },
    };
  } catch (primaryErr) {
    if (!providerHasKey(config, fallback)) {
      throw primaryErr;
    }

    console.warn(
      `[vision] ${primary} (${modelForProvider(config, primary)}) failed — falling back to ${fallback}`,
      primaryErr instanceof Error ? primaryErr.message : primaryErr,
    );

    const content = await callVisionProvider(config, fallback, systemPrompt, userText, imageBase64);
    return {
      content,
      meta: {
        provider: fallback,
        model: modelForProvider(config, fallback),
        usedProviderFallback: true,
      },
    };
  }
}

/** Run Vision OCR/layout extraction on one page image. */
export async function extractWordPage(
  config: VisionConfig,
  pageNumber: number,
  pageCount: number,
  imageBase64: string,
): Promise<{ page: VisionPage; meta: VisionCallMeta }> {
  const { content, meta } = await callVisionModel(
    config,
    WORD_PAGE_SYSTEM_PROMPT,
    wordPageUserPrompt(pageNumber, pageCount),
    imageBase64,
  );
  const parsed = parseJson<unknown>(content);
  const result = VisionPageSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[vision] invalid word page JSON", result.error.flatten());
    return { page: { pageNumber, blocks: [] }, meta };
  }
  return { page: { ...result.data, pageNumber }, meta };
}

/** Run Vision OCR/layout extraction for one slide/page. */
export async function extractSlidePage(
  config: VisionConfig,
  pageNumber: number,
  pageCount: number,
  imageBase64: string,
): Promise<{ slide: VisionSlide; meta: VisionCallMeta }> {
  const { content, meta } = await callVisionModel(
    config,
    PPT_PAGE_SYSTEM_PROMPT,
    pptPageUserPrompt(pageNumber, pageCount),
    imageBase64,
  );
  const parsed = parseJson<unknown>(content);
  const result = VisionSlideSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[vision] invalid slide JSON", result.error.flatten());
    return { slide: { slideNumber: pageNumber }, meta };
  }
  return { slide: { ...result.data, slideNumber: pageNumber }, meta };
}

export async function extractAllPages(
  config: VisionConfig,
  tool: VisionConvertTool,
  pages: { pageNumber: number; base64: string }[],
): Promise<{ data: VisionPage[] | VisionSlide[]; lastMeta: VisionCallMeta }> {
  const pageCount = pages.length;
  let lastMeta: VisionCallMeta = {
    provider: config.provider,
    model: modelForProvider(config, config.provider),
    usedProviderFallback: false,
  };

  if (tool === "pdf-word") {
    const results: VisionPage[] = [];
    for (const page of pages) {
      const { page: extracted, meta } = await extractWordPage(
        config,
        page.pageNumber,
        pageCount,
        page.base64,
      );
      results.push(extracted);
      lastMeta = meta;
    }
    return { data: results, lastMeta };
  }

  const results: VisionSlide[] = [];
  for (const page of pages) {
    const { slide, meta } = await extractSlidePage(config, page.pageNumber, pageCount, page.base64);
    results.push(slide);
    lastMeta = meta;
  }
  return { data: results, lastMeta };
}

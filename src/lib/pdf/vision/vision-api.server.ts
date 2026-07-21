import { parseAiJson } from "@/lib/pdf/vision/ai-json.server";
import {
  alternateProvider,
  modelForProvider,
  providerHasKey,
  type VisionConfig,
  type VisionProvider,
} from "@/lib/pdf/vision/config.server";
import { legacySlideToBlocks } from "@/lib/pdf/vision/legacy-slide.server";
import { masterPageUserPrompt, masterSystemPromptForTool } from "@/lib/pdf/vision/master-prompts.server";
import type { MasterConvertTool } from "@/lib/pdf/vision/schema";
import { VisionSlideSchema, type VisionPage } from "@/lib/pdf/vision/schema";
import type { PageTextLayer } from "@/lib/pdf/vision/text-layer.server";
import { coerceVisionPage, logMaster } from "@/lib/pdf/vision/validate.server";

export type VisionCallMeta = {
  provider: VisionProvider;
  model: string;
  usedProviderFallback: boolean;
};

async function callOpenAiVision(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  if (!config.openaiKey) throw new Error("OPENAI_API_KEY is not configured");

  const base = config.openaiBaseUrl.replace(/\/+$/, "");
  const url = base.includes("/openai/deployments/")
    ? `${base}/chat/completions?api-version=2024-02-15-preview`
    : `${base}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel || "gpt-4o",
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
              image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "high" },
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

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI Vision returned empty content");
  return content;
}

async function callAnthropicVision(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  if (!config.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

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
            { type: "image", source: { type: "base64", media_type: "image/png", data: imageBase64 } },
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

  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
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
  return provider === "openai"
    ? callOpenAiVision(config, systemPrompt, userText, imageBase64)
    : callAnthropicVision(config, systemPrompt, userText, imageBase64);
}

async function callVisionModel(
  config: VisionConfig,
  tool: MasterConvertTool,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
  pageNumber: number,
): Promise<{ content: string; meta: VisionCallMeta }> {
  const primary = config.provider;
  const fallback = alternateProvider(primary);

  try {
    const content = await callVisionProvider(config, primary, systemPrompt, userText, imageBase64);
    return {
      content,
      meta: { provider: primary, model: modelForProvider(config, primary), usedProviderFallback: false },
    };
  } catch (primaryErr) {
    if (!providerHasKey(config, fallback)) throw primaryErr;

    logMaster("provider_fallback", {
      tool,
      page: pageNumber,
      from: primary,
      to: fallback,
      reason: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    });

    const content = await callVisionProvider(config, fallback, systemPrompt, userText, imageBase64);
    return {
      content,
      meta: { provider: fallback, model: modelForProvider(config, fallback), usedProviderFallback: true },
    };
  }
}

async function extractPageContent(
  config: VisionConfig,
  tool: MasterConvertTool,
  pageNumber: number,
  pageCount: number,
  imageBase64: string,
  textLayer?: PageTextLayer,
): Promise<{ content: string; meta: VisionCallMeta }> {
  const hints = textLayer?.boxes.map((b) => ({ text: b.text, layout: b.layout, rtl: b.rtl }));
  return callVisionModel(
    config,
    tool,
    masterSystemPromptForTool(tool),
    masterPageUserPrompt(tool, pageNumber, pageCount, hints),
    imageBase64,
    pageNumber,
  );
}

/** Parse cleaned AI JSON into VisionPage — blocks format or legacy slide format. */
function parseVisionPage(rawContent: string, pageNumber: number, tool: MasterConvertTool): VisionPage {
  let parsed: unknown;
  try {
    parsed = parseAiJson(rawContent);
  } catch (err) {
    logMaster("json_parse_failed", {
      tool,
      pageNumber,
      reason: err instanceof Error ? err.message : String(err),
      sample: rawContent.slice(0, 120),
    });
    return { pageNumber, blocks: [] };
  }

  const page = coerceVisionPage(parsed, pageNumber);
  if (page.blocks.length) return page;

  if (tool === "pdf-ppt") {
    const slideResult = VisionSlideSchema.safeParse(parsed);
    if (slideResult.success) {
      const slide = slideResult.data;
      return coerceVisionPage(
        {
          pageNumber,
          pageTitle: slide.title,
          blocks: legacySlideToBlocks({ ...slide, slideNumber: pageNumber }),
        },
        pageNumber,
      );
    }
  }

  if (!page.blocks.length) {
    logMaster("schema_reject_page", { tool, pageNumber });
  }

  return page;
}

export async function extractWordPage(
  config: VisionConfig,
  tool: MasterConvertTool,
  pageNumber: number,
  pageCount: number,
  imageBase64: string,
  textLayer?: PageTextLayer,
): Promise<{ page: VisionPage; meta: VisionCallMeta }> {
  const { content, meta } = await extractPageContent(config, tool, pageNumber, pageCount, imageBase64, textLayer);
  return { page: parseVisionPage(content, pageNumber, tool), meta };
}

export async function extractAllPages(
  config: VisionConfig,
  tool: MasterConvertTool,
  pages: { pageNumber: number; base64: string }[],
  textLayers?: PageTextLayer[],
): Promise<{ data: VisionPage[]; lastMeta: VisionCallMeta }> {
  const pageCount = pages.length;
  const layerMap = new Map(textLayers?.map((l) => [l.pageNumber, l]) ?? []);
  let lastMeta: VisionCallMeta = {
    provider: config.provider,
    model: modelForProvider(config, config.provider),
    usedProviderFallback: false,
  };

  const results: VisionPage[] = [];
  let firstError: unknown;
  for (const page of pages) {
    try {
      const { page: extracted, meta } = await extractWordPage(
        config,
        tool,
        page.pageNumber,
        pageCount,
        page.base64,
        layerMap.get(page.pageNumber),
      );
      results.push(extracted);
      lastMeta = meta;
    } catch (err) {
      // One page's AI call failing (rate limit, transient error, retired model,
      // etc.) shouldn't sink the whole document — fusion falls back to the
      // PDF's own text layer for this page. Only rethrow if EVERY page failed.
      firstError ??= err;
      logMaster("page_extract_failed", {
        tool,
        pageNumber: page.pageNumber,
        reason: err instanceof Error ? err.message : String(err),
      });
      results.push({ pageNumber: page.pageNumber, blocks: [] });
    }
  }
  if (results.every((r) => !r.blocks.length) && firstError) throw firstError;
  return { data: results, lastMeta };
}

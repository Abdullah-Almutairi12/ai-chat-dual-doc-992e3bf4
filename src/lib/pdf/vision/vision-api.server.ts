import type { VisionConfig } from "@/lib/pdf/vision/config.server";
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

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseJson<T>(raw: string): T {
  return JSON.parse(stripJsonFences(raw)) as T;
}

async function callOpenAiVision(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
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

async function callAnthropicVision(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.anthropicKey!,
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

async function callVisionModel(
  config: VisionConfig,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
): Promise<string> {
  if (config.provider === "anthropic") {
    if (!config.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    return callAnthropicVision(config, systemPrompt, userText, imageBase64);
  }
  if (!config.openaiKey) throw new Error("OPENAI_API_KEY is not configured");
  return callOpenAiVision(config, systemPrompt, userText, imageBase64);
}

/** Run Vision OCR/layout extraction on one page image. */
export async function extractWordPage(
  config: VisionConfig,
  pageNumber: number,
  pageCount: number,
  imageBase64: string,
): Promise<VisionPage> {
  const raw = await callVisionModel(
    config,
    WORD_PAGE_SYSTEM_PROMPT,
    wordPageUserPrompt(pageNumber, pageCount),
    imageBase64,
  );
  const parsed = parseJson<unknown>(raw);
  const result = VisionPageSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[vision] invalid word page JSON", result.error.flatten());
    return { pageNumber, blocks: [] };
  }
  return { ...result.data, pageNumber };
}

/** Run Vision OCR/layout extraction for one slide/page. */
export async function extractSlidePage(
  config: VisionConfig,
  pageNumber: number,
  pageCount: number,
  imageBase64: string,
): Promise<VisionSlide> {
  const raw = await callVisionModel(
    config,
    PPT_PAGE_SYSTEM_PROMPT,
    pptPageUserPrompt(pageNumber, pageCount),
    imageBase64,
  );
  const parsed = parseJson<unknown>(raw);
  const result = VisionSlideSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[vision] invalid slide JSON", result.error.flatten());
    return { slideNumber: pageNumber };
  }
  return { ...result.data, slideNumber: pageNumber };
}

export async function extractAllPages(
  config: VisionConfig,
  tool: VisionConvertTool,
  pages: { pageNumber: number; base64: string }[],
): Promise<VisionPage[] | VisionSlide[]> {
  const pageCount = pages.length;
  const results: (VisionPage | VisionSlide)[] = [];

  for (const page of pages) {
    if (tool === "pdf-word") {
      results.push(await extractWordPage(config, page.pageNumber, pageCount, page.base64));
    } else {
      results.push(await extractSlidePage(config, page.pageNumber, pageCount, page.base64));
    }
  }

  return results as VisionPage[] | VisionSlide[];
}

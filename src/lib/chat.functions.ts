import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_DOC_CHARS = 24000;

type ChatMsg = { role: "user" | "assistant"; text: string };

type AskInput = {
  documentText: string;
  question: string;
  history?: ChatMsg[];
  isRtl?: boolean;
};

/** Answer a question grounded in the extracted document text (bilingual AR/EN). */
export const askDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AskInput) => {
    if (!data?.question?.trim()) throw new Error("Question is required");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const doc = (data.documentText ?? "").slice(0, MAX_DOC_CHARS);
    const truncated = (data.documentText ?? "").length > MAX_DOC_CHARS;

    const system = [
      "You are PDF Quanta's document assistant.",
      "Answer strictly based on the provided document content.",
      "If the answer is not present in the document, say so clearly instead of guessing.",
      "Always reply in the SAME language as the user's question (Arabic or English).",
      "For Arabic, write natural, correctly-spelled Arabic with proper right-to-left phrasing.",
      "Be concise and cite relevant details from the document.",
    ].join(" ");

    const messages = [
      { role: "system", content: system },
      {
        role: "system",
        content: `DOCUMENT CONTENT${truncated ? " (truncated)" : ""}:\n\n${doc || "(empty)"}`,
      },
      ...(data.history ?? []).slice(-8).map((m) => ({
        role: m.role,
        content: m.text,
      })),
      { role: "user", content: data.question },
    ];

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2 }),
    });

    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 402) throw new Error("NO_CREDITS");
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[askDocument] gateway error", res.status, detail);
      throw new Error("AI_ERROR");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = json.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("AI_ERROR");
    return { answer };
  });

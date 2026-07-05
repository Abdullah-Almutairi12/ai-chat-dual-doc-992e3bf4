import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { FileText, ScanLine, SendHorizonal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { FileDropzone, ToolHeader } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";
import { useActiveDocument } from "@/lib/active-document";
import { askDocument } from "@/lib/chat.functions";
import { isRtlText } from "@/lib/pdf-extract";
import { supabase } from "@/integrations/supabase/client";
import type { TranslationKey } from "@/lib/translations";

export const Route = createFileRoute("/_app/chat")({
  head: () =>
    pageHead({
      path: "/chat",
      title: "Chat with PDF — AI PDF Assistant | PDF Quanta",
      description:
        "Ask questions and get instant answers from any PDF. PDF Quanta's bilingual AI PDF chat summarizes, explains, and finds facts across your documents.",
    }),
  component: ChatTool,
});

type Msg = { id: string; role: "user" | "assistant"; text: string };

function mapError(err: unknown, t: (k: TranslationKey) => string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("RATE_LIMIT")) return t("chat_rate_limit");
  if (msg.includes("NO_CREDITS")) return t("chat_no_credits");
  if (msg.includes("Unauthorized")) return t("chat_need_login");
  return t("chat_error");
}

function ChatTool() {
  const { t, dir } = useI18n();
  const { doc, clear } = useActiveDocument();
  const ask = useServerFn(askDocument);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Auto-generate a summary once a document is loaded (best-effort).
  useEffect(() => {
    if (!doc?.text) {
      setSummary(null);
      setMessages([]);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        setSummary(null);
        return;
      }
      setSummaryLoading(true);
      try {
        const res = await ask({
          data: {
            documentText: doc.text,
            question: doc.isRtl
              ? "قدّم ملخصًا موجزًا وواضحًا لهذا المستند في 3-4 جمل."
              : "Provide a concise, clear summary of this document in 3-4 sentences.",
            isRtl: doc.isRtl,
          },
        });
        if (active) setSummary(res.answer);
      } catch {
        if (active) setSummary(null);
      } finally {
        if (active) setSummaryLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.name]);

  const send = async () => {
    const text = input.trim();
    if (!text || thinking || !doc) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error(t("chat_need_login"));
      return;
    }

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const next = [...messages, { id: crypto.randomUUID(), role: "user" as const, text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const res = await ask({
        data: { documentText: doc.text, question: text, history, isRtl: doc.isRtl },
      });
      setMessages([...next, { id: crypto.randomUUID(), role: "assistant", text: res.answer }]);
    } catch (err) {
      toast.error(mapError(err, t));
      setMessages(next);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <ToolHeader title={t("tool_chat")} desc={t("tool_chat_desc")} />

      {!doc ? (
        <FileDropzone tool="chat" onFile={() => {}} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <header className="flex items-center gap-3 border-b border-border p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{doc.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {doc.pageCount} {t("pages_label")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {doc.usedOcr ? <ScanLine className="h-3.5 w-3.5 text-primary" /> : null}
                    {doc.usedOcr ? t("ocr_badge") : t("text_layer_badge")}
                  </span>
                </div>
              </div>
              <button onClick={clear} className="shrink-0 text-sm font-medium text-primary hover:underline">
                {t("dropzone_replace")}
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("chat_summary_title")}
              </div>
              {summaryLoading ? (
                <p className="text-sm text-muted-foreground">{t("summary_generating")}</p>
              ) : summary ? (
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {summary}
                </p>
              ) : (
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {doc.text.slice(0, 1200) || t("extract_empty")}
                </p>
              )}
            </div>
          </section>

          <section className="flex max-h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && !thinking ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl gradient-hero text-primary-foreground shadow-soft">
                    <Sparkles className="h-6 w-6" />
                  </span>
                  <p className="mt-4 font-semibold text-foreground">{t("chat_empty_title")}</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t("chat_empty_desc")}</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      dir={isRtlText(m.text) ? "rtl" : "auto"}
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed animate-fade-up ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    </span>
                  </div>
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-end gap-2 border-t border-border p-3"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                dir="auto"
                placeholder={t("chat_placeholder")}
                className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || thinking} className="h-11 w-11 shrink-0">
                <SendHorizonal className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} />
              </Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, SendHorizonal, Sparkles } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  getDocument,
  mockAnswer,
  saveMessages,
  type DocMessage,
} from "@/lib/documents";

export const Route = createFileRoute("/chat/$docId")({
  component: ChatView,
});

function ChatView() {
  const { docId } = Route.useParams();
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();

  const [doc] = useState(() => getDocument(docId));
  const [messages, setMessages] = useState<DocMessage[]>(doc?.messages ?? []);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!doc) navigate({ to: "/dashboard" });
  }, [doc, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  if (!doc) return null;

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    const userMsg: DocMessage = { id: crypto.randomUUID(), role: "user", text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const reply: DocMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: mockAnswer(lang),
      };
      const withReply = [...next, reply];
      setMessages(withReply);
      saveMessages(docId, withReply);
      setThinking(false);
    }, 900);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6">
        <Link
          to="/dashboard"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
          {t("back")}
        </Link>

        <div className="grid flex-1 gap-4 lg:grid-cols-2">
          {/* Document / summary panel */}
          <section className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <header className="flex items-center gap-3 border-b border-border p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.sizeKb} KB</p>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("chat_summary_title")}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{t("chat_summary_body")}</p>
              <div className="mt-6 space-y-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2.5 rounded-full bg-muted"
                    style={{ width: `${70 + ((i * 13) % 30)}%` }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Chat panel */}
          <section className="flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
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
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed animate-fade-up ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={t("chat_placeholder")}
                  className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <Button type="submit" size="icon" disabled={!input.trim() || thinking} className="h-11 w-11 shrink-0">
                  <SendHorizonal className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} />
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
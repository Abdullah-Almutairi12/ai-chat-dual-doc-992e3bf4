import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles, XCircle } from "lucide-react";

import { FileDropzone, LoadingRow, ToolHeader } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/quiz")({
  component: QuizTool,
});

type Question = { q: string; options: string[]; answer: number };

const quizzes: Record<"en" | "ar", Question[]> = {
  en: [
    { q: "What is the main subject of the document?", options: ["Marketing strategy", "Financial results", "Product roadmap", "Legal terms"], answer: 1 },
    { q: "Which quarter showed the highest growth?", options: ["Q1", "Q2", "Q3", "Q4"], answer: 3 },
    { q: "The document recommends a structured process.", options: ["True", "False"], answer: 0 },
  ],
  ar: [
    { q: "ما هو الموضوع الرئيسي للمستند؟", options: ["استراتيجية التسويق", "النتائج المالية", "خطة المنتج", "الشروط القانونية"], answer: 1 },
    { q: "أي ربع سنوي حقق أعلى نمو؟", options: ["الأول", "الثاني", "الثالث", "الرابع"], answer: 3 },
    { q: "يوصي المستند باتباع عملية منظّمة.", options: ["صح", "خطأ"], answer: 0 },
  ],
};

function QuizTool() {
  const { t, lang } = useI18n();
  const [file, setFile] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const generate = () => {
    setGenerating(true);
    setQuestions(null);
    setAnswers({});
    setSubmitted(false);
    setTimeout(() => {
      setQuestions(quizzes[lang]);
      setGenerating(false);
    }, 1300);
  };

  const score = questions ? questions.filter((q, i) => answers[i] === q.answer).length : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <ToolHeader title={t("tool_quiz")} desc={t("tool_quiz_desc")} />

      <FileDropzone tool="quiz" onFile={(f) => setFile(f.name)} fileName={file} />

      {file && !questions && !generating && (
        <div className="mt-6 flex justify-center">
          <Button onClick={generate} size="lg" className="gap-2 shadow-soft">
            <Sparkles className="h-4 w-4" />
            {t("quiz_generate")}
          </Button>
        </div>
      )}

      {generating && (
        <div className="mt-6">
          <LoadingRow label={t("quiz_generating")} />
        </div>
      )}

      {questions && (
        <div className="mt-6 space-y-4">
          {submitted && (
            <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
              <p className="text-sm text-muted-foreground">{t("quiz_score")}</p>
              <p className="mt-1 text-4xl font-extrabold text-primary">
                {score}/{questions.length}
              </p>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="font-medium text-foreground">
                {qi + 1}. {q.q}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const correct = q.answer === oi;
                  let cls = "border-border bg-background hover:border-primary/40";
                  if (submitted) {
                    if (correct) cls = "border-primary bg-primary/10";
                    else if (selected) cls = "border-destructive bg-destructive/10";
                  } else if (selected) {
                    cls = "border-primary bg-accent";
                  }
                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-start text-sm transition-all ${cls}`}
                    >
                      <span className="text-foreground">{opt}</span>
                      {submitted && correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                      {submitted && selected && !correct && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-center">
            {!submitted ? (
              <Button
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length < questions.length}
                size="lg"
                className="shadow-soft"
              >
                {t("quiz_submit")}
              </Button>
            ) : (
              <Button onClick={generate} variant="outline" size="lg" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("quiz_retry")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
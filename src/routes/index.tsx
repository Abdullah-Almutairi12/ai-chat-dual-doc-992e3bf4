import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FileText, MessageSquareText, Sparkles, Search } from "lucide-react";

import heroImage from "@/assets/hero.jpg";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t, dir } = useI18n();
  const Arrow = dir === "rtl" ? "rotate-180" : "";

  const features = [
    {
      icon: Sparkles,
      title: t("feature_summaries_title"),
      desc: t("feature_summaries_desc"),
    },
    {
      icon: MessageSquareText,
      title: t("feature_answers_title"),
      desc: t("feature_answers_desc"),
    },
    {
      icon: Search,
      title: t("feature_insights_title"),
      desc: t("feature_insights_desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{ background: "var(--gradient-subtle)" }}
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div className="animate-fade-up text-center lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
                <FileText className="h-3.5 w-3.5 text-primary" />
                AI · PDF
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t("hero_title")}
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
                {t("hero_desc")}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg" className="group gap-2 shadow-elegant">
                  <Link to="/dashboard">
                    {t("hero_cta")}
                    <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${Arrow}`} />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/dashboard">{t("hero_secondary")}</Link>
                </Button>
              </div>
            </div>

            <div className="animate-fade-up">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="absolute -inset-4 -z-10 rounded-[2rem] gradient-hero opacity-20 blur-2xl" />
                <img
                  src={heroImage}
                  alt={t("hero_title")}
                  className="w-full rounded-3xl border border-border bg-card shadow-elegant"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {t("brand")}. {t("footer_rights")}
        </div>
      </footer>
    </div>
  );
}
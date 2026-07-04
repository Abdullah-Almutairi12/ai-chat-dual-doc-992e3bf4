import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FileText } from "lucide-react";

import heroImage from "@/assets/hero.jpg";
import { Navbar } from "@/components/Navbar";
import { Logo, LogoIcon } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { tools } from "@/lib/tools";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PDF Quanta — The Quantum Leap in Document Intelligence" },
      {
        name: "description",
        content:
          "Chat with PDFs, extract tables to Excel, proofread, convert, generate quizzes, and analyze financial or legal documents in one bilingual AI suite.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, dir } = useI18n();
  const arrow = dir === "rtl" ? "rotate-180" : "";

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
              <div className="mb-6 flex justify-center lg:justify-start">
                <LogoIcon size={64} className="drop-shadow-[0_8px_24px_color-mix(in_oklab,var(--primary)_40%,transparent)]" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
                <FileText className="h-3.5 w-3.5 text-primary" />
                {t("hero_badge")}
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t("brand")}
              </h1>
              <p className="mt-3 text-xl font-semibold text-primary sm:text-2xl">
                {t("slogan")}
              </p>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
                {t("hero_desc")}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg" className="group gap-2 shadow-elegant">
                  <Link to="/dashboard">
                    {t("hero_cta")}
                    <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${arrow}`} />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#features">{t("hero_secondary")}</a>
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

        <section id="features" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("features_title")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("features_subtitle")}</p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, i) => (
              <Link
                key={tool.id}
                to={tool.path}
                className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary transition-colors group-hover:gradient-hero group-hover:text-primary-foreground">
                  <tool.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{t(tool.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(tool.descKey)}</p>
              </Link>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Button asChild size="lg" className="group gap-2 shadow-elegant">
              <Link to="/dashboard">
                {t("hero_cta")}
                <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${arrow}`} />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center text-sm text-muted-foreground sm:px-6">
          <Logo size={30} />
          <p>© {new Date().getFullYear()} {t("brand")}. {t("footer_rights")}</p>
        </div>
      </footer>
    </div>
  );
}

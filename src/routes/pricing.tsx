import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CURRENCY, PLANS, type Plan } from "@/lib/packages";
import { supabase } from "@/integrations/supabase/client";
import { createCheckout, claimFree } from "@/lib/checkout.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PDF Quanta" },
      {
        name: "description",
        content:
          "Choose a PDF Quanta plan. Flexible monthly packages with credits for AI-powered document tools. Pay securely with Tap.",
      },
      { property: "og:title", content: "Pricing — PDF Quanta" },
      { property: "og:description", content: "Flexible monthly credit packages for PDF Quanta." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://pdfquanta.online/pricing" },
      { property: "og:image", content: "https://pdfquanta.online/og-image.jpg" },
      { name: "twitter:image", content: "https://pdfquanta.online/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://pdfquanta.online/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const checkoutFn = useServerFn(createCheckout);
  const freeFn = useServerFn(claimFree);

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (active && profile) setCredits(profile.credits);
    })();
    return () => {
      active = false;
    };
  }, []);

  const onSelect = async (plan: Plan) => {
    setLoadingPlan(plan.id);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        toast(ar ? "الرجاء تسجيل الدخول للمتابعة" : "Please sign in to continue");
        navigate({ to: "/login", search: { redirect: "/pricing" } });
        return;
      }

      if (plan.price <= 0) {
        const res = await freeFn();
        if (res.alreadyClaimed) {
          toast(ar ? "لقد حصلت بالفعل على الباقة المجانية" : "You've already claimed the free plan");
        } else {
          toast.success(
            ar ? `تمت إضافة ${res.credits} رصيد` : `${res.credits} credits added to your account`,
          );
        }
        navigate({ to: "/dashboard" });
        return;
      }

      const res = await checkoutFn({ data: { planId: plan.id, origin: window.location.origin } });
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "تعذّر بدء الدفع" : "Could not start checkout");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Navbar />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{ background: "var(--gradient-subtle)" }}
      />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {ar ? "باقات مرنة" : "Flexible plans"}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {ar ? "اختر الباقة المناسبة لك" : "Choose the plan that fits you"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {ar
              ? "احصل على رصيد شهري لاستخدام جميع أدوات PDF Quanta الذكية. ادفع بأمان عبر Tap."
              : "Get monthly credits for every PDF Quanta tool. Pay securely with Tap."}
          </p>
          {credits !== null && (
            <p className="mt-3 text-sm font-medium text-primary">
              {ar ? `رصيدك الحالي: ${credits}` : `Your balance: ${credits} credits`}
            </p>
          )}
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-card p-6 shadow-soft transition-all duration-300 animate-fade-up",
                plan.popular
                  ? "border-primary/60 shadow-elegant lg:-translate-y-2"
                  : "border-border hover:-translate-y-1 hover:shadow-elegant",
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {plan.popular && (
                <span className="absolute -top-3 start-6 rounded-full gradient-hero px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
                  {ar ? "الأكثر شيوعًا" : "Most popular"}
                </span>
              )}

              <h3 className="text-lg font-bold text-foreground">{ar ? plan.nameAr : plan.nameEn}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{ar ? plan.taglineAr : plan.taglineEn}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm font-medium text-muted-foreground">
                  {plan.price === 0 ? (ar ? "مجانًا" : "free") : `${CURRENCY} / ${ar ? "شهر" : "mo"}`}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-primary">
                {ar ? `${plan.credits} رصيد` : `${plan.credits.toLocaleString()} credits`}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {(ar ? plan.featuresAr : plan.featuresEn).map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => onSelect(plan)}
                disabled={loadingPlan !== null}
                variant={plan.popular ? "default" : "outline"}
                size="lg"
                className="mt-7 w-full"
              >
                {loadingPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                {plan.price === 0
                  ? ar
                    ? "ابدأ مجانًا"
                    : "Start free"
                  : ar
                    ? "اشترك الآن"
                    : "Subscribe"}
              </Button>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-muted-foreground">
          {ar
            ? "المدفوعات آمنة ومشفّرة عبر Tap. يمكنك إلغاء اشتراكك في أي وقت."
            : "Payments are securely encrypted via Tap. You can cancel anytime."}
        </p>

        <div className="mt-8 text-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className={cn("h-4 w-4", dir === "rtl" && "rotate-180")} />
            {ar ? "العودة إلى لوحة التحكم" : "Back to dashboard"}
          </Link>
        </div>
      </main>
    </div>
  );
}
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { CURRENCY, getPlan } from "@/lib/packages";
import { supabase } from "@/integrations/supabase/client";
import { confirmMock, isLiveMode } from "@/lib/checkout.functions";

export const Route = createFileRoute("/payment/mock")({
  validateSearch: (search: Record<string, unknown>) => ({
    cid: typeof search.cid === "string" ? search.cid : undefined,
  }),
  beforeLoad: async () => {
    // The simulated checkout page must never be reachable in live mode.
    const live = await isLiveMode();
    if (live) {
      throw redirect({ to: "/pricing" });
    }
  },
  component: MockCheckout,
});

function MockCheckout() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const { cid } = Route.useSearch();
  const confirmFn = useServerFn(confirmMock);

  const [planId, setPlanId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!cid) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("payment_intents")
        .select("plan_id,amount,status")
        .eq("id", cid)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setPlanId(data.plan_id);
        setAmount(Number(data.amount));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [cid]);

  const plan = planId ? getPlan(planId) : undefined;

  const pay = async () => {
    if (!cid) return;
    setPaying(true);
    try {
      await confirmFn({ data: { chargeId: cid } });
      navigate({ to: "/payment/callback", search: { tap_id: cid } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "فشل الدفع" : "Payment failed");
      setPaying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12" dir={dir}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-elegant">
        <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-4">
          <Logo size={28} />
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {ar ? "وضع الاختبار" : "Test mode"}
          </span>
        </div>

        <div className="px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !plan ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {ar ? "لم يتم العثور على عملية الدفع." : "This payment could not be found."}
              <div className="mt-4">
                <Button variant="outline" onClick={() => navigate({ to: "/pricing" })}>
                  {ar ? "العودة إلى الباقات" : "Back to plans"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{ar ? "الدفع مقابل" : "You're paying for"}</p>
              <div className="mt-1 flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-foreground">
                  {ar ? plan.nameAr : plan.nameEn} {ar ? "" : "plan"}
                </h2>
                <span className="text-xl font-bold text-foreground">
                  {amount} <span className="text-sm font-medium text-muted-foreground">{CURRENCY}</span>
                </span>
              </div>
              <p className="mt-1 text-sm text-primary">
                {ar ? `${plan.credits} رصيد شهريًا` : `${plan.credits.toLocaleString()} credits / month`}
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-input bg-background px-3.5 py-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    {ar ? "بطاقة الاختبار" : "Test card"}
                  </label>
                  <p className="mt-1 font-mono text-sm text-foreground">4242 4242 4242 4242 · 12/29 · 123</p>
                </div>
              </div>

              <Button className="mt-6 w-full" size="lg" onClick={pay} disabled={paying}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {ar ? `ادفع ${amount} ${CURRENCY}` : `Pay ${amount} ${CURRENCY}`}
              </Button>
              <button
                onClick={() => navigate({ to: "/pricing" })}
                disabled={paying}
                className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {ar ? "إلغاء" : "Cancel"}
              </button>

              <p className="mt-5 text-center text-xs text-muted-foreground">
                {ar
                  ? "هذه محاكاة آمنة للدفع عبر Tap لأغراض الاختبار."
                  : "This is a secure simulated Tap checkout for testing."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
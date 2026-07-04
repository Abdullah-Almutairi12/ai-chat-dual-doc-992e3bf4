import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { verifyCharge } from "@/lib/checkout.functions";

export const Route = createFileRoute("/payment/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    tap_id: typeof search.tap_id === "string" ? search.tap_id : undefined,
  }),
  component: PaymentCallback,
});

type Phase = "verifying" | "success" | "failed";

function PaymentCallback() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const { tap_id } = Route.useSearch();
  const verifyFn = useServerFn(verifyCharge);

  const [phase, setPhase] = useState<Phase>("verifying");
  const [credits, setCredits] = useState<number>(0);
  const [planName, setPlanName] = useState<string>("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!tap_id) {
        setPhase("failed");
        return;
      }
      try {
        const res = await verifyFn({ data: { tapId: tap_id } });
        if (res.status === "CAPTURED") {
          setCredits(res.credits ?? 0);
          setPlanName((ar ? res.planNameAr : res.planNameEn) ?? "");
          setPhase("success");
          setTimeout(() => navigate({ to: "/dashboard" }), 4000);
        } else {
          setPhase("failed");
        }
      } catch {
        setPhase("failed");
      }
    })();
  }, [tap_id, verifyFn, navigate, ar]);

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{ background: "var(--gradient-subtle)" }}
      />
      <Dialog open>
        <DialogContent className="max-w-sm text-center" hideClose>
          {phase === "verifying" && (
            <div className="flex flex-col items-center py-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <DialogHeader className="mt-4">
                <DialogTitle className="text-center">
                  {ar ? "جارٍ تأكيد الدفع…" : "Confirming your payment…"}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {ar ? "لحظات من فضلك" : "This will only take a moment"}
                </DialogDescription>
              </DialogHeader>
            </div>
          )}

          {phase === "success" && (
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <DialogHeader className="mt-4">
                <DialogTitle className="text-center text-xl">
                  {ar ? "تم الدفع بنجاح!" : "Payment successful!"}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {ar
                    ? `تمت إضافة ${credits} رصيد إلى حسابك${planName ? ` (باقة ${planName})` : ""}.`
                    : `${credits.toLocaleString()} credits were added to your account${planName ? ` (${planName} plan)` : ""}.`}
                </DialogDescription>
              </DialogHeader>
              <Button className="mt-6 w-full" onClick={() => navigate({ to: "/dashboard" })}>
                {ar ? "الذهاب إلى لوحة التحكم" : "Go to dashboard"}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                {ar ? "سيتم تحويلك تلقائيًا…" : "Redirecting automatically…"}
              </p>
            </div>
          )}

          {phase === "failed" && (
            <div className="flex flex-col items-center py-4">
              <XCircle className="h-14 w-14 text-destructive" />
              <DialogHeader className="mt-4">
                <DialogTitle className="text-center text-xl">
                  {ar ? "لم يكتمل الدفع" : "Payment not completed"}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {ar
                    ? "لم تتم إضافة أي رصيد. يمكنك المحاولة مرة أخرى."
                    : "No credits were added. You can try again."}
                </DialogDescription>
              </DialogHeader>
              <Button className="mt-6 w-full" onClick={() => navigate({ to: "/pricing" })}>
                {ar ? "العودة إلى الباقات" : "Back to plans"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
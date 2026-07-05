import { useNavigate } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useEntitlement } from "@/lib/entitlement";

export function UpgradeModal() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { upgradeOpen, setUpgradeOpen } = useEntitlement();

  const perks = [
    t("upgrade_modal_perk_1"),
    t("upgrade_modal_perk_2"),
    t("upgrade_modal_perk_3"),
  ];

  return (
    <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
      <DialogContent className="max-w-md overflow-hidden rounded-3xl border-border p-0">
        <div className="gradient-hero px-6 py-7 text-center text-primary-foreground">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <Sparkles className="h-7 w-7" />
          </span>
          <DialogHeader className="mt-4 space-y-2">
            <DialogTitle className="text-center text-xl font-bold text-primary-foreground">
              {t("upgrade_modal_title")}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-primary-foreground/90">
              {t("upgrade_modal_desc")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 px-6 pb-6 sm:flex-col">
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setUpgradeOpen(false);
              void navigate({ to: "/pricing" });
            }}
          >
            {t("upgrade_modal_cta")}
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setUpgradeOpen(false)}>
            {t("upgrade_modal_later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

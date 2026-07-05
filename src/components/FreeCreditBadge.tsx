import { Infinity as InfinityIcon, Sparkles } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useEntitlement } from "@/lib/entitlement";

/** Small indicator showing how many free files the user has left. */
export function FreeCreditBadge({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { entitlement, loading } = useEntitlement();

  if (loading || !entitlement) return null;

  if (entitlement.subscribed) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs font-semibold text-primary ${className}`}
      >
        <InfinityIcon className="h-3.5 w-3.5" />
        {t("free_trial_unlimited")}
      </span>
    );
  }

  const remaining = entitlement.remaining ?? 0;
  const used = remaining <= 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        used
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/30 bg-accent text-primary"
      } ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {used ? t("free_trial_used") : `${t("free_trial_remaining")}: ${remaining}`}
    </span>
  );
}

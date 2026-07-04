import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ban, CheckCircle2, Loader2, Plus, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { listUsers, updateUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  tier: string;
  credits: number;
  banned: boolean;
  created_at: string;
};

function UsersPage() {
  const { lang } = useI18n();
  const tt = adminT(lang);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const listFn = useServerFn(listUsers);
  const updateFn = useServerFn(updateUser);
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });

  const mutation = useMutation({
    mutationFn: (input: { id: string; tier?: string; credits?: number; banned?: boolean }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      toast.success(tt("saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const users = ((data as UserRow[] | undefined) ?? []).filter(
    (u) =>
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase()),
  );

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{tt("users_title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("users_subtitle")}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tt("search_users")}
            className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{tt("col_name")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_email")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_tier")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_credits")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tt("col_registered")}</th>
                <th className="px-4 py-3 text-end font-semibold">{tt("col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {tt("no_results")}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{u.name}</span>
                        {u.banned && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            {tt("banned_badge")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.tier === "premium"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {u.tier === "premium" ? tt("tier_premium") : tt("tier_free")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{u.credits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <IconBtn
                          title={u.tier === "premium" ? tt("action_downgrade") : tt("action_upgrade")}
                          onClick={() =>
                            mutation.mutate({ id: u.id, tier: u.tier === "premium" ? "free" : "premium" })
                          }
                        >
                          {u.tier === "premium" ? (
                            <RotateCcw className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                        </IconBtn>
                        <IconBtn
                          title={tt("action_add_credits")}
                          onClick={() => mutation.mutate({ id: u.id, credits: u.credits + 100 })}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          title={tt("action_reset_credits")}
                          onClick={() => mutation.mutate({ id: u.id, credits: 100 })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          title={u.banned ? tt("action_unban") : tt("action_ban")}
                          danger={!u.banned}
                          onClick={() => mutation.mutate({ id: u.id, banned: !u.banned })}
                        >
                          {u.banned ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      title={title}
      onClick={onClick}
      className={`h-8 gap-1 px-2 text-xs ${danger ? "text-destructive hover:text-destructive" : ""}`}
    >
      {children}
      <span className="hidden md:inline">{title}</span>
    </Button>
  );
}
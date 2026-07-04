import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { listSettings, updateSetting } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

type Setting = { key: string; value: string; label: string };

function SettingsPage() {
  const { lang } = useI18n();
  const tt = adminT(lang);
  const queryClient = useQueryClient();

  const listFn = useServerFn(listSettings);
  const updateFn = useServerFn(updateSetting);
  const { data, isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: () => listFn() });

  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) {
      const next: Record<string, string> = {};
      (data as Setting[]).forEach((s) => (next[s.key] = s.value));
      setValues(next);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (input: { key: string; value: string }) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success(tt("saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const settings = (data as Setting[] | undefined) ?? [];
  const isSecret = (key: string) => key.includes("key") || key.includes("secret");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{tt("settings_title")}</h1>
        <p className="text-sm text-muted-foreground">{tt("settings_subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {settings.map((s) => (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {isSecret(s.key) && <KeyRound className="h-4 w-4 text-primary" />}
                {s.label || s.key}
              </label>
              {isSecret(s.key) && (
                <p className="mt-1 text-xs text-muted-foreground">{tt("secret_note")}</p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type={isSecret(s.key) ? "password" : "text"}
                  value={values[s.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                  placeholder={isSecret(s.key) ? "••••••••••••" : ""}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <Button
                  onClick={() => mutation.mutate({ key: s.key, value: values[s.key] ?? "" })}
                  disabled={mutation.isPending}
                  className="gap-2 sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  {tt("save")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
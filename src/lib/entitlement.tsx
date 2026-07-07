import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { getEntitlement, consumeFile, FREE_FILE_LIMIT } from "@/lib/entitlement.functions";
export type Entitlement = {
  filesProcessed: number;
  freeLimit: number;
  subscribed: boolean;
  remaining: number | null;
  allowed: boolean;
};

type FileMeta = { fileName?: string; fileSize?: number; tool?: string };

const defaultFreeEntitlement = (): Entitlement => ({
  filesProcessed: 0,
  freeLimit: FREE_FILE_LIMIT,
  subscribed: false,
  remaining: FREE_FILE_LIMIT,
  allowed: true,
});

type Ctx = {
  entitlement: Entitlement | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Attempt to consume one processing slot. Opens the upgrade modal + returns false when blocked. */
  tryConsume: (meta: FileMeta) => Promise<boolean>;
  openUpgrade: () => void;
  upgradeOpen: boolean;
  setUpgradeOpen: (open: boolean) => void;
};

const EntitlementContext = createContext<Ctx | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (mounted.current) {
        setEntitlement(null);
        setLoading(false);
      }
      return;
    }
    try {
      const ent = await getEntitlement();
      if (mounted.current) setEntitlement(ent);
    } catch {
      // Do not block uploads when entitlement lookup fails — assume free trial is available.
      if (mounted.current) setEntitlement(defaultFreeEntitlement());
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      mounted.current = false;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const tryConsume = useCallback(
    async (meta: FileMeta) => {
      try {
        const ent = await consumeFile({ data: meta });
        if (mounted.current) setEntitlement(ent);
        if (!ent.allowed && mounted.current) setUpgradeOpen(true);
        return ent.allowed;
      } catch (err) {
        console.error("[entitlement] consume failed", err);
        try {
          const ent = await getEntitlement();
          if (mounted.current) setEntitlement(ent);
          if (!ent.allowed && mounted.current) setUpgradeOpen(true);
        } catch {
          if (mounted.current) setEntitlement(defaultFreeEntitlement());
        }
        return false;
      }
    },
    [],
  );

  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);

  return (
    <EntitlementContext.Provider
      value={{ entitlement, loading, refresh, tryConsume, openUpgrade, upgradeOpen, setUpgradeOpen }}
    >
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement() {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error("useEntitlement must be used within EntitlementProvider");
  return ctx;
}

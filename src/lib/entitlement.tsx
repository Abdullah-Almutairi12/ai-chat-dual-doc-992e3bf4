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
import { getEntitlement, consumeFile } from "@/lib/entitlement.functions";

export type Entitlement = {
  filesProcessed: number;
  freeLimit: number;
  subscribed: boolean;
  remaining: number | null;
  allowed: boolean;
};

type FileMeta = { fileName?: string; fileSize?: number; tool?: string };

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
      /* ignore — leave previous state */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const tryConsume = useCallback(
    async (meta: FileMeta) => {
      try {
        const ent = await consumeFile({ data: meta });
        if (mounted.current) setEntitlement(ent);
        if (!ent.allowed && mounted.current) setUpgradeOpen(true);
        return ent.allowed;
      } catch {
        // On unexpected error, fail closed — do not grant free processing.
        if (mounted.current) setUpgradeOpen(true);
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

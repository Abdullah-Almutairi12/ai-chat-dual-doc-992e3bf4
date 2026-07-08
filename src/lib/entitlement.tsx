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

import { defaultFreeEntitlement } from "@/lib/entitlement.constants";

import { getEntitlement, consumeFile, type Entitlement } from "@/lib/entitlement.functions";



export type { Entitlement };



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

          if (!ent.allowed) {

            if (mounted.current) setUpgradeOpen(true);

            return false;

          }

          return true;

        } catch {

          if (mounted.current) setEntitlement(defaultFreeEntitlement());

          return true;

        }

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


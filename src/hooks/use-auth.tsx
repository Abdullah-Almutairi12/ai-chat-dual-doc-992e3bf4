import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * Session-aware auth hook.
 * - getSession() first restores the session from storage (fixes the race where
 *   INITIAL_SESSION fires before the session is available).
 * - onAuthStateChange keeps the UI in sync with live sign-in / sign-out events.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    // Restore session from storage on mount.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setIsReady(true);
    });

    // React to subsequent sign-in / sign-out / token refresh events.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { user, isReady, isAuthenticated: !!user };
}
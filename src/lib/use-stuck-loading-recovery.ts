"use client";

import { useEffect, useRef } from "react";
import {
  clearClientStorageAndGoLogin,
  preserveSupabaseAuthAndHardReload,
  STUCK_RECOVERY_SESSION_KEY,
} from "@/lib/session-recovery";

const DEFAULT_MS = 5000;

/**
 * Enquanto `loading` permanecer true por `maxMs`: 1ª vez preserva auth Supabase e reload;
 * se após reload ainda preso, limpa tudo e vai ao login.
 */
export function useStuckLoadingRecovery(loading: boolean, maxMs = DEFAULT_MS) {
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!loading) {
      try {
        sessionStorage.removeItem(STUCK_RECOVERY_SESSION_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const id = window.setTimeout(() => {
      if (!loadingRef.current) return;
      try {
        if (sessionStorage.getItem(STUCK_RECOVERY_SESSION_KEY) === "1") {
          sessionStorage.removeItem(STUCK_RECOVERY_SESSION_KEY);
          clearClientStorageAndGoLogin();
          return;
        }
      } catch {
        clearClientStorageAndGoLogin();
        return;
      }
      preserveSupabaseAuthAndHardReload();
    }, maxMs);

    return () => window.clearTimeout(id);
  }, [loading, maxMs]);
}

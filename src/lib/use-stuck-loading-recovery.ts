"use client";

import { useEffect, useRef } from "react";
import { clearClientStorageAndGoLogin } from "@/lib/session-recovery";

const DEFAULT_MS = 22_000;

/**
 * Enquanto `loading` permanecer true por `maxMs`, assume UI presa: limpa storage e envia ao login.
 * Reseta o timer quando `loading` vira false ou o componente desmonta.
 */
export function useStuckLoadingRecovery(loading: boolean, maxMs = DEFAULT_MS) {
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => {
      if (loadingRef.current) {
        clearClientStorageAndGoLogin();
      }
    }, maxMs);
    return () => window.clearTimeout(id);
  }, [loading, maxMs]);
}

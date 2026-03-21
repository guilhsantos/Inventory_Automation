import { supabase } from "./supabase";

const SUPABASE_AUTH_KEY = "reauto-inventory-auth";

/** Session flag: após 1º reload ainda preso → login completo. */
export const STUCK_RECOVERY_SESSION_KEY = "__reauto_stuck_recover";

/** Limpa storage local e força navegação ao login (evita UI presa em loading/logout). */
export function clearClientStorageAndGoLogin() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  window.location.href = "/login";
}

/**
 * Mantém sessão Supabase + flag de recuperação no sessionStorage; limpa o resto e recarrega.
 * Desliga Realtime antes do reload.
 */
export function preserveSupabaseAuthAndHardReload() {
  try {
    if (!sessionStorage.getItem(STUCK_RECOVERY_SESSION_KEY)) {
      sessionStorage.setItem(STUCK_RECOVERY_SESSION_KEY, "1");
    }

    const auth = localStorage.getItem(SUPABASE_AUTH_KEY);
    const lsRm: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== SUPABASE_AUTH_KEY) lsRm.push(k);
    }
    lsRm.forEach((k) => localStorage.removeItem(k));
    if (auth != null) localStorage.setItem(SUPABASE_AUTH_KEY, auth);

    const ssRm: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k !== STUCK_RECOVERY_SESSION_KEY) ssRm.push(k);
    }
    ssRm.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  try {
    supabase.realtime.disconnect();
  } catch {
    /* ignore */
  }
  window.location.reload();
}

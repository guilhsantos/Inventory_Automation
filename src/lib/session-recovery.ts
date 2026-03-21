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

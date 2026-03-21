/** Calendário e filtros alinhados ao horário de Brasília (sem DST desde 2019). */
const TZ_BR = "America/Sao_Paulo";
const BR_DAY_START = "T00:00:00-03:00";
const BR_DAY_END = "T23:59:59.999-03:00";

export function todayYmdBr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ymdAddDaysBr(ymd: string, deltaDays: number): string {
  const anchor = new Date(ymd + "T12:00:00-03:00");
  const t = anchor.getTime() + deltaDays * 86400000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

export function brDayRangeIso(startYmd: string, endYmd: string): { startIso: string; endIso: string } {
  return {
    startIso: `${startYmd}${BR_DAY_START}`,
    endIso: `${endYmd}${BR_DAY_END}`,
  };
}

/** Exibe data de entrega / valores só-data (YYYY-MM-DD) sem deslocar um dia. */
export function formatDate(date: string | Date | null | undefined): string {
  if (date == null || date === "") return "—";
  if (typeof date === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    if (m) {
      const [, y, mo, d] = m;
      return `${d}/${mo}/${y}`;
    }
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    timeZone: TZ_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Chave de agrupamento por dia civil em BR (ex.: gráficos). */
export function formatDayKeyBrFromTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    timeZone: TZ_BR,
    day: "2-digit",
    month: "2-digit",
  });
}

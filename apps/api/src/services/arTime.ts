/** Argentina fija UTC−3 (sin DST en v1) */
export const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Interpreta fecha+hora civil AR como instante UTC.
 * No usa el timezone del host.
 */
export function arLocalToUtc(fechaYYYYMMDD: string, horaHHMM: string) {
  const [y, mo, d] = fechaYYYYMMDD.split("-").map(Number);
  const [h, mi] = horaHHMM.split(":").map(Number);
  // AR = UTC−3 → UTC = local + 3h
  return new Date(Date.UTC(y!, mo! - 1, d!, h! + 3, mi! ?? 0, 0));
}

/** Inicio/fin del día civil AR como UTC Date */
export function arDayBounds(fechaYYYYMMDD: string) {
  const start = arLocalToUtc(fechaYYYYMMDD, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function todayArDate() {
  const now = new Date();
  const local = new Date(now.getTime() + AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Suma días a un YYYY-MM-DD civil (calendario, sin TZ). */
export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatHoraAr(d: Date) {
  const local = new Date(d.getTime() + AR_OFFSET_MS);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

export function fechaArFromUtc(d: Date) {
  const local = new Date(d.getTime() + AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

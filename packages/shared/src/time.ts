/**
 * Helpers de tiempo. Las reservas viven en UTC (Date).
 * Horarios de atención y reglas de precio usan HH:MM en hora local de la sede.
 */

/** Parsea "HH:MM" o "HH:MM:SS" a minutos desde medianoche. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((x) => Number.parseInt(x, 10));
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    throw new Error(`Hora inválida: ${time}`);
  }
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Duración en minutos entre dos instantes UTC. */
export function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
}

/** ¿[aStart, aEnd) solapa [bStart, bEnd)? */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Convierte un instante UTC a partes locales del día,
 * usando un offset fijo en minutos (ej. Argentina = -180).
 * Para reglas de negocio del MVP usamos offset fijo; DST no aplica en AR.
 */
export function localParts(
  instant: Date,
  utcOffsetMinutes: number,
): { dayOfWeek: number; minutes: number; dateKey: string } {
  const localMs = instant.getTime() + utcOffsetMinutes * 60_000;
  const local = new Date(localMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return {
    dayOfWeek: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    dateKey: `${y}-${m}-${d}`,
  };
}

/** Offset típico Argentina (UTC-3), sin DST. */
export const AR_UTC_OFFSET_MINUTES = -180;

/**
 * Interpreta fecha+hora civil AR (YYYY-MM-DD + HH:MM) como instante UTC.
 * No usa el timezone del host.
 */
export function arLocalToUtc(fechaYYYYMMDD: string, horaHHMM: string): Date {
  const [y, mo, d] = fechaYYYYMMDD.split("-").map(Number);
  const [h, mi] = horaHHMM.split(":").map(Number);
  // AR = UTC−3 → UTC = local + 3h
  return new Date(Date.UTC(y!, mo! - 1, d!, h! + 3, mi! ?? 0, 0));
}

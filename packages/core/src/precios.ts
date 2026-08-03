import {
  AR_UTC_OFFSET_MINUTES,
  addMoney,
  localParts,
  mulMoney,
  parseTimeToMinutes,
  type Money,
} from "@repo/shared";
import { PrecioNoDefinidoError } from "./errors";
import type { ReglaPrecio } from "./types";

/**
 * Especificidad: puntual (relámpago) > continuo; luego menos días + franja más corta.
 */
export function specificityScore(rule: ReglaPrecio): number {
  let score = 0;
  if (rule.tipo === "puntual") score += 100;
  // Menos días = más específica (máx 7); vacío = todos = menos específica
  const days = rule.daysOfWeek.length === 0 ? 7 : rule.daysOfWeek.length;
  score += (7 - days) * 10;
  if (rule.startTime != null && rule.endTime != null) {
    score += 5;
    const span =
      parseTimeToMinutes(rule.endTime) - parseTimeToMinutes(rule.startTime);
    score += Math.max(0, 24 * 60 - span) / 60;
  }
  return score;
}

export function ruleMatchesInstant(
  rule: ReglaPrecio,
  instant: Date,
  utcOffsetMinutes = AR_UTC_OFFSET_MINUTES,
): boolean {
  if (!rule.active) return false;
  const { dayOfWeek, minutes, dateKey } = localParts(instant, utcOffsetMinutes);

  // Vigencia por fechas (puntual obligatorio; continuo opcional)
  if (rule.fechaDesde && dateKey < rule.fechaDesde) return false;
  if (rule.fechaHasta && dateKey > rule.fechaHasta) return false;
  if (rule.tipo === "puntual" && (!rule.fechaDesde || !rule.fechaHasta)) {
    return false;
  }

  if (
    rule.daysOfWeek.length > 0 &&
    !rule.daysOfWeek.includes(dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6)
  ) {
    return false;
  }

  if (rule.startTime == null || rule.endTime == null) {
    return true;
  }
  const from = parseTimeToMinutes(rule.startTime);
  const to = parseTimeToMinutes(rule.endTime);
  return minutes >= from && minutes < to;
}

/** Regla ganadora para un instante. */
export function resolvePriceRule(
  rules: ReglaPrecio[],
  instant: Date,
  utcOffsetMinutes = AR_UTC_OFFSET_MINUTES,
): ReglaPrecio | null {
  const matches = rules.filter((r) =>
    ruleMatchesInstant(r, instant, utcOffsetMinutes),
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => specificityScore(b) - specificityScore(a));
  return matches[0] ?? null;
}

/**
 * Precio de sala para un intervalo: se parte en segmentos de `granularityMinutes`
 * (default 60) y se suma precio_por_hora * (segmento/60).
 */
export function calculateSalaPrice(input: {
  rules: ReglaPrecio[];
  startsAt: Date;
  endsAt: Date;
  granularityMinutes?: number;
  utcOffsetMinutes?: number;
}): Money {
  const {
    rules,
    startsAt,
    endsAt,
    granularityMinutes = 60,
    utcOffsetMinutes = AR_UTC_OFFSET_MINUTES,
  } = input;

  if (endsAt <= startsAt) {
    throw new PrecioNoDefinidoError("Intervalo inválido");
  }

  let total: Money = "0.00";
  let cursor = startsAt.getTime();
  const end = endsAt.getTime();
  const stepMs = granularityMinutes * 60_000;

  while (cursor < end) {
    const segmentEnd = Math.min(cursor + stepMs, end);
    const segmentMinutes = (segmentEnd - cursor) / 60_000;
    const rule = resolvePriceRule(
      rules,
      new Date(cursor),
      utcOffsetMinutes,
    );
    if (!rule) {
      throw new PrecioNoDefinidoError(
        `Sin precio para ${new Date(cursor).toISOString()}`,
      );
    }
    const hours = segmentMinutes / 60;
    total = addMoney(total, mulMoney(rule.precioPorHora, hours));
    cursor = segmentEnd;
  }

  return total;
}

/**
 * Precio de un adicional: base + override por reglas del mismo motor si hay match.
 * `por_hora` multiplica por duración en horas; `por_reserva` es fijo.
 */
export function calculateAdicionalPrice(input: {
  precioBase: Money;
  modalidad: "por_hora" | "por_reserva";
  cantidad: number;
  rules: ReglaPrecio[];
  startsAt: Date;
  endsAt: Date;
  utcOffsetMinutes?: number;
}): Money {
  const {
    precioBase,
    modalidad,
    cantidad,
    rules,
    startsAt,
    endsAt,
    utcOffsetMinutes = AR_UTC_OFFSET_MINUTES,
  } = input;

  const override = resolvePriceRule(rules, startsAt, utcOffsetMinutes);
  const unit = override?.precioPorHora ?? precioBase;

  if (modalidad === "por_reserva") {
    return mulMoney(unit, cantidad);
  }

  const hours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
  return mulMoney(mulMoney(unit, hours), cantidad);
}

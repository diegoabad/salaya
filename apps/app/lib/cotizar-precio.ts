import { calculateSalaPrice, type ReglaPrecio } from "@repo/core";
import { arLocalToUtc, type DiaSemana } from "@repo/shared";
import type { ReglaPrecioDto } from "@/app/actions/precios";

function baseRegla(precioHora: number): ReglaPrecio {
  return {
    id: "__base__",
    tipo: "continuo",
    nombre: "Base",
    daysOfWeek: [],
    startTime: null,
    endTime: null,
    precioPorHora: precioHora.toFixed(2),
    active: true,
  };
}

function toCoreRegla(r: ReglaPrecioDto): ReglaPrecio {
  return {
    id: r.id,
    tipo: r.tipo,
    nombre: r.nombre,
    daysOfWeek: r.daysOfWeek as DiaSemana[],
    startTime: r.startTime,
    endTime: r.endTime,
    fechaDesde: r.fechaDesde,
    fechaHasta: r.fechaHasta,
    precioPorHora: r.precioPorHora.toFixed(2),
    descuentoPorcentaje:
      r.descuentoPorcentaje != null
        ? String(r.descuentoPorcentaje)
        : null,
    active: r.active,
  };
}

/** Cotiza precio de sala con el mismo motor que el picker público. */
export function cotizarPrecioSala(input: {
  precioHoraBase: number | string | null | undefined;
  reglas: ReglaPrecioDto[];
  salaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  /** Segmentación del motor (default 60). Usar granularidad de la sala si aplica. */
  granularityMinutes?: number;
}): number {
  const base = Number(input.precioHoraBase ?? 0);
  if (!(base >= 0) || Number.isNaN(base)) return 0;
  if (!input.fecha || !input.horaInicio || !input.horaFin) return 0;

  const startsAt = arLocalToUtc(input.fecha, input.horaInicio);
  let endsAt = arLocalToUtc(input.fecha, input.horaFin);
  // Cruce de medianoche: fin al día siguiente
  if (!(endsAt > startsAt)) {
    const [y, m, d] = input.fecha.split("-").map(Number);
    const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
    endsAt = arLocalToUtc(next.toISOString().slice(0, 10), input.horaFin);
  }
  if (!(endsAt > startsAt)) return 0;

  const rules: ReglaPrecio[] = [
    ...input.reglas
      .filter(
        (r) =>
          r.active && r.scope === "sala" && r.scopeId === input.salaId,
      )
      .map(toCoreRegla),
    baseRegla(base),
  ];

  try {
    return Number(
      calculateSalaPrice({
        rules,
        startsAt,
        endsAt,
        granularityMinutes: input.granularityMinutes,
      }),
    );
  } catch {
    // Fallback: base × horas si alguna franja no tiene regla
    const hours =
      (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
    return Math.max(0, base * hours);
  }
}

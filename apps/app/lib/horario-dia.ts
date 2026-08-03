import type { HorarioEspecialDto, NegocioDto } from "@/app/actions/negocio";

export type FranjaDia = {
  apertura: string | null;
  cierre: string | null;
  cerrado: boolean;
};

function hhmm(value: string | null | undefined): string | null {
  return value ? value.slice(0, 5) : null;
}

/**
 * Horario de atención de un día puntual: el especial de esa fecha gana sobre
 * el semanal. Si el día está cerrado devuelve `null` en ambos extremos.
 */
export function franjaDelDia(
  fecha: string,
  horarios: NegocioDto["horarios"],
  especiales: HorarioEspecialDto[] = [],
): FranjaDia {
  const cerrado = { ...franjaSemanal(horarios), cerrado: true };
  const especial = especiales.find((e) => e.fecha.slice(0, 10) === fecha);
  if (especial) {
    if (especial.closed) return cerrado;
    return {
      apertura: hhmm(especial.startTime),
      cierre: hhmm(especial.endTime),
      cerrado: false,
    };
  }

  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return cerrado;
  const dow = new Date(y, m - 1, d).getDay();
  const delDia = horarios.filter((h) => h.dayOfWeek === dow);
  if (delDia.length === 0) return cerrado;
  let apertura: string | null = null;
  let cierre: string | null = null;
  for (const row of delDia) {
    const start = hhmm(row.startTime);
    const end = hhmm(row.endTime);
    if (start && (!apertura || start < apertura)) apertura = start;
    if (end && (!cierre || end > cierre)) cierre = end;
  }
  return { apertura, cierre, cerrado: false };
}

/** Franja que cubre toda la semana: se usa cuando el día está cerrado. */
function franjaSemanal(
  horarios: NegocioDto["horarios"],
): Omit<FranjaDia, "cerrado"> {
  let apertura: string | null = null;
  let cierre: string | null = null;
  for (const h of horarios) {
    const start = hhmm(h.startTime);
    const end = hhmm(h.endTime);
    if (start && (!apertura || start < apertura)) apertura = start;
    if (end && (!cierre || end > cierre)) cierre = end;
  }
  return { apertura, cierre };
}

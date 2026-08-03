import {
  AR_UTC_OFFSET_MINUTES,
  durationMinutes,
  localParts,
  parseTimeToMinutes,
  rangesOverlap,
} from "@repo/shared";
import {
  DuracionInvalidaError,
  FueraDeHorarioError,
  SlotOcupadoError,
  StockAdicionalError,
} from "./errors";
import type {
  AdicionalPedido,
  Bloqueo,
  HorarioAtencion,
  HorarioEspecial,
  Intervalo,
  PoliticaDuracion,
  ReservaActiva,
  UsoAdicional,
} from "./types";

function localDateKey(instant: Date, utcOffsetMinutes: number): string {
  const localMs = instant.getTime() + utcOffsetMinutes * 60_000;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function assertDuracionValida(
  startsAt: Date,
  endsAt: Date,
  politica: PoliticaDuracion,
): void {
  const mins = durationMinutes(startsAt, endsAt);
  if (mins < politica.duracionMinMinutos) {
    throw new DuracionInvalidaError(
      `Duración mínima: ${politica.duracionMinMinutos} minutos`,
    );
  }
  if (
    politica.duracionMaxMinutos != null &&
    mins > politica.duracionMaxMinutos
  ) {
    throw new DuracionInvalidaError(
      `Duración máxima: ${politica.duracionMaxMinutos} minutos`,
    );
  }
  if (mins % politica.granularidadMinutos !== 0) {
    throw new DuracionInvalidaError(
      `La duración debe ser múltiplo de ${politica.granularidadMinutos} minutos`,
    );
  }
}

/**
 * Verifica horario de atención.
 * Si hay horario especial para la fecha local, tiene prioridad sobre el semanal.
 */
export function assertDentroDeHorario(
  intervalo: Intervalo,
  horarios: HorarioAtencion[],
  utcOffsetMinutes = AR_UTC_OFFSET_MINUTES,
  especiales: HorarioEspecial[] = [],
): void {
  const start = localParts(intervalo.startsAt, utcOffsetMinutes);
  const end = localParts(intervalo.endsAt, utcOffsetMinutes);
  const fecha = localDateKey(intervalo.startsAt, utcOffsetMinutes);

  if (end.dayOfWeek !== start.dayOfWeek) {
    throw new FueraDeHorarioError("Los turnos no pueden cruzar la medianoche");
  }

  const especial = especiales.find((e) => e.fecha === fecha);
  if (especial) {
    if (especial.closed) {
      throw new FueraDeHorarioError("La sede no atiende ese día");
    }
    if (!especial.startTime || !especial.endTime) {
      throw new FueraDeHorarioError("Horario especial incompleto");
    }
    const from = parseTimeToMinutes(especial.startTime);
    const to = parseTimeToMinutes(especial.endTime);
    if (
      !(
        start.minutes >= from &&
        end.minutes <= to &&
        end.minutes > start.minutes
      )
    ) {
      throw new FueraDeHorarioError();
    }
    return;
  }

  const delDia = horarios.filter((h) => h.dayOfWeek === start.dayOfWeek);
  if (delDia.length === 0) {
    throw new FueraDeHorarioError("La sede no atiende ese día");
  }

  const covered = delDia.some((h) => {
    const from = parseTimeToMinutes(h.startTime);
    const to = parseTimeToMinutes(h.endTime);
    return (
      start.minutes >= from &&
      end.minutes <= to &&
      end.minutes > start.minutes
    );
  });

  if (!covered) {
    throw new FueraDeHorarioError();
  }
}

export function assertSinBloqueo(
  intervalo: Intervalo,
  salaId: string,
  sedeId: string,
  bloqueos: Bloqueo[],
): void {
  const hit = bloqueos.some((b) => {
    const applies =
      b.salaId === salaId || (b.salaId == null && b.sedeId === sedeId);
    return (
      applies &&
      rangesOverlap(intervalo.startsAt, intervalo.endsAt, b.startsAt, b.endsAt)
    );
  });
  if (hit) {
    throw new SlotOcupadoError("Horario bloqueado");
  }
}

export function assertSinReservaSolapada(
  intervalo: Intervalo,
  salaId: string,
  reservas: ReservaActiva[],
  excludeReservaId?: string,
): void {
  const hit = reservas.some(
    (r) =>
      r.salaId === salaId &&
      r.id !== excludeReservaId &&
      rangesOverlap(intervalo.startsAt, intervalo.endsAt, r.startsAt, r.endsAt),
  );
  if (hit) {
    throw new SlotOcupadoError();
  }
}

export function assertStockAdicionales(
  intervalo: Intervalo,
  pedidos: AdicionalPedido[],
  usosExistentes: UsoAdicional[],
): void {
  for (const pedido of pedidos) {
    if (pedido.stock == null) continue;
    const usados = usosExistentes
      .filter(
        (u) =>
          u.adicionalId === pedido.adicionalId &&
          rangesOverlap(
            intervalo.startsAt,
            intervalo.endsAt,
            u.startsAt,
            u.endsAt,
          ),
      )
      .reduce((acc, u) => acc + u.cantidad, 0);

    if (usados + pedido.cantidad > pedido.stock) {
      throw new StockAdicionalError(
        `Stock insuficiente para adicional ${pedido.adicionalId}`,
      );
    }
  }
}

/** Orquesta todas las checks de disponibilidad (sin I/O). */
export function assertDisponible(input: {
  intervalo: Intervalo;
  salaId: string;
  sedeId: string;
  horarios: HorarioAtencion[];
  bloqueos: Bloqueo[];
  reservas: ReservaActiva[];
  politicaDuracion: PoliticaDuracion;
  adicionales?: AdicionalPedido[];
  usosAdicionales?: UsoAdicional[];
  excludeReservaId?: string;
  utcOffsetMinutes?: number;
  horariosEspeciales?: HorarioEspecial[];
}): void {
  assertDuracionValida(
    input.intervalo.startsAt,
    input.intervalo.endsAt,
    input.politicaDuracion,
  );
  assertDentroDeHorario(
    input.intervalo,
    input.horarios,
    input.utcOffsetMinutes,
    input.horariosEspeciales,
  );
  assertSinBloqueo(
    input.intervalo,
    input.salaId,
    input.sedeId,
    input.bloqueos,
  );
  assertSinReservaSolapada(
    input.intervalo,
    input.salaId,
    input.reservas,
    input.excludeReservaId,
  );
  if (input.adicionales?.length) {
    assertStockAdicionales(
      input.intervalo,
      input.adicionales,
      input.usosAdicionales ?? [],
    );
  }
}

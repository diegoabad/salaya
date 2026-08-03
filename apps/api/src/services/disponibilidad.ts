import {
  assertDisponible,
  DuracionInvalidaError,
  FueraDeHorarioError,
  SlotOcupadoError,
  StockAdicionalError,
  type AdicionalPedido,
} from "@repo/core";
import { getDb } from "@repo/db";
import {
  getPoliticaBySede,
  listBloqueosSalaRango,
  listHorariosAtencionSede,
  listHorariosEspecialesSede,
  listReservasActivasSolape,
  listUsosAdicionalesSolape,
} from "@repo/db/queries";
import { POLITICA_DEFAULTS, type DiaSemana } from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";
import { fechaArFromUtc } from "./arTime";

type SalaDuracion = {
  duracionMinMinutos: number | null;
  duracionMaxMinutos: number | null;
  granularidadMinutos: number | null;
};

export async function assertSalaDisponible(input: {
  tenantId: string;
  sedeId: string;
  salaId: string;
  startsAt: Date;
  endsAt: Date;
  excludeReservaId?: string;
  adicionales?: AdicionalPedido[];
  /** Override de duración de la sala (null = hereda política) */
  sala?: SalaDuracion;
}): Promise<void> {
  const db = getDb();
  const fecha = fechaArFromUtc(input.startsAt);

  const [politica, horarios, especiales, bloqueos, reservas, usos] =
    await Promise.all([
      getPoliticaBySede(db, input.sedeId),
      listHorariosAtencionSede(db, input.tenantId, input.sedeId),
      listHorariosEspecialesSede(
        db,
        input.tenantId,
        input.sedeId,
        fecha,
        fecha,
      ),
      listBloqueosSalaRango(
        db,
        input.tenantId,
        input.sedeId,
        input.salaId,
        input.startsAt,
        input.endsAt,
      ),
      listReservasActivasSolape(
        db,
        input.salaId,
        input.startsAt,
        input.endsAt,
        input.excludeReservaId,
      ),
      input.adicionales?.length
        ? listUsosAdicionalesSolape(
            db,
            input.tenantId,
            input.startsAt,
            input.endsAt,
            input.excludeReservaId,
          )
        : Promise.resolve([]),
    ]);

  const politicaDuracion = {
    duracionMinMinutos:
      input.sala?.duracionMinMinutos ??
      politica?.duracionMinMinutos ??
      POLITICA_DEFAULTS.duracionMinMinutos,
    duracionMaxMinutos:
      input.sala?.duracionMaxMinutos ??
      politica?.duracionMaxMinutos ??
      POLITICA_DEFAULTS.duracionMaxMinutos,
    granularidadMinutos:
      input.sala?.granularidadMinutos ??
      politica?.granularidadMinutos ??
      POLITICA_DEFAULTS.granularidadMinutos,
  };

  try {
    assertDisponible({
      intervalo: { startsAt: input.startsAt, endsAt: input.endsAt },
      salaId: input.salaId,
      sedeId: input.sedeId,
      horarios: horarios.map((h) => ({
        dayOfWeek: h.dayOfWeek as DiaSemana,
        startTime: h.startTime,
        endTime: h.endTime,
      })),
      horariosEspeciales: especiales.map((e) => ({
        fecha: e.fecha,
        closed: e.closed,
        startTime: e.startTime,
        endTime: e.endTime,
      })),
      bloqueos: bloqueos.map((b) => ({
        salaId: b.salaId,
        sedeId: b.sedeId,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
      })),
      reservas: reservas.map((r) => ({
        id: r.id,
        salaId: input.salaId,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        estado: r.estado,
      })),
      politicaDuracion,
      adicionales: input.adicionales,
      usosAdicionales: usos,
      excludeReservaId: input.excludeReservaId,
    });
  } catch (err) {
    if (err instanceof DuracionInvalidaError) {
      throw new HttpError(400, "DURACION_INVALIDA", err.message);
    }
    if (err instanceof FueraDeHorarioError) {
      throw new HttpError(400, "FUERA_DE_HORARIO", err.message);
    }
    if (err instanceof StockAdicionalError) {
      throw new HttpError(409, "STOCK_ADICIONAL", err.message);
    }
    if (err instanceof SlotOcupadoError) {
      const code = /bloqueado/i.test(err.message) ? "BLOQUEO" : "HOLD_CONFLICT";
      throw new HttpError(409, code, err.message);
    }
    throw err;
  }
}

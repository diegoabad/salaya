import { assertSinBloqueo, SlotOcupadoError } from "@repo/core";
import { getDb } from "@repo/db";
import {
  deleteBloqueoRow,
  getNegocioBundle,
  getSalaById,
  insertBloqueo,
  listBloqueosSalaRango,
  listBloqueosTenant,
  listSalasTenant,
} from "@repo/db/queries";
import type { CreateBloqueoInput } from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";
import {
  arLocalToUtc,
  fechaArFromUtc,
  formatHoraAr,
} from "./arTime";

function mapBloqueo(row: {
  id: string;
  sedeId: string;
  salaId: string | null;
  salaName?: string | null;
  startsAt: Date;
  endsAt: Date;
  motivo: string | null;
}) {
  return {
    id: row.id,
    sedeId: row.sedeId,
    salaId: row.salaId,
    salaName: row.salaName ?? null,
    fecha: fechaArFromUtc(row.startsAt),
    startTime: formatHoraAr(row.startsAt),
    endTime: formatHoraAr(row.endsAt),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    motivo: row.motivo,
    scope: row.salaId ? ("sala" as const) : ("sede" as const),
  };
}

export async function listBloqueos(tenantId: string) {
  const rows = await listBloqueosTenant(getDb(), tenantId);
  return rows.map(mapBloqueo);
}

export async function createBloqueo(
  tenantId: string,
  input: CreateBloqueoInput,
) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");

  let salaId: string | null = input.salaId ?? null;
  if (salaId) {
    const sala = await getSalaById(db, tenantId, salaId);
    if (!sala || sala.sedeId !== bundle.sede.id) {
      throw new HttpError(400, "SALA_INVALID", "Sala inválida");
    }
  }

  const startsAt = arLocalToUtc(input.fecha, input.startTime);
  const endsAt = arLocalToUtc(input.fecha, input.endTime);
  if (endsAt <= startsAt) {
    throw new HttpError(400, "RANGE_INVALID", "Rango de horas inválido");
  }

  const row = await insertBloqueo(db, tenantId, {
    sedeId: bundle.sede.id,
    salaId,
    startsAt,
    endsAt,
    motivo: input.motivo,
  });

  const salaName = salaId
    ? (await listSalasTenant(db, tenantId)).find((s) => s.id === salaId)?.name
    : null;

  return mapBloqueo({ ...row, salaName: salaName ?? null });
}

export async function deleteBloqueo(tenantId: string, id: string) {
  const row = await deleteBloqueoRow(getDb(), tenantId, id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Bloqueo no encontrado");
}

/** Reutilizable desde holds: lanza HttpError 409 si hay bloqueo */
export async function assertSalaSinBloqueo(input: {
  tenantId: string;
  sedeId: string;
  salaId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  const rows = await listBloqueosSalaRango(
    getDb(),
    input.tenantId,
    input.sedeId,
    input.salaId,
    input.startsAt,
    input.endsAt,
  );
  try {
    assertSinBloqueo(
      { startsAt: input.startsAt, endsAt: input.endsAt },
      input.salaId,
      input.sedeId,
      rows.map((b) => ({
        salaId: b.salaId,
        sedeId: b.sedeId,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
      })),
    );
  } catch (err) {
    if (err instanceof SlotOcupadoError) {
      throw new HttpError(409, "BLOQUEO", err.message || "Horario bloqueado");
    }
    throw err;
  }
}

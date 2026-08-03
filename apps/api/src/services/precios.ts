import { getDb } from "@repo/db";
import {
  deleteReglaPrecioRow,
  getSalaById,
  insertReglaPrecio,
  listReglasPrecio,
  listSalasTenant,
  updateReglaPrecioRow,
} from "@repo/db/queries";
import type {
  CreateReglaPrecioInput,
  UpdateReglaPrecioInput,
} from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";

function serializeRegla(
  r: Awaited<ReturnType<typeof listReglasPrecio>>[number],
  scopeLabel: string,
) {
  return {
    id: r.id,
    scope: r.scope,
    scopeId: r.scopeId,
    scopeLabel,
    tipo: r.tipo,
    nombre: r.nombre ?? "Sin nombre",
    daysOfWeek: r.daysOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    fechaDesde: r.fechaDesde,
    fechaHasta: r.fechaHasta,
    precioPorHora: Number(r.precioPorHora),
    descuentoPorcentaje:
      r.descuentoPorcentaje != null ? Number(r.descuentoPorcentaje) : null,
    active: r.active,
  };
}

export async function listPreciosBundle(tenantId: string) {
  const db = getDb();
  const [salas, reglas] = await Promise.all([
    listSalasTenant(db, tenantId),
    listReglasPrecio(db, tenantId),
  ]);

  const salaMap = new Map(salas.map((s) => [s.id, s.name]));

  return {
    salas: salas.map((s) => ({
      id: s.id,
      name: s.name,
      precioHora: Number(s.precioHora),
      active: s.active,
    })),
    reglas: reglas.map((r) => {
      const label =
        r.scope === "sala"
          ? `Sala · ${salaMap.get(r.scopeId) ?? "—"}`
          : `Adicional · ${r.scopeId.slice(0, 8)}`;
      return serializeRegla(r, label);
    }),
  };
}

export async function createRegla(
  tenantId: string,
  input: CreateReglaPrecioInput,
) {
  const db = getDb();
  if (input.scope === "sala") {
    const sala = await getSalaById(db, tenantId, input.scopeId);
    if (!sala) throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");
  }

  const row = await insertReglaPrecio(db, tenantId, {
    scope: input.scope,
    scopeId: input.scopeId,
    tipo: input.tipo,
    nombre: input.nombre,
    daysOfWeek: input.daysOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    fechaDesde: input.fechaDesde,
    fechaHasta: input.fechaHasta,
    precioPorHora: input.precioPorHora,
    descuentoPorcentaje: input.descuentoPorcentaje,
    active: input.active,
  });

  return serializeRegla(row, input.scope);
}

export async function updateRegla(
  tenantId: string,
  id: string,
  input: UpdateReglaPrecioInput,
) {
  const row = await updateReglaPrecioRow(getDb(), tenantId, id, input);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Regla no encontrada");
  return serializeRegla(row, row.scope);
}

export async function deleteRegla(tenantId: string, id: string) {
  const row = await deleteReglaPrecioRow(getDb(), tenantId, id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Regla no encontrada");
}

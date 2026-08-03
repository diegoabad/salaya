import { getDb } from "@repo/db";
import {
  addClienteCredito,
  getClienteById,
  insertCliente,
  listClientesConStats,
  updateClienteRow,
} from "@repo/db/queries";
import type {
  CargarCreditoClienteInput,
  CreateClienteInput,
  UpdateClienteInput,
} from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";
import { createMovimientoCaja } from "./caja";

function mapCliente(row: Awaited<ReturnType<typeof listClientesConStats>>[number]) {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    email: row.email,
    banda: row.banda,
    noShowCount: row.noShowCount,
    creditoFavor: Number(row.creditoFavor),
    notasInternas: row.notasInternas,
    reservasCount: Number(row.reservasCount ?? 0),
    ultimaReserva: row.ultimaReserva,
    salaHabitual: row.salaHabitual,
  };
}

export async function listClientes(tenantId: string) {
  const rows = await listClientesConStats(getDb(), tenantId);
  return rows.map(mapCliente);
}

export async function createCliente(
  tenantId: string,
  input: CreateClienteInput,
) {
  try {
    const row = await insertCliente(getDb(), tenantId, input);
    return {
      id: row.id,
      nombre: row.nombre,
      telefono: row.telefono,
      email: row.email,
      banda: row.banda,
      noShowCount: row.noShowCount,
      creditoFavor: Number(row.creditoFavor),
      notasInternas: row.notasInternas,
      reservasCount: 0,
      ultimaReserva: null as string | null,
      salaHabitual: null as string | null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("clientes_tenant_telefono_uidx") || msg.includes("unique")) {
      throw new HttpError(409, "TELEFONO_DUPLICADO", "Ya existe un cliente con ese teléfono");
    }
    throw err;
  }
}

export async function updateCliente(
  tenantId: string,
  clienteId: string,
  input: UpdateClienteInput,
) {
  const existing = await getClienteById(getDb(), tenantId, clienteId);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");

  try {
    const row = await updateClienteRow(getDb(), tenantId, clienteId, input);
    if (!row) throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");
    return {
      id: row.id,
      nombre: row.nombre,
      telefono: row.telefono,
      email: row.email,
      banda: row.banda,
      noShowCount: row.noShowCount,
      creditoFavor: Number(row.creditoFavor),
      notasInternas: row.notasInternas,
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("clientes_tenant_telefono_uidx") || msg.includes("unique")) {
      throw new HttpError(409, "TELEFONO_DUPLICADO", "Ya existe un cliente con ese teléfono");
    }
    throw err;
  }
}

/**
 * Suma crédito a favor del cliente y registra el cobro en caja
 * (tipo `credito`, con medio y día).
 */
export async function cargarCreditoCliente(
  tenantId: string,
  clienteId: string,
  input: CargarCreditoClienteInput,
) {
  const db = getDb();
  const existing = await getClienteById(db, tenantId, clienteId);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");

  const montoNum = Number(input.monto);
  if (!(montoNum > 0)) {
    throw new HttpError(400, "MONTO_INVALIDO", "El monto debe ser mayor a 0");
  }

  const updated = await addClienteCredito(db, tenantId, clienteId, input.monto);
  if (!updated) throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");

  const nota = input.nota?.trim();
  const descripcion = nota
    ? `Crédito a favor — ${existing.nombre} · ${nota}`
    : `Crédito a favor — ${existing.nombre}`;

  try {
    const mov = await createMovimientoCaja(tenantId, {
      tipo: "credito",
      medioPago: input.medioPago,
      monto: input.monto,
      fecha: input.fecha,
      descripcion,
      reservaId: null,
    });

    return {
      clienteId,
      creditoFavor: Number(updated.creditoFavor),
      movimientoId: mov.id,
      monto: montoNum,
      medioPago: input.medioPago,
      occurredAt: mov.occurredAt,
    };
  } catch (err) {
    // Revertir crédito si la caja rechaza el movimiento
    await updateClienteRow(db, tenantId, clienteId, {
      creditoFavor: String(Number(existing.creditoFavor)),
    });
    throw err;
  }
}

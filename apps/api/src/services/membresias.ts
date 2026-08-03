import { getDb } from "@repo/db";
import {
  addClienteCredito,
  findMembresiaActivaCliente,
  getClienteById,
  getClienteMembresiaById,
  getMembresiaPlanById,
  insertClienteMembresia,
  insertMembresiaPlan,
  listClienteMembresias,
  listMembresiaPlanes,
  updateClienteMembresiaRow,
  updateMembresiaPlanRow,
} from "@repo/db/queries";
import type {
  AsignarMembresiaInput,
  CreateMembresiaPlanInput,
  RenovarMembresiaInput,
  UpdateMembresiaPlanInput,
} from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";
import { addDaysYmd, todayArDate } from "./arTime";
import { createMovimientoCaja } from "./caja";

function mapPlan(
  row: Awaited<ReturnType<typeof listMembresiaPlanes>>[number],
) {
  return {
    id: row.id,
    name: row.name,
    descripcion: row.descripcion,
    precioMensual: Number(row.precioMensual),
    creditoMensual: Number(row.creditoMensual),
    diasPeriodo: row.diasPeriodo,
    active: row.active,
  };
}

function mapMembresia(
  row: Awaited<ReturnType<typeof listClienteMembresias>>[number],
) {
  return {
    id: row.id,
    clienteId: row.clienteId,
    planId: row.planId,
    estado: row.estado,
    vigenteDesde: row.vigenteDesde,
    vigenteHasta: row.vigenteHasta,
    clienteNombre: row.clienteNombre,
    clienteTelefono: row.clienteTelefono,
    clienteEmail: row.clienteEmail,
    creditoFavor: Number(row.creditoFavor),
    planName: row.planName,
    precioMensual: Number(row.precioMensual),
    creditoMensual: Number(row.creditoMensual),
    diasPeriodo: row.diasPeriodo,
  };
}

export async function listMembresiasBundle(tenantId: string) {
  const [planes, membresias] = await Promise.all([
    listMembresiaPlanes(getDb(), tenantId),
    listClienteMembresias(getDb(), tenantId),
  ]);
  return {
    planes: planes.map(mapPlan),
    membresias: membresias.map(mapMembresia),
  };
}

export async function createPlan(
  tenantId: string,
  input: CreateMembresiaPlanInput,
) {
  if (Number(input.precioMensual) < 0 || Number(input.creditoMensual) < 0) {
    throw new HttpError(400, "MONTO_INVALIDO", "Los montos no pueden ser negativos");
  }
  const row = await insertMembresiaPlan(getDb(), tenantId, {
    name: input.name,
    descripcion: input.descripcion,
    precioMensual: input.precioMensual,
    creditoMensual: input.creditoMensual,
    diasPeriodo: input.diasPeriodo,
    active: input.active,
  });
  return mapPlan(row);
}

export async function updatePlan(
  tenantId: string,
  id: string,
  input: UpdateMembresiaPlanInput,
) {
  const row = await updateMembresiaPlanRow(getDb(), tenantId, id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.descripcion !== undefined
      ? { descripcion: input.descripcion }
      : {}),
    ...(input.precioMensual !== undefined
      ? { precioMensual: input.precioMensual }
      : {}),
    ...(input.creditoMensual !== undefined
      ? { creditoMensual: input.creditoMensual }
      : {}),
    ...(input.diasPeriodo !== undefined
      ? { diasPeriodo: input.diasPeriodo }
      : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Plan no encontrado");
  return mapPlan(row);
}

async function cobrarPeriodo(input: {
  tenantId: string;
  clienteId: string;
  clienteNombre: string;
  planName: string;
  precioMensual: string;
  creditoMensual: string;
  medioPago: AsignarMembresiaInput["medioPago"];
  nota?: string | null;
  fecha?: string;
}) {
  const creditoNum = Number(input.creditoMensual);
  if (creditoNum > 0) {
    await addClienteCredito(
      getDb(),
      input.tenantId,
      input.clienteId,
      input.creditoMensual,
    );
  }

  const nota = input.nota?.trim();
  const descripcion = nota
    ? `Membresía ${input.planName} — ${input.clienteNombre} · ${nota}`
    : `Membresía ${input.planName} — ${input.clienteNombre}`;

  await createMovimientoCaja(input.tenantId, {
    tipo: "membresia",
    medioPago: input.medioPago,
    monto: input.precioMensual,
    descripcion,
    fecha: input.fecha,
    reservaId: null,
  });
}

export async function asignarMembresia(
  tenantId: string,
  input: AsignarMembresiaInput,
) {
  const db = getDb();
  const cliente = await getClienteById(db, tenantId, input.clienteId);
  if (!cliente) throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");

  const plan = await getMembresiaPlanById(db, tenantId, input.planId);
  if (!plan || !plan.active) {
    throw new HttpError(404, "NOT_FOUND", "Plan no encontrado o inactivo");
  }

  const existing = await findMembresiaActivaCliente(
    db,
    tenantId,
    input.clienteId,
  );
  if (existing) {
    throw new HttpError(
      409,
      "YA_TIENE_MEMBRESIA",
      "Este cliente ya tiene una membresía activa. Renovala o cancelala antes.",
    );
  }

  const hoy = todayArDate();
  const cobrar = input.cobrarAhora !== false;
  const vigenteDesde = hoy;
  const vigenteHasta = cobrar
    ? addDaysYmd(hoy, plan.diasPeriodo - 1)
    : addDaysYmd(hoy, -1); // sin cobro: ya vencida hasta que renueven

  if (cobrar) {
    await cobrarPeriodo({
      tenantId,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      planName: plan.name,
      precioMensual: plan.precioMensual,
      creditoMensual: plan.creditoMensual,
      medioPago: input.medioPago,
      nota: input.nota,
    });
  }

  const row = await insertClienteMembresia(db, tenantId, {
    clienteId: cliente.id,
    planId: plan.id,
    estado: "activa",
    vigenteDesde,
    vigenteHasta,
  });

  return {
    id: row.id,
    clienteId: row.clienteId,
    planId: row.planId,
    estado: row.estado,
    vigenteDesde: row.vigenteDesde,
    vigenteHasta: row.vigenteHasta,
    cobrado: cobrar,
  };
}

export async function renovarMembresia(
  tenantId: string,
  membresiaId: string,
  input: RenovarMembresiaInput,
) {
  const db = getDb();
  const mem = await getClienteMembresiaById(db, tenantId, membresiaId);
  if (!mem) throw new HttpError(404, "NOT_FOUND", "Membresía no encontrada");
  if (mem.estado === "cancelada") {
    throw new HttpError(409, "CANCELADA", "La membresía está cancelada");
  }

  const plan = await getMembresiaPlanById(db, tenantId, mem.planId);
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Plan no encontrado");

  const cliente = await getClienteById(db, tenantId, mem.clienteId);
  if (!cliente) throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");

  const hoy = todayArDate();
  // Si aún vigente, extender desde el día siguiente al fin; si venció, desde hoy
  const base =
    mem.vigenteHasta >= hoy ? addDaysYmd(mem.vigenteHasta, 1) : hoy;
  const vigenteDesde = base;
  const vigenteHasta = addDaysYmd(base, plan.diasPeriodo - 1);

  await cobrarPeriodo({
    tenantId,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    planName: plan.name,
    precioMensual: plan.precioMensual,
    creditoMensual: plan.creditoMensual,
    medioPago: input.medioPago,
    nota: input.nota,
    fecha: input.fecha,
  });

  const row = await updateClienteMembresiaRow(db, tenantId, membresiaId, {
    estado: "activa",
    vigenteDesde,
    vigenteHasta,
  });

  return {
    id: row!.id,
    vigenteDesde: row!.vigenteDesde,
    vigenteHasta: row!.vigenteHasta,
    creditoCargado: Number(plan.creditoMensual),
    montoCobrado: Number(plan.precioMensual),
  };
}

export async function setMembresiaEstado(
  tenantId: string,
  membresiaId: string,
  estado: "activa" | "pausada" | "cancelada",
) {
  const row = await updateClienteMembresiaRow(getDb(), tenantId, membresiaId, {
    estado,
  });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Membresía no encontrada");
  return {
    id: row.id,
    estado: row.estado,
  };
}

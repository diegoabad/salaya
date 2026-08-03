import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { clienteMembresias, clientes, membresiaPlanes } from "../schema";

export async function listMembresiaPlanes(db: Database, tenantId: string) {
  return db
    .select()
    .from(membresiaPlanes)
    .where(eq(membresiaPlanes.tenantId, tenantId))
    .orderBy(asc(membresiaPlanes.sortOrder), asc(membresiaPlanes.name));
}

export async function getMembresiaPlanById(
  db: Database,
  tenantId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(membresiaPlanes)
    .where(
      and(eq(membresiaPlanes.tenantId, tenantId), eq(membresiaPlanes.id, id)),
    )
    .limit(1);
  return row ?? null;
}

export async function insertMembresiaPlan(
  db: Database,
  tenantId: string,
  input: {
    name: string;
    descripcion?: string | null;
    precioMensual: string;
    creditoMensual: string;
    diasPeriodo?: number;
    active?: boolean;
  },
) {
  const [row] = await db
    .insert(membresiaPlanes)
    .values({
      tenantId,
      name: input.name,
      descripcion: input.descripcion ?? null,
      precioMensual: input.precioMensual,
      creditoMensual: input.creditoMensual,
      diasPeriodo: input.diasPeriodo ?? 30,
      active: input.active ?? true,
    })
    .returning();
  return row!;
}

export async function updateMembresiaPlanRow(
  db: Database,
  tenantId: string,
  id: string,
  patch: Partial<{
    name: string;
    descripcion: string | null;
    precioMensual: string;
    creditoMensual: string;
    diasPeriodo: number;
    active: boolean;
  }>,
) {
  const [row] = await db
    .update(membresiaPlanes)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(membresiaPlanes.tenantId, tenantId), eq(membresiaPlanes.id, id)),
    )
    .returning();
  return row ?? null;
}

export async function listClienteMembresias(
  db: Database,
  tenantId: string,
) {
  return db
    .select({
      id: clienteMembresias.id,
      clienteId: clienteMembresias.clienteId,
      planId: clienteMembresias.planId,
      estado: clienteMembresias.estado,
      vigenteDesde: clienteMembresias.vigenteDesde,
      vigenteHasta: clienteMembresias.vigenteHasta,
      createdAt: clienteMembresias.createdAt,
      clienteNombre: clientes.nombre,
      clienteTelefono: clientes.telefono,
      clienteEmail: clientes.email,
      creditoFavor: clientes.creditoFavor,
      planName: membresiaPlanes.name,
      precioMensual: membresiaPlanes.precioMensual,
      creditoMensual: membresiaPlanes.creditoMensual,
      diasPeriodo: membresiaPlanes.diasPeriodo,
    })
    .from(clienteMembresias)
    .innerJoin(clientes, eq(clientes.id, clienteMembresias.clienteId))
    .innerJoin(
      membresiaPlanes,
      eq(membresiaPlanes.id, clienteMembresias.planId),
    )
    .where(eq(clienteMembresias.tenantId, tenantId))
    .orderBy(desc(clienteMembresias.updatedAt));
}

export async function getClienteMembresiaById(
  db: Database,
  tenantId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(clienteMembresias)
    .where(
      and(
        eq(clienteMembresias.tenantId, tenantId),
        eq(clienteMembresias.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findMembresiaActivaCliente(
  db: Database,
  tenantId: string,
  clienteId: string,
) {
  const [row] = await db
    .select()
    .from(clienteMembresias)
    .where(
      and(
        eq(clienteMembresias.tenantId, tenantId),
        eq(clienteMembresias.clienteId, clienteId),
        eq(clienteMembresias.estado, "activa"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertClienteMembresia(
  db: Database,
  tenantId: string,
  input: {
    clienteId: string;
    planId: string;
    estado?: "activa" | "pausada" | "cancelada";
    vigenteDesde: string;
    vigenteHasta: string;
  },
) {
  const [row] = await db
    .insert(clienteMembresias)
    .values({
      tenantId,
      clienteId: input.clienteId,
      planId: input.planId,
      estado: input.estado ?? "activa",
      vigenteDesde: input.vigenteDesde,
      vigenteHasta: input.vigenteHasta,
    })
    .returning();
  return row!;
}

export async function updateClienteMembresiaRow(
  db: Database,
  tenantId: string,
  id: string,
  patch: Partial<{
    estado: "activa" | "pausada" | "cancelada";
    planId: string;
    vigenteDesde: string;
    vigenteHasta: string;
  }>,
) {
  const [row] = await db
    .update(clienteMembresias)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(clienteMembresias.tenantId, tenantId),
        eq(clienteMembresias.id, id),
      ),
    )
    .returning();
  return row ?? null;
}

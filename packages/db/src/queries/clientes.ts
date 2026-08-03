import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  clienteMembresias,
  clientes,
  membresiaPlanes,
  reservas,
  salas,
} from "../schema";

export async function listClientesConStats(db: Database, tenantId: string) {
  const rows = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      telefono: clientes.telefono,
      email: clientes.email,
      banda: clientes.banda,
      noShowCount: clientes.noShowCount,
      creditoFavor: clientes.creditoFavor,
      notasInternas: clientes.notasInternas,
      createdAt: clientes.createdAt,
      reservasCount: sql<number>`cast(count(${reservas.id}) as int)`,
      ultimaReserva: sql<string | null>`to_char(max(${reservas.startsAt}) at time zone 'UTC', 'YYYY-MM-DD')`,
    })
    .from(clientes)
    .leftJoin(
      reservas,
      and(
        eq(reservas.clienteId, clientes.id),
        eq(reservas.tenantId, tenantId),
        sql`${reservas.estado} not in ('cancelada')`,
      ),
    )
    .where(eq(clientes.tenantId, tenantId))
    .groupBy(clientes.id)
    .orderBy(desc(clientes.updatedAt));

  const salaCounts = await db
    .select({
      clienteId: reservas.clienteId,
      salaName: salas.name,
      cnt: sql<number>`cast(count(*) as int)`,
    })
    .from(reservas)
    .innerJoin(salas, eq(salas.id, reservas.salaId))
    .where(
      and(
        eq(reservas.tenantId, tenantId),
        isNotNull(reservas.clienteId),
        sql`${reservas.estado} not in ('cancelada')`,
      ),
    )
    .groupBy(reservas.clienteId, salas.name);

  const salaByCliente = new Map<string, { name: string; cnt: number }>();
  for (const r of salaCounts) {
    if (!r.clienteId) continue;
    const cnt = Number(r.cnt);
    const prev = salaByCliente.get(r.clienteId);
    if (!prev || cnt > prev.cnt) {
      salaByCliente.set(r.clienteId, { name: r.salaName, cnt });
    }
  }

  const abonosActivos = await db
    .select({
      clienteId: clienteMembresias.clienteId,
      planName: membresiaPlanes.name,
      updatedAt: clienteMembresias.updatedAt,
    })
    .from(clienteMembresias)
    .innerJoin(
      membresiaPlanes,
      eq(membresiaPlanes.id, clienteMembresias.planId),
    )
    .where(
      and(
        eq(clienteMembresias.tenantId, tenantId),
        eq(clienteMembresias.estado, "activa"),
      ),
    )
    .orderBy(desc(clienteMembresias.updatedAt));

  const abonoByCliente = new Map<string, string>();
  for (const a of abonosActivos) {
    if (!abonoByCliente.has(a.clienteId)) {
      abonoByCliente.set(a.clienteId, a.planName);
    }
  }

  return rows.map((row) => ({
    ...row,
    salaHabitual: salaByCliente.get(row.id)?.name ?? null,
    abonoNombre: abonoByCliente.get(row.id) ?? null,
  }));
}

export async function getClienteById(
  db: Database,
  tenantId: string,
  clienteId: string,
) {
  return db.query.clientes.findFirst({
    where: (c, { and, eq }) =>
      and(eq(c.tenantId, tenantId), eq(c.id, clienteId)),
  });
}

export async function insertCliente(
  db: Database,
  tenantId: string,
  input: {
    nombre: string;
    telefono: string;
    email?: string | null;
    banda?: string | null;
    notasInternas?: string | null;
    creditoFavor?: string;
  },
) {
  const telefono = input.telefono.replace(/\s+/g, " ").trim();
  const [row] = await db
    .insert(clientes)
    .values({
      tenantId,
      telefono,
      nombre: input.nombre.trim(),
      email: input.email ?? null,
      banda: input.banda ?? null,
      notasInternas: input.notasInternas ?? null,
      creditoFavor: input.creditoFavor ?? "0",
    })
    .returning();
  return row!;
}

export async function updateClienteRow(
  db: Database,
  tenantId: string,
  clienteId: string,
  patch: Partial<{
    nombre: string;
    telefono: string;
    email: string | null;
    banda: string | null;
    notasInternas: string | null;
    creditoFavor: string;
  }>,
) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.nombre !== undefined) values.nombre = patch.nombre.trim();
  if (patch.telefono !== undefined) {
    values.telefono = patch.telefono.replace(/\s+/g, " ").trim();
  }
  if (patch.email !== undefined) values.email = patch.email;
  if (patch.banda !== undefined) values.banda = patch.banda;
  if (patch.notasInternas !== undefined) values.notasInternas = patch.notasInternas;
  if (patch.creditoFavor !== undefined) values.creditoFavor = patch.creditoFavor;

  const [row] = await db
    .update(clientes)
    .set(values)
    .where(and(eq(clientes.tenantId, tenantId), eq(clientes.id, clienteId)))
    .returning();
  return row ?? null;
}

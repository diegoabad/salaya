import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Database } from "../client";
import { clientes, reservas, salas } from "../schema";

export async function listReservasByCliente(
  db: Database,
  tenantId: string,
  clienteId: string,
  limit = 40,
) {
  return db
    .select({
      id: reservas.id,
      salaId: reservas.salaId,
      salaName: salas.name,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
      estado: reservas.estado,
      origen: reservas.origen,
      precioTotal: reservas.precioTotal,
      senaMonto: reservas.senaMonto,
      senaPagada: reservas.senaPagada,
    })
    .from(reservas)
    .innerJoin(salas, eq(salas.id, reservas.salaId))
    .where(
      and(
        eq(reservas.tenantId, tenantId),
        eq(reservas.clienteId, clienteId),
        sql`${reservas.estado} not in ('hold')`,
      ),
    )
    .orderBy(sql`${reservas.startsAt} desc`)
    .limit(limit);
}

export async function listReservasRango(
  db: Database,
  tenantId: string,
  from: Date,
  to: Date,
) {
  return db
    .select({
      id: reservas.id,
      salaId: reservas.salaId,
      salaName: salas.name,
      clienteId: reservas.clienteId,
      clienteNombre: clientes.nombre,
      clienteTelefono: clientes.telefono,
      clienteEmail: clientes.email,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
      estado: reservas.estado,
      origen: reservas.origen,
      holdExpiresAt: reservas.holdExpiresAt,
      createdAt: reservas.createdAt,
      precioSala: reservas.precioSala,
      precioAdicionales: reservas.precioAdicionales,
      precioTotal: reservas.precioTotal,
      senaMonto: reservas.senaMonto,
      senaPagada: reservas.senaPagada,
    })
    .from(reservas)
    .innerJoin(salas, eq(salas.id, reservas.salaId))
    .leftJoin(clientes, eq(clientes.id, reservas.clienteId))
    .where(
      and(
        eq(reservas.tenantId, tenantId),
        gte(reservas.startsAt, from),
        lt(reservas.startsAt, to),
        sql`${reservas.estado} not in ('cancelada')`,
      ),
    )
    .orderBy(reservas.startsAt);
}

export async function getReservaById(
  db: Database,
  tenantId: string,
  reservaId: string,
) {
  const rows = await db
    .select({
      id: reservas.id,
      tenantId: reservas.tenantId,
      sedeId: reservas.sedeId,
      salaId: reservas.salaId,
      clienteId: reservas.clienteId,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
      estado: reservas.estado,
      origen: reservas.origen,
      precioSala: reservas.precioSala,
      precioAdicionales: reservas.precioAdicionales,
      precioTotal: reservas.precioTotal,
      senaMonto: reservas.senaMonto,
      senaPagada: reservas.senaPagada,
      clienteNombre: clientes.nombre,
      clienteTelefono: clientes.telefono,
      clienteEmail: clientes.email,
      noShowCount: clientes.noShowCount,
      creditoFavor: clientes.creditoFavor,
    })
    .from(reservas)
    .leftJoin(clientes, eq(clientes.id, reservas.clienteId))
    .where(and(eq(reservas.tenantId, tenantId), eq(reservas.id, reservaId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Lookup público por id (cancelación por link) */
export async function getReservaPublicaById(db: Database, reservaId: string) {
  const rows = await db
    .select({
      id: reservas.id,
      tenantId: reservas.tenantId,
      sedeId: reservas.sedeId,
      salaId: reservas.salaId,
      salaName: salas.name,
      clienteId: reservas.clienteId,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
      estado: reservas.estado,
      precioTotal: reservas.precioTotal,
      senaMonto: reservas.senaMonto,
      senaPagada: reservas.senaPagada,
      clienteNombre: clientes.nombre,
      clienteEmail: clientes.email,
    })
    .from(reservas)
    .innerJoin(salas, eq(salas.id, reservas.salaId))
    .leftJoin(clientes, eq(clientes.id, reservas.clienteId))
    .where(eq(reservas.id, reservaId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateReservaEstado(
  db: Database,
  tenantId: string,
  reservaId: string,
  patch: Partial<{
    estado: typeof reservas.$inferInsert.estado;
    canceladoPor: typeof reservas.$inferInsert.canceladoPor;
    canceladoAt: Date | null;
    cancelMotivo: string | null;
    senaPagada: boolean;
    senaMonto: string;
  }>,
) {
  const [row] = await db
    .update(reservas)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(reservas.tenantId, tenantId), eq(reservas.id, reservaId)))
    .returning();
  return row ?? null;
}

export async function updateReservaHorario(
  db: Database,
  tenantId: string,
  reservaId: string,
  input: { startsAt: Date; endsAt: Date },
) {
  const [row] = await db
    .update(reservas)
    .set({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      updatedAt: new Date(),
    })
    .where(and(eq(reservas.tenantId, tenantId), eq(reservas.id, reservaId)))
    .returning();
  return row ?? null;
}

export async function updateReservaPrecios(
  db: Database,
  tenantId: string,
  reservaId: string,
  input: {
    precioSala?: string;
    precioAdicionales: string;
    precioTotal: string;
  },
) {
  const [row] = await db
    .update(reservas)
    .set({
      ...(input.precioSala != null ? { precioSala: input.precioSala } : {}),
      precioAdicionales: input.precioAdicionales,
      precioTotal: input.precioTotal,
      updatedAt: new Date(),
    })
    .where(and(eq(reservas.tenantId, tenantId), eq(reservas.id, reservaId)))
    .returning();
  return row ?? null;
}

export async function incrementClienteNoShow(
  db: Database,
  tenantId: string,
  clienteId: string,
) {
  const [row] = await db
    .update(clientes)
    .set({
      noShowCount: sql`${clientes.noShowCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(clientes.tenantId, tenantId), eq(clientes.id, clienteId)))
    .returning();
  return row ?? null;
}

/** Reservas próximas con email, para recordatorios */
export async function listReservasParaRecordatorio(
  db: Database,
  from: Date,
  to: Date,
) {
  return db
    .select({
      id: reservas.id,
      tenantId: reservas.tenantId,
      salaName: salas.name,
      clienteNombre: clientes.nombre,
      clienteEmail: clientes.email,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
      estado: reservas.estado,
    })
    .from(reservas)
    .innerJoin(salas, eq(salas.id, reservas.salaId))
    .innerJoin(clientes, eq(clientes.id, reservas.clienteId))
    .where(
      and(
        gte(reservas.startsAt, from),
        lt(reservas.startsAt, to),
        sql`${reservas.estado} in ('confirmada', 'senada')`,
        sql`${clientes.email} is not null`,
        sql`${clientes.email} like '%@%'`,
      ),
    )
    .orderBy(reservas.startsAt);
}

export async function addClienteCredito(
  db: Database,
  tenantId: string,
  clienteId: string,
  monto: string,
) {
  const [row] = await db
    .update(clientes)
    .set({
      creditoFavor: sql`${clientes.creditoFavor}::numeric + ${monto}::numeric`,
      updatedAt: new Date(),
    })
    .where(and(eq(clientes.tenantId, tenantId), eq(clientes.id, clienteId)))
    .returning();
  return row ?? null;
}

export async function upsertClienteByTelefono(
  db: Database,
  tenantId: string,
  input: { telefono: string; nombre: string; email?: string | null },
) {
  const telefono = input.telefono.replace(/\s+/g, " ").trim();
  const existing = await db.query.clientes.findFirst({
    where: (c, { and, eq }) =>
      and(eq(c.tenantId, tenantId), eq(c.telefono, telefono)),
  });
  if (existing) {
    if (
      existing.nombre !== input.nombre ||
      (input.email && existing.email !== input.email)
    ) {
      const [updated] = await db
        .update(clientes)
        .set({
          nombre: input.nombre,
          email: input.email ?? existing.email,
          updatedAt: new Date(),
        })
        .where(eq(clientes.id, existing.id))
        .returning();
      return updated!;
    }
    return existing;
  }
  const [created] = await db
    .insert(clientes)
    .values({
      tenantId,
      telefono,
      nombre: input.nombre,
      email: input.email ?? null,
    })
    .returning();
  return created!;
}

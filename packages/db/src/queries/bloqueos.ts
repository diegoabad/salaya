import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { Database } from "../client";
import { bloqueos, salas } from "../schema";

export async function listBloqueosTenant(
  db: Database,
  tenantId: string,
  opts?: { from?: Date; to?: Date },
) {
  const conds = [eq(bloqueos.tenantId, tenantId)];
  if (opts?.from && opts?.to) {
    conds.push(lt(bloqueos.startsAt, opts.to));
    conds.push(gt(bloqueos.endsAt, opts.from));
  }
  return db
    .select({
      id: bloqueos.id,
      sedeId: bloqueos.sedeId,
      salaId: bloqueos.salaId,
      salaName: salas.name,
      startsAt: bloqueos.startsAt,
      endsAt: bloqueos.endsAt,
      motivo: bloqueos.motivo,
      createdAt: bloqueos.createdAt,
    })
    .from(bloqueos)
    .leftJoin(salas, eq(salas.id, bloqueos.salaId))
    .where(and(...conds))
    .orderBy(asc(bloqueos.startsAt));
}

/** Bloqueos que afectan una sala (propios o de toda la sede) en un rango */
export async function listBloqueosSalaRango(
  db: Database,
  tenantId: string,
  sedeId: string,
  salaId: string,
  from: Date,
  to: Date,
) {
  return db
    .select({
      id: bloqueos.id,
      sedeId: bloqueos.sedeId,
      salaId: bloqueos.salaId,
      startsAt: bloqueos.startsAt,
      endsAt: bloqueos.endsAt,
      motivo: bloqueos.motivo,
    })
    .from(bloqueos)
    .where(
      and(
        eq(bloqueos.tenantId, tenantId),
        eq(bloqueos.sedeId, sedeId),
        or(eq(bloqueos.salaId, salaId), isNull(bloqueos.salaId)),
        lt(bloqueos.startsAt, to),
        gt(bloqueos.endsAt, from),
      ),
    )
    .orderBy(asc(bloqueos.startsAt));
}

export async function insertBloqueo(
  db: Database,
  tenantId: string,
  input: {
    sedeId: string;
    salaId?: string | null;
    startsAt: Date;
    endsAt: Date;
    motivo?: string | null;
  },
) {
  const [row] = await db
    .insert(bloqueos)
    .values({
      tenantId,
      sedeId: input.sedeId,
      salaId: input.salaId ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      motivo: input.motivo ?? null,
    })
    .returning();
  return row!;
}

export async function deleteBloqueoRow(
  db: Database,
  tenantId: string,
  id: string,
) {
  const [row] = await db
    .delete(bloqueos)
    .where(and(eq(bloqueos.tenantId, tenantId), eq(bloqueos.id, id)))
    .returning({ id: bloqueos.id });
  return row ?? null;
}

import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import type { Database } from "../client";
import { politicas, reservas, salas } from "../schema";
import { RESERVA_ESTADOS_ACTIVOS } from "@repo/shared";

export async function findSalaPublicaById(db: Database, salaId: string) {
  return db.query.salas.findFirst({
    where: (s, { and, eq, isNull }) =>
      and(eq(s.id, salaId), isNull(s.deletedAt), eq(s.active, true)),
  });
}

export async function getPoliticaBySede(db: Database, sedeId: string) {
  return db.query.politicas.findFirst({
    where: eq(politicas.sedeId, sedeId),
  });
}

export async function listHoldsActivosSala(
  db: Database,
  salaId: string,
  now: Date,
  fechaStart?: Date,
  fechaEnd?: Date,
) {
  const conds = [
    eq(reservas.salaId, salaId),
    eq(reservas.estado, "hold" as const),
    gt(reservas.holdExpiresAt, now),
  ];
  if (fechaStart && fechaEnd) {
    conds.push(lt(reservas.startsAt, fechaEnd));
    conds.push(gt(reservas.endsAt, fechaStart));
  }
  return db
    .select()
    .from(reservas)
    .where(and(...conds))
    .orderBy(reservas.startsAt);
}

export async function findHoldBySession(
  db: Database,
  salaId: string,
  sessionId: string,
  now: Date,
) {
  const rows = await db
    .select()
    .from(reservas)
    .where(
      and(
        eq(reservas.salaId, salaId),
        eq(reservas.holdSessionId, sessionId),
        eq(reservas.estado, "hold"),
        gt(reservas.holdExpiresAt, now),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function expireHoldsPast(db: Database, now: Date) {
  return db
    .update(reservas)
    .set({ estado: "vencida", updatedAt: now })
    .where(
      and(
        eq(reservas.estado, "hold"),
        lt(reservas.holdExpiresAt, now),
      ),
    )
    .returning({
      id: reservas.id,
      salaId: reservas.salaId,
      holdSessionId: reservas.holdSessionId,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
    });
}

export async function listReservasActivasSolape(
  db: Database,
  salaId: string,
  from: Date,
  to: Date,
  excludeId?: string,
) {
  return db
    .select({
      id: reservas.id,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
      estado: reservas.estado,
      holdSessionId: reservas.holdSessionId,
    })
    .from(reservas)
    .where(
      and(
        eq(reservas.salaId, salaId),
        inArray(reservas.estado, [...RESERVA_ESTADOS_ACTIVOS]),
        lt(reservas.startsAt, to),
        gt(reservas.endsAt, from),
        // holds vencidos no deberían estar activos, pero por las dudas
        sql`(${reservas.estado} != 'hold' OR ${reservas.holdExpiresAt} > now())`,
        excludeId ? ne(reservas.id, excludeId) : undefined,
      ),
    );
}

export async function insertHoldReserva(
  db: Database,
  values: typeof reservas.$inferInsert,
) {
  const [row] = await db.insert(reservas).values(values).returning();
  return row!;
}

export async function updateHoldReserva(
  db: Database,
  id: string,
  patch: Partial<typeof reservas.$inferInsert>,
) {
  const [row] = await db
    .update(reservas)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(reservas.id, id))
    .returning();
  return row ?? null;
}

export async function listOcupacionDia(
  db: Database,
  salaId: string,
  from: Date,
  to: Date,
) {
  return db
    .select({
      id: reservas.id,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
      estado: reservas.estado,
      holdSessionId: reservas.holdSessionId,
      holdExpiresAt: reservas.holdExpiresAt,
    })
    .from(reservas)
    .where(
      and(
        eq(reservas.salaId, salaId),
        inArray(reservas.estado, [...RESERVA_ESTADOS_ACTIVOS]),
        lt(reservas.startsAt, to),
        gt(reservas.endsAt, from),
        sql`(${reservas.estado} != 'hold' OR ${reservas.holdExpiresAt} > now())`,
      ),
    );
}

export { salas };

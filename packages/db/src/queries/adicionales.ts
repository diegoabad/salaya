import { and, asc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  adicionalGrupos,
  adicionales,
  reservaAdicionales,
  reservas,
} from "../schema";
import { RESERVA_ESTADOS_ACTIVOS } from "@repo/shared";

export async function listAdicionalesConGrupo(db: Database, tenantId: string) {
  return db
    .select({
      id: adicionales.id,
      grupoId: adicionales.grupoId,
      grupoName: adicionalGrupos.name,
      name: adicionales.name,
      precioBase: adicionales.precioBase,
      modalidad: adicionales.modalidad,
      stock: adicionales.stock,
      active: adicionales.active,
      caracteristicas: adicionales.caracteristicas,
      photoUrl: adicionales.photoUrl,
      sortOrderGrupo: adicionalGrupos.sortOrder,
    })
    .from(adicionales)
    .innerJoin(adicionalGrupos, eq(adicionalGrupos.id, adicionales.grupoId))
    .where(eq(adicionales.tenantId, tenantId))
    .orderBy(asc(adicionalGrupos.sortOrder), asc(adicionales.name));
}

export async function listAdicionalesPublicosSede(
  db: Database,
  tenantId: string,
  sedeId: string,
) {
  return db
    .select({
      id: adicionales.id,
      grupoId: adicionales.grupoId,
      grupoName: adicionalGrupos.name,
      name: adicionales.name,
      precioBase: adicionales.precioBase,
      modalidad: adicionales.modalidad,
      stock: adicionales.stock,
      caracteristicas: adicionales.caracteristicas,
      photoUrl: adicionales.photoUrl,
      sortOrderGrupo: adicionalGrupos.sortOrder,
    })
    .from(adicionales)
    .innerJoin(adicionalGrupos, eq(adicionalGrupos.id, adicionales.grupoId))
    .where(
      and(
        eq(adicionales.tenantId, tenantId),
        eq(adicionalGrupos.sedeId, sedeId),
        eq(adicionales.active, true),
      ),
    )
    .orderBy(asc(adicionalGrupos.sortOrder), asc(adicionales.name));
}

export async function listAdicionalesByIds(
  db: Database,
  tenantId: string,
  ids: string[],
) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(adicionales)
    .where(
      and(
        eq(adicionales.tenantId, tenantId),
        inArray(adicionales.id, ids),
        eq(adicionales.active, true),
      ),
    );
}

export async function listUsosAdicionalesSolape(
  db: Database,
  tenantId: string,
  from: Date,
  to: Date,
  excludeReservaId?: string,
) {
  return db
    .select({
      adicionalId: reservaAdicionales.adicionalId,
      cantidad: reservaAdicionales.cantidad,
      startsAt: reservas.startsAt,
      endsAt: reservas.endsAt,
    })
    .from(reservaAdicionales)
    .innerJoin(reservas, eq(reservas.id, reservaAdicionales.reservaId))
    .where(
      and(
        eq(reservaAdicionales.tenantId, tenantId),
        inArray(reservas.estado, [...RESERVA_ESTADOS_ACTIVOS]),
        lt(reservas.startsAt, to),
        gt(reservas.endsAt, from),
        sql`(${reservas.estado} != 'hold' OR ${reservas.holdExpiresAt} > now())`,
        excludeReservaId ? ne(reservas.id, excludeReservaId) : undefined,
      ),
    );
}

export async function listReservaAdicionales(db: Database, reservaId: string) {
  return db
    .select({
      adicionalId: reservaAdicionales.adicionalId,
      cantidad: reservaAdicionales.cantidad,
      precioUnitario: reservaAdicionales.precioUnitario,
      modalidad: reservaAdicionales.modalidad,
      name: adicionales.name,
    })
    .from(reservaAdicionales)
    .innerJoin(adicionales, eq(adicionales.id, reservaAdicionales.adicionalId))
    .where(eq(reservaAdicionales.reservaId, reservaId));
}

export async function listReservasAdicionales(
  db: Database,
  tenantId: string,
  reservaIds: string[],
) {
  if (reservaIds.length === 0) return [];
  return db
    .select({
      reservaId: reservaAdicionales.reservaId,
      adicionalId: reservaAdicionales.adicionalId,
      cantidad: reservaAdicionales.cantidad,
      precioUnitario: reservaAdicionales.precioUnitario,
      modalidad: reservaAdicionales.modalidad,
      name: adicionales.name,
    })
    .from(reservaAdicionales)
    .innerJoin(adicionales, eq(adicionales.id, reservaAdicionales.adicionalId))
    .where(
      and(
        eq(reservaAdicionales.tenantId, tenantId),
        inArray(reservaAdicionales.reservaId, reservaIds),
      ),
    );
}

export async function replaceReservaAdicionales(
  db: Database,
  tenantId: string,
  reservaId: string,
  lines: Array<{
    adicionalId: string;
    cantidad: number;
    precioUnitario: string;
    modalidad: "por_hora" | "por_reserva";
  }>,
) {
  await db
    .delete(reservaAdicionales)
    .where(eq(reservaAdicionales.reservaId, reservaId));
  if (lines.length === 0) return;
  await db.insert(reservaAdicionales).values(
    lines.map((l) => ({
      tenantId,
      reservaId,
      adicionalId: l.adicionalId,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      modalidad: l.modalidad,
    })),
  );
}

export async function listAdicionalGrupos(db: Database, tenantId: string) {
  return db.query.adicionalGrupos.findMany({
    where: (g, { eq }) => eq(g.tenantId, tenantId),
    orderBy: (g, { asc }) => [asc(g.sortOrder)],
  });
}

export async function ensureAdicionalGrupo(
  db: Database,
  tenantId: string,
  sedeId: string,
  name: string,
) {
  const existing = await db.query.adicionalGrupos.findFirst({
    where: (g, { and, eq }) =>
      and(eq(g.tenantId, tenantId), eq(g.sedeId, sedeId), eq(g.name, name)),
  });
  if (existing) return existing;
  const [row] = await db
    .insert(adicionalGrupos)
    .values({ tenantId, sedeId, name })
    .returning();
  return row!;
}

export async function insertAdicional(
  db: Database,
  tenantId: string,
  input: {
    grupoId: string;
    name: string;
    precioBase: string;
    modalidad: "por_hora" | "por_reserva";
    stock?: number | null;
    active?: boolean;
    caracteristicas?: string[];
    photoUrl?: string | null;
  },
) {
  const [row] = await db
    .insert(adicionales)
    .values({
      tenantId,
      grupoId: input.grupoId,
      name: input.name,
      precioBase: input.precioBase,
      modalidad: input.modalidad,
      stock: input.stock ?? null,
      active: input.active ?? true,
      caracteristicas: input.caracteristicas ?? [],
      photoUrl: input.photoUrl ?? null,
    })
    .returning();
  return row!;
}

export async function updateAdicionalRow(
  db: Database,
  tenantId: string,
  id: string,
  patch: Partial<{
    name: string;
    precioBase: string;
    modalidad: "por_hora" | "por_reserva";
    stock: number | null;
    active: boolean;
    grupoId: string;
    caracteristicas: string[];
    photoUrl: string | null;
  }>,
) {
  const [row] = await db
    .update(adicionales)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(adicionales.tenantId, tenantId), eq(adicionales.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteAdicionalRow(
  db: Database,
  tenantId: string,
  id: string,
) {
  const [row] = await db
    .delete(adicionales)
    .where(and(eq(adicionales.tenantId, tenantId), eq(adicionales.id, id)))
    .returning({ id: adicionales.id });
  return row ?? null;
}

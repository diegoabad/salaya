import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import {
  directorioEntradas,
  horariosAtencion,
  politicas,
  salas,
  sedes,
  tenants,
} from "../schema";

export async function getNegocioBundle(db: Database, tenantId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  if (!tenant) return null;

  const sede = await db.query.sedes.findFirst({
    where: and(eq(sedes.tenantId, tenantId), eq(sedes.active, true)),
    orderBy: (s, { asc }) => [asc(s.createdAt)],
  });
  if (!sede) return null;

  const [politica, horarios, directorio, salasRows] = await Promise.all([
    db.query.politicas.findFirst({
      where: eq(politicas.sedeId, sede.id),
    }),
    db.query.horariosAtencion.findMany({
      where: and(
        eq(horariosAtencion.tenantId, tenantId),
        eq(horariosAtencion.sedeId, sede.id),
      ),
      orderBy: (h, { asc }) => [asc(h.dayOfWeek)],
    }),
    db.query.directorioEntradas.findFirst({
      where: eq(directorioEntradas.tenantId, tenantId),
    }),
    db
      .select({ id: salas.id })
      .from(salas)
      .where(
        and(
          eq(salas.tenantId, tenantId),
          eq(salas.sedeId, sede.id),
          isNull(salas.deletedAt),
        ),
      ),
  ]);

  return {
    tenant,
    sede,
    politica: politica ?? null,
    horarios,
    directorio: directorio ?? null,
    salasCount: salasRows.length,
  };
}

export function listSalasTenant(db: Database, tenantId: string, sedeId?: string) {
  if (sedeId) {
    return db.query.salas.findMany({
      where: (s, { and, eq, isNull }) =>
        and(
          eq(s.tenantId, tenantId),
          eq(s.sedeId, sedeId),
          isNull(s.deletedAt),
        ),
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.createdAt)],
    });
  }
  return db.query.salas.findMany({
    where: (s, { and, eq, isNull }) =>
      and(eq(s.tenantId, tenantId), isNull(s.deletedAt)),
    orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.createdAt)],
  });
}

export function getSalaById(db: Database, tenantId: string, salaId: string) {
  return db.query.salas.findFirst({
    where: (s, { and, eq, isNull }) =>
      and(eq(s.tenantId, tenantId), eq(s.id, salaId), isNull(s.deletedAt)),
  });
}

export async function isSalaSlugTaken(
  db: Database,
  tenantId: string,
  slug: string,
  excludeId?: string,
) {
  const row = await db.query.salas.findFirst({
    where: (s, { and, eq, isNull, ne }) =>
      and(
        eq(s.tenantId, tenantId),
        eq(s.slug, slug),
        isNull(s.deletedAt),
        excludeId ? ne(s.id, excludeId) : undefined,
      ),
    columns: { id: true },
  });
  return Boolean(row);
}

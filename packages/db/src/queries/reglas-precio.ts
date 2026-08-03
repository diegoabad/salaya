import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { reglasPrecio } from "../schema";
import type { DescuentoTipo, ReglaPrecioScope } from "@repo/shared";

export async function listReglasPrecio(db: Database, tenantId: string) {
  return db.query.reglasPrecio.findMany({
    where: (r, { eq }) => eq(r.tenantId, tenantId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });
}

export async function insertReglaPrecio(
  db: Database,
  tenantId: string,
  input: {
    scope: ReglaPrecioScope;
    scopeId: string;
    tipo: DescuentoTipo;
    nombre?: string | null;
    daysOfWeek: number[];
    startTime?: string | null;
    endTime?: string | null;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    precioPorHora: string;
    descuentoPorcentaje?: string | null;
    active?: boolean;
  },
) {
  const [row] = await db
    .insert(reglasPrecio)
    .values({
      tenantId,
      scope: input.scope,
      scopeId: input.scopeId,
      tipo: input.tipo,
      nombre: input.nombre ?? null,
      daysOfWeek: input.daysOfWeek,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      fechaDesde: input.fechaDesde ?? null,
      fechaHasta: input.fechaHasta ?? null,
      precioPorHora: input.precioPorHora,
      descuentoPorcentaje: input.descuentoPorcentaje ?? null,
      active: input.active ?? true,
    })
    .returning();
  return row!;
}

export async function updateReglaPrecioRow(
  db: Database,
  tenantId: string,
  id: string,
  patch: Partial<{
    nombre: string | null;
    tipo: DescuentoTipo;
    daysOfWeek: number[];
    startTime: string | null;
    endTime: string | null;
    fechaDesde: string | null;
    fechaHasta: string | null;
    precioPorHora: string;
    descuentoPorcentaje: string | null;
    active: boolean;
  }>,
) {
  const [row] = await db
    .update(reglasPrecio)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(reglasPrecio.tenantId, tenantId), eq(reglasPrecio.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteReglaPrecioRow(
  db: Database,
  tenantId: string,
  id: string,
) {
  const [row] = await db
    .delete(reglasPrecio)
    .where(and(eq(reglasPrecio.tenantId, tenantId), eq(reglasPrecio.id, id)))
    .returning({ id: reglasPrecio.id });
  return row ?? null;
}

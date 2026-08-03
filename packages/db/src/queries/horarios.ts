import { and, eq, gte, lte } from "drizzle-orm";
import type { Database } from "../client";
import { horariosAtencion, horariosEspeciales } from "../schema";

/** Lun–dom 10:00–23:00 (hora AR local) */
export async function seedHorariosDefaultSede(
  db: Pick<Database, "insert">,
  tenantId: string,
  sedeId: string,
) {
  await db.insert(horariosAtencion).values(
    [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
      tenantId,
      sedeId,
      dayOfWeek,
      startTime: "10:00",
      endTime: "23:00",
    })),
  );
}

export async function listHorariosAtencionSede(
  db: Database,
  tenantId: string,
  sedeId: string,
) {
  return db
    .select({
      dayOfWeek: horariosAtencion.dayOfWeek,
      startTime: horariosAtencion.startTime,
      endTime: horariosAtencion.endTime,
    })
    .from(horariosAtencion)
    .where(
      and(
        eq(horariosAtencion.tenantId, tenantId),
        eq(horariosAtencion.sedeId, sedeId),
      ),
    );
}

export async function listHorariosEspecialesSede(
  db: Database,
  tenantId: string,
  sedeId: string,
  fechaDesde?: string,
  fechaHasta?: string,
) {
  const conds = [
    eq(horariosEspeciales.tenantId, tenantId),
    eq(horariosEspeciales.sedeId, sedeId),
  ];
  if (fechaDesde) conds.push(gte(horariosEspeciales.fecha, fechaDesde));
  if (fechaHasta) conds.push(lte(horariosEspeciales.fecha, fechaHasta));
  return db
    .select({
      fecha: horariosEspeciales.fecha,
      closed: horariosEspeciales.closed,
      startTime: horariosEspeciales.startTime,
      endTime: horariosEspeciales.endTime,
    })
    .from(horariosEspeciales)
    .where(and(...conds));
}

/** Reemplaza la semana completa de atención (días cerrados = sin fila) */
export async function replaceHorariosAtencionSede(
  db: Database,
  tenantId: string,
  sedeId: string,
  rows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
) {
  await db
    .delete(horariosAtencion)
    .where(
      and(
        eq(horariosAtencion.tenantId, tenantId),
        eq(horariosAtencion.sedeId, sedeId),
      ),
    );
  if (rows.length === 0) return;
  await db.insert(horariosAtencion).values(
    rows.map((r) => ({
      tenantId,
      sedeId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
  );
}

export async function upsertHorarioEspecialSede(
  db: Database,
  tenantId: string,
  sedeId: string,
  input: {
    fecha: string;
    closed: boolean;
    startTime?: string | null;
    endTime?: string | null;
    nota?: string | null;
  },
) {
  const existing = await db.query.horariosEspeciales.findFirst({
    where: (h, { and, eq }) =>
      and(eq(h.tenantId, tenantId), eq(h.sedeId, sedeId), eq(h.fecha, input.fecha)),
  });
  if (existing) {
    const [row] = await db
      .update(horariosEspeciales)
      .set({
        closed: input.closed,
        startTime: input.closed ? null : (input.startTime ?? null),
        endTime: input.closed ? null : (input.endTime ?? null),
        nota: input.nota ?? null,
        updatedAt: new Date(),
      })
      .where(eq(horariosEspeciales.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(horariosEspeciales)
    .values({
      tenantId,
      sedeId,
      fecha: input.fecha,
      closed: input.closed,
      startTime: input.closed ? null : (input.startTime ?? null),
      endTime: input.closed ? null : (input.endTime ?? null),
      nota: input.nota ?? null,
    })
    .returning();
  return row!;
}

export async function deleteHorarioEspecialSede(
  db: Database,
  tenantId: string,
  sedeId: string,
  fecha: string,
) {
  const deleted = await db
    .delete(horariosEspeciales)
    .where(
      and(
        eq(horariosEspeciales.tenantId, tenantId),
        eq(horariosEspeciales.sedeId, sedeId),
        eq(horariosEspeciales.fecha, fecha),
      ),
    )
    .returning({ id: horariosEspeciales.id });
  return deleted.length > 0;
}

import { directorioEntradas, getDb, salas } from "@repo/db";
import {
  getNegocioBundle,
  getSalaById,
  isSalaSlugTaken,
  listSalasTenant,
} from "@repo/db/queries";
import type { CreateSalaInput, UpdateSalaInput } from "@repo/shared";
import { slugify } from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import { HttpError } from "../middlewares/errorHandler";

function serializeSala(s: typeof salas.$inferSelect) {
  return {
    id: s.id,
    sedeId: s.sedeId,
    name: s.name,
    slug: s.slug,
    description: s.description,
    categoria: s.categoria,
    tags: s.tags,
    capacity: s.capacity,
    anchoMetros: s.anchoMetros,
    largoMetros: s.largoMetros,
    precioHora: s.precioHora,
    acustica: s.acustica,
    equipamiento: s.equipamiento,
    noIncluido: s.noIncluido,
    caracteristicas: s.caracteristicas,
    photos: s.photos,
    popular: s.popular,
    nueva: s.nueva,
    active: s.active,
    sortOrder: s.sortOrder,
    ratingAvg: s.ratingAvg,
    ratingCount: s.ratingCount,
    duracionMinMinutos: s.duracionMinMinutos,
    duracionMaxMinutos: s.duracionMaxMinutos,
    granularidadMinutos: s.granularidadMinutos,
    createdAt: s.createdAt,
  };
}

function mapSalaRow(input: CreateSalaInput | UpdateSalaInput) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined
      ? { description: input.description || null }
      : {}),
    ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
    ...(input.anchoMetros !== undefined
      ? {
          anchoMetros:
            input.anchoMetros != null ? String(input.anchoMetros) : null,
        }
      : {}),
    ...(input.largoMetros !== undefined
      ? {
          largoMetros:
            input.largoMetros != null ? String(input.largoMetros) : null,
        }
      : {}),
    ...(input.precioHora !== undefined ? { precioHora: input.precioHora } : {}),
    ...(input.acustica !== undefined
      ? { acustica: input.acustica || null }
      : {}),
    ...(input.equipamiento !== undefined
      ? { equipamiento: input.equipamiento }
      : {}),
    ...(input.noIncluido !== undefined ? { noIncluido: input.noIncluido } : {}),
    ...(input.caracteristicas !== undefined
      ? { caracteristicas: input.caracteristicas }
      : {}),
    ...(input.photos !== undefined ? { photos: input.photos } : {}),
    ...(input.popular !== undefined ? { popular: input.popular } : {}),
    ...(input.nueva !== undefined ? { nueva: input.nueva } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.duracionMinMinutos !== undefined
      ? { duracionMinMinutos: input.duracionMinMinutos }
      : {}),
    ...(input.duracionMaxMinutos !== undefined
      ? { duracionMaxMinutos: input.duracionMaxMinutos }
      : {}),
    ...(input.granularidadMinutos !== undefined
      ? { granularidadMinutos: input.granularidadMinutos }
      : {}),
  };
}

async function syncDirectorioSalasCount(tenantId: string, sedeId: string) {
  const db = getDb();
  const count = (await listSalasTenant(db, tenantId, sedeId)).length;
  await db
    .update(directorioEntradas)
    .set({ cantidadSalas: count, updatedAt: new Date() })
    .where(eq(directorioEntradas.tenantId, tenantId));
}

export async function listSalas(tenantId: string) {
  const bundle = await getNegocioBundle(getDb(), tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }
  const rows = await listSalasTenant(getDb(), tenantId, bundle.sede.id);
  return {
    sedeId: bundle.sede.id,
    salas: rows.map(serializeSala),
  };
}

export async function createSala(tenantId: string, input: CreateSalaInput) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }

  const slug = slugify(input.slug ?? input.name);
  if (!slug) {
    throw new HttpError(400, "SLUG_INVALID", "Nombre inválido para la URL");
  }
  if (await isSalaSlugTaken(db, tenantId, slug)) {
    throw new HttpError(
      409,
      "SLUG_TAKEN",
      "Ya hay una sala con ese nombre/slug. Probá otro.",
    );
  }

  const [row] = await db
    .insert(salas)
    .values({
      tenantId,
      sedeId: bundle.sede.id,
      slug,
      ...mapSalaRow(input),
      name: input.name,
      categoria: input.categoria,
      tags: input.tags,
      equipamiento: input.equipamiento,
      noIncluido: input.noIncluido,
      caracteristicas: input.caracteristicas,
      photos: input.photos,
      precioHora: input.precioHora ?? null,
      popular: input.popular,
      nueva: input.nueva,
      active: input.active,
      sortOrder: input.sortOrder,
    })
    .returning();

  await syncDirectorioSalasCount(tenantId, bundle.sede.id);
  return serializeSala(row!);
}

export async function updateSala(
  tenantId: string,
  salaId: string,
  input: UpdateSalaInput,
) {
  const db = getDb();
  const existing = await getSalaById(db, tenantId, salaId);
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");
  }

  let slug = existing.slug;
  if (input.slug || input.name) {
    slug = slugify(input.slug ?? input.name ?? existing.name);
    if (!slug) {
      throw new HttpError(400, "SLUG_INVALID", "Nombre inválido para la URL");
    }
    if (await isSalaSlugTaken(db, tenantId, slug, salaId)) {
      throw new HttpError(409, "SLUG_TAKEN", "Ya hay una sala con ese slug");
    }
  }

  const [row] = await db
    .update(salas)
    .set({
      ...mapSalaRow(input),
      slug,
      updatedAt: new Date(),
    })
    .where(and(eq(salas.id, salaId), eq(salas.tenantId, tenantId)))
    .returning();

  return serializeSala(row!);
}

export async function toggleSala(
  tenantId: string,
  salaId: string,
  active: boolean,
) {
  return updateSala(tenantId, salaId, { active });
}

export async function softDeleteSala(tenantId: string, salaId: string) {
  const db = getDb();
  const existing = await getSalaById(db, tenantId, salaId);
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");
  }

  await db
    .update(salas)
    .set({
      deletedAt: new Date(),
      active: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(salas.id, salaId),
        eq(salas.tenantId, tenantId),
        isNull(salas.deletedAt),
      ),
    );

  await syncDirectorioSalasCount(tenantId, existing.sedeId);
  return { ok: true as const };
}

import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { directorioEntradas, userFavoritos } from "../schema";

export async function listFavoritoIds(db: Database, userId: string) {
  const rows = await db
    .select({ id: userFavoritos.directorioEntradaId })
    .from(userFavoritos)
    .where(eq(userFavoritos.userId, userId));
  return rows.map((r) => r.id);
}

export async function listFavoritosDetalle(db: Database, userId: string) {
  return db
    .select({
      id: directorioEntradas.id,
      name: directorioEntradas.name,
      slug: directorioEntradas.slug,
      zona: directorioEntradas.zona,
      address: directorioEntradas.address,
      plan: directorioEntradas.plan,
      photoUrl: directorioEntradas.photoUrl,
      createdAt: userFavoritos.createdAt,
    })
    .from(userFavoritos)
    .innerJoin(
      directorioEntradas,
      eq(directorioEntradas.id, userFavoritos.directorioEntradaId),
    )
    .where(eq(userFavoritos.userId, userId))
    .orderBy(desc(userFavoritos.createdAt));
}

export async function addFavorito(
  db: Database,
  userId: string,
  directorioEntradaId: string,
) {
  await db
    .insert(userFavoritos)
    .values({ userId, directorioEntradaId })
    .onConflictDoNothing();
}

export async function removeFavorito(
  db: Database,
  userId: string,
  directorioEntradaId: string,
) {
  await db
    .delete(userFavoritos)
    .where(
      and(
        eq(userFavoritos.userId, userId),
        eq(userFavoritos.directorioEntradaId, directorioEntradaId),
      ),
    );
}

/** Merge localStorage → DB (ids que existen en directorio) */
export async function syncFavoritos(
  db: Database,
  userId: string,
  entradaIds: string[],
) {
  const unique = [...new Set(entradaIds.filter(Boolean))];
  if (unique.length === 0) return listFavoritoIds(db, userId);

  const existing = await db
    .select({ id: directorioEntradas.id })
    .from(directorioEntradas)
    .where(inArray(directorioEntradas.id, unique));
  const valid = existing.map((e) => e.id);
  if (valid.length === 0) return listFavoritoIds(db, userId);

  await db
    .insert(userFavoritos)
    .values(valid.map((directorioEntradaId) => ({ userId, directorioEntradaId })))
    .onConflictDoNothing();

  return listFavoritoIds(db, userId);
}

export async function listFavoritosPublicosByUserId(
  db: Database,
  userId: string,
) {
  return listFavoritosDetalle(db, userId);
}

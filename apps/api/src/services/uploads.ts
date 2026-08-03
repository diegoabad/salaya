import { and, eq } from "drizzle-orm";
import { adicionales, directorioEntradas, getDb, salas, sedes } from "@repo/db";
import {
  getNegocioBundle,
  getSalaById,
} from "@repo/db/queries";
import { HttpError } from "../middlewares/errorHandler";
import {
  assertImageFile,
  saveOptimizedImage,
  tryDeleteMediaFile,
} from "./uploads-fs";

const MAX_SALA_PHOTOS = 12;
const MAX_SEDE_PHOTOS = 12;

function sedePhotosList(sede: {
  photoUrl: string | null;
  photos?: string[] | null;
}): string[] {
  const list = [...(sede.photos ?? [])];
  if (sede.photoUrl && !list.includes(sede.photoUrl)) {
    list.unshift(sede.photoUrl);
  }
  return list;
}

export async function uploadSedePhotos(
  tenantId: string,
  files: Express.Multer.File[],
) {
  if (!files.length) {
    throw new HttpError(400, "SIN_ARCHIVOS", "Subí al menos una imagen");
  }

  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");

  const current = sedePhotosList(bundle.sede);
  if (current.length + files.length > MAX_SEDE_PHOTOS) {
    throw new HttpError(
      400,
      "LIMITE_FOTOS",
      `Máximo ${MAX_SEDE_PHOTOS} fotos del estudio`,
    );
  }

  const added: string[] = [];
  for (const file of files) {
    try {
      assertImageFile(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "FORMATO_INVALIDO") {
        throw new HttpError(400, "FORMATO_INVALIDO", "Usá JPG, PNG, WebP o GIF");
      }
      if (msg === "ARCHIVO_GRANDE") {
        throw new HttpError(400, "ARCHIVO_GRANDE", "Máximo 8 MB por imagen");
      }
      throw err;
    }
    const saved = await saveOptimizedImage({
      buffer: file.buffer,
      relativeDir: `${tenantId}/sede`,
    });
    added.push(saved.url);
  }

  const photos = [...current, ...added];
  const cover = photos[0] ?? null;
  await db
    .update(sedes)
    .set({ photos, photoUrl: cover, updatedAt: new Date() })
    .where(and(eq(sedes.id, bundle.sede.id), eq(sedes.tenantId, tenantId)));

  if (cover) {
    await db
      .update(directorioEntradas)
      .set({ photoUrl: cover, updatedAt: new Date() })
      .where(eq(directorioEntradas.tenantId, tenantId));
  }

  return { photos, photoUrl: cover, added };
}

/** @deprecated prefer uploadSedePhotos — mantiene compat con 1 archivo */
export async function uploadSedePhoto(
  tenantId: string,
  file: Express.Multer.File,
) {
  const data = await uploadSedePhotos(tenantId, [file]);
  return {
    photoUrl: data.photoUrl ?? data.photos[0]!,
    photos: data.photos,
    thumbUrl: undefined as string | undefined,
  };
}

export async function removeSedePhoto(tenantId: string, photoUrl: string) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");

  const photos = sedePhotosList(bundle.sede).filter((p) => p !== photoUrl);
  if (photos.length === sedePhotosList(bundle.sede).length) {
    throw new HttpError(404, "NOT_FOUND", "Foto no encontrada");
  }

  const cover = photos[0] ?? null;
  await db
    .update(sedes)
    .set({ photos, photoUrl: cover, updatedAt: new Date() })
    .where(and(eq(sedes.id, bundle.sede.id), eq(sedes.tenantId, tenantId)));

  await db
    .update(directorioEntradas)
    .set({ photoUrl: cover, updatedAt: new Date() })
    .where(eq(directorioEntradas.tenantId, tenantId));

  await tryDeleteMediaFile(photoUrl);
  return { photos, photoUrl: cover };
}

export async function uploadSalaPhotos(
  tenantId: string,
  salaId: string,
  files: Express.Multer.File[],
) {
  if (!files.length) {
    throw new HttpError(400, "SIN_ARCHIVOS", "Subí al menos una imagen");
  }

  const db = getDb();
  const sala = await getSalaById(db, tenantId, salaId);
  if (!sala) throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");

  const current = [...(sala.photos ?? [])];
  if (current.length + files.length > MAX_SALA_PHOTOS) {
    throw new HttpError(
      400,
      "LIMITE_FOTOS",
      `Máximo ${MAX_SALA_PHOTOS} fotos por sala`,
    );
  }

  const added: string[] = [];
  for (const file of files) {
    try {
      assertImageFile(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "FORMATO_INVALIDO") {
        throw new HttpError(400, "FORMATO_INVALIDO", "Usá JPG, PNG, WebP o GIF");
      }
      if (msg === "ARCHIVO_GRANDE") {
        throw new HttpError(400, "ARCHIVO_GRANDE", "Máximo 8 MB por imagen");
      }
      throw err;
    }
    const saved = await saveOptimizedImage({
      buffer: file.buffer,
      relativeDir: `${tenantId}/salas/${salaId}`,
    });
    added.push(saved.url);
  }

  const photos = [...current, ...added];
  await db
    .update(salas)
    .set({ photos, updatedAt: new Date() })
    .where(and(eq(salas.id, salaId), eq(salas.tenantId, tenantId)));

  // Si el estudio no tiene foto, usar la primera de la sala
  const bundle = await getNegocioBundle(db, tenantId);
  if (bundle && !bundle.sede.photoUrl && added[0]) {
    await db
      .update(sedes)
      .set({ photoUrl: added[0], updatedAt: new Date() })
      .where(and(eq(sedes.id, bundle.sede.id), eq(sedes.tenantId, tenantId)));
    await db
      .update(directorioEntradas)
      .set({ photoUrl: added[0], updatedAt: new Date() })
      .where(eq(directorioEntradas.tenantId, tenantId));
  }

  return { photos, added };
}

export async function removeSalaPhoto(
  tenantId: string,
  salaId: string,
  photoUrl: string,
) {
  const db = getDb();
  const sala = await getSalaById(db, tenantId, salaId);
  if (!sala) throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");

  const photos = (sala.photos ?? []).filter((p) => p !== photoUrl);
  if (photos.length === (sala.photos ?? []).length) {
    throw new HttpError(404, "NOT_FOUND", "Foto no encontrada");
  }

  await db
    .update(salas)
    .set({ photos, updatedAt: new Date() })
    .where(and(eq(salas.id, salaId), eq(salas.tenantId, tenantId)));

  await tryDeleteMediaFile(photoUrl);
  return { photos };
}

export async function uploadAdicionalPhoto(
  tenantId: string,
  adicionalId: string,
  file: Express.Multer.File,
) {
  try {
    assertImageFile(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FORMATO_INVALIDO") {
      throw new HttpError(400, "FORMATO_INVALIDO", "Usá JPG, PNG, WebP o GIF");
    }
    if (msg === "ARCHIVO_GRANDE") {
      throw new HttpError(400, "ARCHIVO_GRANDE", "Máximo 8 MB por imagen");
    }
    throw err;
  }

  const db = getDb();
  const existing = await db.query.adicionales.findFirst({
    where: (a, { and, eq }) =>
      and(eq(a.tenantId, tenantId), eq(a.id, adicionalId)),
  });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Adicional no encontrado");
  }

  const saved = await saveOptimizedImage({
    buffer: file.buffer,
    relativeDir: `${tenantId}/adicionales/${adicionalId}`,
  });

  const prev = existing.photoUrl;
  await db
    .update(adicionales)
    .set({ photoUrl: saved.url, updatedAt: new Date() })
    .where(
      and(eq(adicionales.tenantId, tenantId), eq(adicionales.id, adicionalId)),
    );

  if (prev && prev !== saved.url) {
    await tryDeleteMediaFile(prev);
  }

  return { photoUrl: saved.url };
}

export async function removeAdicionalPhoto(
  tenantId: string,
  adicionalId: string,
) {
  const db = getDb();
  const existing = await db.query.adicionales.findFirst({
    where: (a, { and, eq }) =>
      and(eq(a.tenantId, tenantId), eq(a.id, adicionalId)),
  });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Adicional no encontrado");
  }
  if (!existing.photoUrl) {
    return { photoUrl: null as string | null };
  }

  await db
    .update(adicionales)
    .set({ photoUrl: null, updatedAt: new Date() })
    .where(
      and(eq(adicionales.tenantId, tenantId), eq(adicionales.id, adicionalId)),
    );
  await tryDeleteMediaFile(existing.photoUrl);
  return { photoUrl: null as string | null };
}

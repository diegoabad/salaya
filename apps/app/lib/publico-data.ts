import { getAppDb } from "@/lib/db";
import type { DirectorioSala } from "@/lib/directorio-data";
import type {
  EstudioDetalle,
  EstudioResena,
  EstudioSala,
  SalaDetalle,
} from "@/lib/estudio-detalle-data";
import { directorioEntradas } from "@repo/db";
import {
  getEstudioPublicoBySlug,
  getSalaPublica,
  listDirectorioPublico,
  type PublicEstudio,
} from "@repo/db/queries";
import { inArray } from "drizzle-orm";

function mapEstudio(e: PublicEstudio): EstudioDetalle {
  return {
    id: e.id,
    name: e.name,
    slug: e.slug,
    zona: e.zona,
    address: e.address,
    description: e.description,
    plan: e.plan,
    telefono: e.telefono,
    websiteUrl: e.websiteUrl,
    instagramUrl: e.instagramUrl,
    whatsapp: e.whatsapp,
    youtubeUrl: e.youtubeUrl,
    tiktokUrl: e.tiktokUrl,
    linksExtra: e.linksExtra ?? [],
    precioDesde: e.precioDesde,
    cantidadSalas: e.cantidadSalas,
    ratingAvg: e.ratingAvg,
    ratingCount: e.ratingCount,
    tagsDestacados: e.tagsDestacados,
    equipamiento: e.equipamiento,
    photo: e.photo?.trim() ? e.photo : "",
    photos: (e.photos ?? []).filter((p) => Boolean(p?.trim())),
    lat: e.lat,
    lng: e.lng,
    googlePlaceId: e.googlePlaceId ?? null,
    libresHoy: e.libresHoy,
    amenidades: e.amenidades,
    horarios: e.horarios ?? [],
    promociones: e.promociones ?? [],
    salas: e.salas.map(
      (s): EstudioSala => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description,
        categoria: (["Música", "Danza", "Teatro", "Multiuso"].includes(
          s.categoria,
        )
          ? s.categoria
          : "Música") as EstudioSala["categoria"],
        tags: s.tags,
        capacity: s.capacity,
        anchoMetros: s.anchoMetros,
        largoMetros: s.largoMetros,
        precioHora: s.precioHora,
        acustica: s.acustica,
        horarioInicio: s.horarioInicio,
        horarioFin: s.horarioFin,
        equipamiento: s.equipamiento,
        noIncluido: s.noIncluido,
        caracteristicas: s.caracteristicas,
        photos: s.photos.filter((p) => Boolean(p?.trim())),
        popular: s.popular,
        nueva: s.nueva,
        ratingAvg: s.ratingAvg,
        ratingCount: s.ratingCount,
        disponibleHoy: s.disponibleHoy,
      }),
    ),
    resenas: e.resenas.map(
      (r): EstudioResena => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        body: r.body,
        publishedAt: r.publishedAt,
      }),
    ),
  };
}

/** Preferencia: DB real. Sin ficha → null (sin demos engañosos). */
export async function loadEstudioBySlug(
  slug: string,
): Promise<EstudioDetalle | null> {
  try {
    const fromDb = await getEstudioPublicoBySlug(getAppDb(), slug);
    if (fromDb && (fromDb.salas.length > 0 || fromDb.tenantId)) {
      return mapEstudio(fromDb);
    }
  } catch (err) {
    console.error("loadEstudioBySlug db error", err);
  }
  return null;
}

export async function loadSalaDetalle(
  estudioSlug: string,
  salaSlug: string,
): Promise<SalaDetalle | null> {
  try {
    const fromDb = await getSalaPublica(getAppDb(), estudioSlug, salaSlug);
    if (fromDb) {
      const estudio = mapEstudio(fromDb.estudio);
      const sala = estudio.salas.find((s) => s.slug === salaSlug);
      if (sala) return { estudio, sala };
    }
  } catch (err) {
    console.error("loadSalaDetalle db error", err);
  }
  return null;
}

export async function loadDirectorio(): Promise<DirectorioSala[]> {
  try {
    const db = getAppDb();
    const rows = await listDirectorioPublico(db);

    // Asegura horarios jsonb (el client a veces no recibe el campo del package cacheado)
    const ids = rows.map((r) => r.id);
    const horariosById = new Map<
      string,
      Array<{ dayOfWeek: number; startTime: string; endTime: string }>
    >();
    if (ids.length > 0) {
      const extras = await db
        .select({
          id: directorioEntradas.id,
          horarios: directorioEntradas.horarios,
        })
        .from(directorioEntradas)
        .where(inArray(directorioEntradas.id, ids));
      for (const e of extras) {
        horariosById.set(e.id, e.horarios ?? []);
      }
    }

    return rows.map((r) => {
      const raw = horariosById.get(r.id) ?? r.horarios ?? [];
      const horarios = raw
        .filter(
          (h) =>
            h &&
            typeof h.dayOfWeek === "number" &&
            typeof h.startTime === "string" &&
            typeof h.endTime === "string",
        )
        .map((h) => ({
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
        }));
      return { ...r, horarios };
    });
  } catch (err) {
    console.error("loadDirectorio db error", err);
    return [];
  }
}

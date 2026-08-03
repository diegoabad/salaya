import { and, eq, ilike, isNull, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  directorioEntradas,
  horariosAtencion,
  reglasPrecio,
  resenas,
  salas,
  sedes,
  tenants,
} from "../schema";
import { countLibresHoyTenant } from "./libres-hoy";

export type PublicSala = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoria: string;
  tags: string[];
  capacity: number;
  anchoMetros: number;
  largoMetros: number;
  precioHora: number;
  acustica: string;
  horarioInicio: string;
  horarioFin: string;
  equipamiento: string[];
  noIncluido: string[];
  caracteristicas: string[];
  photos: string[];
  popular: boolean;
  nueva: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  disponibleHoy: boolean;
  active: boolean;
};

export type PublicResena = {
  id: string;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  publishedAt: string;
};

export type PublicHorario = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type PublicPromo = {
  id: string;
  nombre: string;
  tipo: "continuo" | "puntual";
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  descuentoPorcentaje: number | null;
  precioPorHora: number;
};

export type PublicLinkExtra = { label: string; url: string };

export type PublicEstudio = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  zona: string;
  address: string;
  description: string;
  plan: "cliente" | "destacado" | "seed";
  telefono?: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  whatsapp?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  linksExtra?: PublicLinkExtra[];
  precioDesde: number;
  cantidadSalas: number;
  ratingAvg: number | null;
  ratingCount: number;
  tagsDestacados: string[];
  equipamiento: string[];
  photo: string;
  /** Galería del estudio (sede); si vacío, la UI usa foto + salas */
  photos: string[];
  lat: number | null;
  lng: number | null;
  googlePlaceId?: string | null;
  libresHoy: number | null;
  amenidades: string[];
  horarios: PublicHorario[];
  promociones: PublicPromo[];
  salas: PublicSala[];
  resenas: PublicResena[];
};

function num(v: string | null | undefined, fallback = 0) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rating(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function listDirectorioPublico(db: Database) {
  const rows = await db.query.directorioEntradas.findMany({
    where: (d, { eq }) => eq(d.optOut, false),
    orderBy: (d, { desc }) => [desc(d.updatedAt)],
  });

  return Promise.all(
    rows.map(async (r) => {
      let libresHoy: number | null = null;
      if (r.plan !== "seed" && r.tenantId) {
        try {
          libresHoy = await countLibresHoyTenant(db, r.tenantId);
        } catch {
          libresHoy = 0;
        }
      }
      const description = r.description ?? "";
      const website =
        description.match(/(?:^|\n)Web:\s*(\S+)/i)?.[1]?.trim() || undefined;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug ?? r.id,
        zona: r.zona ?? "",
        address: r.address ?? "",
        description,
        plan: r.plan as "cliente" | "destacado" | "seed",
        telefono: r.telefono ?? undefined,
        website,
        precioDesde: num(r.precioDesde),
        cantidadSalas: r.cantidadSalas,
        ratingAvg: rating(r.ratingAvg),
        ratingCount: r.ratingCount,
        tagsDestacados: r.tagsDestacados,
        equipamiento: r.equipamiento,
        photo: r.photoUrl ?? "",
        lat: numOrNull(r.lat),
        lng: numOrNull(r.lng),
        googlePlaceId: r.googlePlaceId ?? null,
        libresHoy,
        horarios: (r.horarios ?? []) as PublicHorario[],
      };
    }),
  );
}

export async function getEstudioPublicoBySlug(
  db: Database,
  slug: string,
): Promise<PublicEstudio | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
  if (!tenant) {
    // fallback: directorio seed without tenant
    const dir = await db.query.directorioEntradas.findFirst({
      where: eq(directorioEntradas.slug, slug),
    });
    if (!dir || dir.tenantId) return null;
    return {
      id: dir.id,
      tenantId: "",
      name: dir.name,
      slug: dir.slug ?? slug,
      zona: dir.zona ?? "",
      address: dir.address ?? "",
      description: dir.description ?? "",
      plan: dir.plan as "cliente" | "destacado" | "seed",
      telefono: dir.telefono ?? undefined,
      precioDesde: num(dir.precioDesde),
      cantidadSalas: dir.cantidadSalas,
      ratingAvg: rating(dir.ratingAvg),
      ratingCount: dir.ratingCount,
      tagsDestacados: dir.tagsDestacados,
      equipamiento: dir.equipamiento,
      photo: dir.photoUrl ?? "",
      photos: dir.photoUrl ? [dir.photoUrl] : [],
      lat: numOrNull(dir.lat),
      lng: numOrNull(dir.lng),
      googlePlaceId: dir.googlePlaceId ?? null,
      libresHoy: null,
      amenidades: dir.tagsDestacados,
      horarios: (dir.horarios ?? []) as PublicHorario[],
      promociones: [],
      salas: [],
      resenas: [],
    };
  }

  const sede = await db.query.sedes.findFirst({
    where: and(eq(sedes.tenantId, tenant.id), eq(sedes.active, true)),
    orderBy: (s, { asc: a }) => [a(s.createdAt)],
  });
  if (!sede) return null;

  const [dir, salasRows, resenasRows, horarios, reglas] = await Promise.all([
    db.query.directorioEntradas.findFirst({
      where: eq(directorioEntradas.tenantId, tenant.id),
    }),
    db.query.salas.findMany({
      where: and(
        eq(salas.tenantId, tenant.id),
        eq(salas.sedeId, sede.id),
        eq(salas.active, true),
        isNull(salas.deletedAt),
      ),
      orderBy: (s, { asc: a }) => [a(s.sortOrder), a(s.createdAt)],
    }),
    db.query.resenas.findMany({
      where: and(
        eq(resenas.tenantId, tenant.id),
        eq(resenas.published, true),
      ),
      orderBy: (r, { desc }) => [desc(r.publishedAt)],
      limit: 20,
    }),
    db.query.horariosAtencion.findMany({
      where: and(
        eq(horariosAtencion.tenantId, tenant.id),
        eq(horariosAtencion.sedeId, sede.id),
      ),
      orderBy: (h, { asc: a }) => [a(h.dayOfWeek)],
    }),
    db.query.reglasPrecio.findMany({
      where: and(
        eq(reglasPrecio.tenantId, tenant.id),
        eq(reglasPrecio.active, true),
      ),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      limit: 12,
    }),
  ]);

  const horarioInicio = horarios[0]?.startTime ?? "10:00";
  const horarioFin = horarios[0]?.endTime ?? "23:00";

  const publicSalas: PublicSala[] = salasRows.map((s) => ({
    id: s.id,
    slug: s.slug ?? s.id,
    name: s.name,
    description: s.description ?? "",
    categoria: s.categoria,
    tags: s.tags,
    capacity: s.capacity ?? 0,
    anchoMetros: num(s.anchoMetros),
    largoMetros: num(s.largoMetros),
    precioHora: num(s.precioHora),
    acustica: s.acustica ?? "",
    horarioInicio,
    horarioFin,
    equipamiento: s.equipamiento,
    noIncluido: s.noIncluido,
    caracteristicas: s.caracteristicas,
    photos: s.photos,
    popular: s.popular,
    nueva: s.nueva,
    ratingAvg: rating(s.ratingAvg),
    ratingCount: s.ratingCount,
    disponibleHoy: s.active,
    active: s.active,
  }));

  const precios = publicSalas
    .map((s) => s.precioHora)
    .filter((p) => p > 0);
  const precioDesde =
    precios.length > 0
      ? Math.min(...precios)
      : num(dir?.precioDesde);

  let libresHoy = 0;
  try {
    libresHoy = await countLibresHoyTenant(db, tenant.id);
  } catch {
    libresHoy = 0;
  }

  return {
    id: tenant.id,
    tenantId: tenant.id,
    name: dir?.name ?? tenant.name,
    slug: tenant.slug,
    zona: sede.zona ?? dir?.zona ?? "",
    address: sede.address ?? dir?.address ?? "",
    description: sede.description ?? dir?.description ?? "",
    plan: (dir?.plan as "cliente" | "destacado" | "seed") ?? "cliente",
    telefono: dir?.telefono ?? undefined,
    websiteUrl: tenant.websiteUrl,
    instagramUrl: tenant.instagramUrl,
    whatsapp: tenant.whatsapp,
    youtubeUrl: tenant.youtubeUrl,
    tiktokUrl: tenant.tiktokUrl,
    linksExtra: tenant.linksExtra ?? [],
    precioDesde,
    cantidadSalas: publicSalas.length,
    ratingAvg: rating(dir?.ratingAvg),
    ratingCount: dir?.ratingCount ?? 0,
    tagsDestacados: dir?.tagsDestacados ?? [],
    equipamiento: dir?.equipamiento ?? [],
    photo: sede.photoUrl ?? dir?.photoUrl ?? publicSalas[0]?.photos[0] ?? "",
    photos: (() => {
      const list = [...(sede.photos ?? [])];
      const cover =
        sede.photoUrl ?? dir?.photoUrl ?? publicSalas[0]?.photos[0] ?? "";
      if (cover && !list.includes(cover)) list.unshift(cover);
      return list;
    })(),
    lat: numOrNull(sede.lat ?? dir?.lat),
    lng: numOrNull(sede.lng ?? dir?.lng),
    googlePlaceId: dir?.googlePlaceId ?? null,
    libresHoy,
    amenidades: sede.amenidades,
    horarios: horarios.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime,
      endTime: h.endTime,
    })),
    promociones: reglas
      .filter(
        (r) =>
          r.descuentoPorcentaje != null ||
          Boolean(r.nombre?.trim()) ||
          r.tipo === "puntual",
      )
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        nombre: r.nombre?.trim() || (r.tipo === "puntual" ? "Promo puntual" : "Descuento"),
        tipo: r.tipo as "continuo" | "puntual",
        daysOfWeek: r.daysOfWeek ?? [],
        startTime: r.startTime,
        endTime: r.endTime,
        fechaDesde: r.fechaDesde,
        fechaHasta: r.fechaHasta,
        descuentoPorcentaje: numOrNull(r.descuentoPorcentaje),
        precioPorHora: num(r.precioPorHora),
      })),
    salas: publicSalas.map((s) => ({
      ...s,
      disponibleHoy: s.active && libresHoy > 0,
    })),
    resenas: resenasRows.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating as 1 | 2 | 3 | 4 | 5,
      body: r.body,
      publishedAt: r.publishedAt.toISOString().slice(0, 10),
    })),
  };
}

export async function getSalaPublica(
  db: Database,
  estudioSlug: string,
  salaSlug: string,
) {
  const estudio = await getEstudioPublicoBySlug(db, estudioSlug);
  if (!estudio) return null;
  const sala = estudio.salas.find((s) => s.slug === salaSlug);
  if (!sala) return null;
  return { estudio, sala };
}

export type DirectorioNombreHit = {
  id: string;
  name: string;
  slug: string;
  zona: string;
  address: string;
  telefono?: string;
  photo: string;
  plan: "cliente" | "destacado" | "seed";
  /** Se puede reclamar (seed sin tenant) */
  claimable: boolean;
};

function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Búsqueda por nombre para registro / reclamo (máx. `limit`). */
export async function searchDirectorioPorNombre(
  db: Database,
  query: string,
  limit = 5,
): Promise<DirectorioNombreHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const pattern = `%${escapeIlike(term)}%`;
  const rows = await db
    .select({
      id: directorioEntradas.id,
      name: directorioEntradas.name,
      slug: directorioEntradas.slug,
      zona: directorioEntradas.zona,
      address: directorioEntradas.address,
      telefono: directorioEntradas.telefono,
      photoUrl: directorioEntradas.photoUrl,
      plan: directorioEntradas.plan,
      tenantId: directorioEntradas.tenantId,
    })
    .from(directorioEntradas)
    .where(
      and(
        eq(directorioEntradas.optOut, false),
        ilike(directorioEntradas.name, pattern),
      ),
    )
    .orderBy(
      sql`case when ${directorioEntradas.plan} = 'seed' and ${directorioEntradas.tenantId} is null then 0 else 1 end`,
      sql`length(${directorioEntradas.name})`,
      directorioEntradas.name,
    )
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug ?? r.id,
    zona: r.zona ?? "",
    address: r.address ?? "",
    telefono: r.telefono ?? undefined,
    photo: r.photoUrl ?? "",
    plan: r.plan as DirectorioNombreHit["plan"],
    claimable: r.plan === "seed" && !r.tenantId,
  }));
}

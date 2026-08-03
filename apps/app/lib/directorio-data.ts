export type DirectorioSala = {
  id: string;
  name: string;
  slug: string;
  zona: string;
  address: string;
  description: string;
  /** Cliente del SaaS = reservá online; seed = solo teléfono */
  plan: "cliente" | "destacado" | "seed";
  telefono?: string;
  /** Sitio / redes (Places o dueño) */
  website?: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  whatsapp?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  linksExtra?: Array<{ label: string; url: string }>;
  precioDesde: number;
  cantidadSalas: number;
  ratingAvg: number | null;
  ratingCount: number;
  /** Chips sobre la foto (destacados) */
  tagsDestacados: string[];
  /** Equipamiento para filtros */
  equipamiento: string[];
  photo: string;
  lat: number | null;
  lng: number | null;
  /** Google Place id (seeds) — para abrir la ficha en Maps */
  googlePlaceId?: string | null;
  /** Solo clientes: horarios libres hoy (null = no aplica) */
  libresHoy: number | null;
  /** Semanal (0=dom … 6=sáb). Seeds de Places; clientes suelen venir vacíos en listado. */
  horarios?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
};

/** Demo CABA — se reemplaza por queries a directorio_entradas + tenants */
export const ZONAS = [
  "Palermo",
  "Almagro",
  "Villa Crespo",
  "San Telmo",
  "Caballito",
  "Colegiales",
  "Flores",
] as const;

export const EQUIPAMIENTO_FILTROS = [
  "Batería",
  "Backline",
  "Grabación",
  "PA",
  "Aire acondicionado",
] as const;

export const DEMO_SALAS: DirectorioSala[] = [
  {
    id: "1",
    name: "Sala Norte",
    slug: "sala-norte",
    zona: "Palermo",
    address: "Honduras 5234, CABA",
    description:
      "Tres salas con backline completo y PA. Ideal para bandas que ensayan seguido en Palermo.",
    plan: "destacado",
    precioDesde: 15000,
    cantidadSalas: 3,
    ratingAvg: 4.9,
    ratingCount: 86,
    tagsDestacados: ["Backline", "PA"],
    equipamiento: ["Batería", "Backline", "PA"],
    photo:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
    lat: -34.5875,
    lng: -58.425,
    libresHoy: 3,
  },
  {
    id: "2",
    name: "Estudio Sonar",
    slug: "estudio-sonar",
    zona: "Almagro",
    address: "Av. Corrientes 4521, CABA",
    description:
      "Complejo de 5 salas equipadas para bandas y solistas. Aislamiento acústico profesional y equipos de primera.",
    plan: "cliente",
    precioDesde: 2800,
    cantidadSalas: 5,
    ratingAvg: 4.8,
    ratingCount: 124,
    tagsDestacados: ["Grabación", "Equipos premium", "Estacionamiento"],
    equipamiento: ["Batería", "Aire acondicionado", "Grabación"],
    photo:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
    lat: -34.611,
    lng: -58.42,
    libresHoy: 5,
  },
  {
    id: "3",
    name: "Studio Crespo",
    slug: "studio-crespo",
    zona: "Villa Crespo",
    address: "Thames 891, CABA",
    description:
      "Salas para ensayo y grabación en Villa Crespo. Ambiente prolijo y equipo listo para tocar.",
    plan: "cliente",
    precioDesde: 18000,
    cantidadSalas: 4,
    ratingAvg: 4.6,
    ratingCount: 57,
    tagsDestacados: ["Grabación", "Backline"],
    equipamiento: ["Grabación", "Backline", "PA"],
    photo:
      "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80",
    lat: -34.598,
    lng: -58.438,
    libresHoy: 1,
  },
  {
    id: "4",
    name: "La Cueva San Telmo",
    slug: "la-cueva-san-telmo",
    zona: "San Telmo",
    address: "Defensa 1120, CABA",
    description:
      "Sala íntima en el corazón de San Telmo. Buena para dúos y ensayos cortos.",
    plan: "seed",
    telefono: "11 4567-8901",
    precioDesde: 10000,
    cantidadSalas: 2,
    ratingAvg: 4.2,
    ratingCount: 31,
    tagsDestacados: ["Batería"],
    equipamiento: ["Batería"],
    photo:
      "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80",
    lat: -34.621,
    lng: -58.373,
    libresHoy: null,
  },
  {
    id: "5",
    name: "Caballito Beats",
    slug: "caballito-beats",
    zona: "Caballito",
    address: "Av. Rivadavia 5100, CABA",
    description:
      "Cuatro salas con batería y backline. Opción de grabación en vivo.",
    plan: "cliente",
    precioDesde: 14000,
    cantidadSalas: 4,
    ratingAvg: 4.7,
    ratingCount: 92,
    tagsDestacados: ["Batería", "Grabación"],
    equipamiento: ["Batería", "Backline", "Grabación"],
    photo:
      "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&q=80",
    lat: -34.62,
    lng: -58.44,
    libresHoy: 4,
  },
  {
    id: "6",
    name: "Flores Sound",
    slug: "flores-sound",
    zona: "Flores",
    address: "Av. Directorio 3200, CABA",
    description:
      "Espacio simple con PA para ensayos. Precios accesibles en zona Flores.",
    plan: "seed",
    telefono: "11 4234-5566",
    precioDesde: 9000,
    cantidadSalas: 1,
    ratingAvg: null,
    ratingCount: 0,
    tagsDestacados: ["PA"],
    equipamiento: ["PA"],
    photo:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
    lat: -34.628,
    lng: -58.463,
    libresHoy: null,
  },
  {
    id: "7",
    name: "Colegiales Room",
    slug: "colegiales-room",
    zona: "Colegiales",
    address: "Av. Federico Lacroze 2800, CABA",
    description:
      "Salas climatizadas con backline y PA. Ideal para bandas de Colegiales y alrededores.",
    plan: "destacado",
    precioDesde: 16000,
    cantidadSalas: 3,
    ratingAvg: 4.9,
    ratingCount: 141,
    tagsDestacados: ["Backline", "Aire acondicionado"],
    equipamiento: ["Backline", "Aire acondicionado", "PA"],
    photo:
      "https://images.unsplash.com/photo-1514320291840-3092126dffe3?w=800&q=80",
    lat: -34.573,
    lng: -58.449,
    libresHoy: 2,
  },
  {
    id: "8",
    name: "Palermo Amp",
    slug: "palermo-amp",
    zona: "Palermo",
    address: "Costa Rica 4800, CABA",
    description:
      "Dos salas con batería y PA. Reservá por teléfono o pasá a conocer el lugar.",
    plan: "seed",
    telefono: "11 4789-1122",
    precioDesde: 13000,
    cantidadSalas: 2,
    ratingAvg: 4.4,
    ratingCount: 48,
    tagsDestacados: ["Batería", "PA"],
    equipamiento: ["Batería", "PA"],
    photo:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80",
    lat: -34.582,
    lng: -58.415,
    libresHoy: null,
  },
];

export function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistancia(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export function slugifyZona(zona: string) {
  return zona
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/** Comparación sin acentos ni mayúsculas. */
export function foldText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function toTitleCaseWords(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((w) =>
      w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

/** Normaliza provincia del address Places (`CABA`, `Buenos Aires`, …). */
export function normalizeProvinciaLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/ciudad aut[oó]noma|^\s*caba\s*$/i.test(t) || foldText(t) === "caba") {
    return "CABA";
  }
  return toTitleCaseWords(t);
}

/**
 * Provincia desde address formateado: "Calle Nro, Localidad, Provincia".
 * Si solo hay un segmento, se usa ese valor.
 */
export function provinciaFromAddress(address: string): string | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return normalizeProvinciaLabel(parts[parts.length - 1]!);
}

export type ZonaFilterOption = { value: string; label: string };

/**
 * Opciones del filtro: provincias (CABA, Córdoba, …) y localidades/barrios
 * (Caballito, Centro, …) sin concatenar. Filtrar por provincia incluye
 * todas sus localidades.
 */
export function buildZonaFilterOptions(
  salas: ReadonlyArray<{ zona: string; address: string }>,
): ZonaFilterOption[] {
  const provincias = new Set<string>();
  const localidades = new Set<string>();

  for (const s of salas) {
    const prov = provinciaFromAddress(s.address);
    if (prov) provincias.add(prov);

    const z = toTitleCaseWords(s.zona);
    if (!z) continue;
    localidades.add(z);
  }

  // Misma etiqueta no puede ser provincia y localidad (ej. "Buenos Aires")
  const provFolds = new Set([...provincias].map(foldText));
  for (const loc of [...localidades]) {
    if (provFolds.has(foldText(loc))) localidades.delete(loc);
  }

  const options: ZonaFilterOption[] = [
    ...[...provincias].map((p) => ({ value: p, label: p })),
    ...[...localidades].map((l) => ({ value: l, label: l })),
  ];

  return options.sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
  );
}

/** Provincia → todas las de esa provincia; localidad/barrio → match por zona. */
export function matchesZonaFilter(
  sala: { zona: string; address: string },
  filter: string,
): boolean {
  const f = filter.trim();
  if (!f) return true;

  const folded = foldText(f);
  const prov = provinciaFromAddress(sala.address);

  if (prov && foldText(prov) === folded) return true;
  if (foldText(sala.zona.trim()) === folded) return true;
  return false;
}

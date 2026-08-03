import type { DirectorioSala } from "./directorio-data";
import { DEMO_SALAS } from "./directorio-data";

export type EstudioSala = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoria: "Música" | "Danza" | "Teatro" | "Multiuso";
  tags: string[];
  capacity: number;
  anchoMetros: number;
  largoMetros: number;
  precioHora: number;
  acustica: string;
  /** HH:MM local — demo; real = horarios_atencion de la sede */
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
};

export type EstudioResena = {
  id: string;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  publishedAt: string;
};

export type EstudioDetalle = DirectorioSala & {
  amenidades: string[];
  /** Galería del estudio (sede). Si está vacía, se usan foto + fotos de salas. */
  photos?: string[];
  horarios: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  promociones: Array<{
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
  }>;
  salas: EstudioSala[];
  resenas: EstudioResena[];
};

export type SalaDetalle = {
  estudio: EstudioDetalle;
  sala: EstudioSala;
};

const SONAR_RESENAS: EstudioResena[] = [
  {
    id: "r1",
    authorName: "Martín Gutiérrez",
    rating: 5,
    body: "Excelente sala, equipos impecables. La batería es lo mejor que probé en una sala de ensayo. Siempre volvemos.",
    publishedAt: "2026-02-27",
  },
  {
    id: "r2",
    authorName: "Lucía Fernández",
    rating: 5,
    body: "Reservamos para grabar un demo y la calidad del sonido nos sorprendió. Muy recomendable.",
    publishedAt: "2026-02-24",
  },
  {
    id: "r3",
    authorName: "Banda Ecos",
    rating: 4,
    body: "Muy buena sala, lo único es que los platos no están incluidos y los nuestros no entraban en el auto. El resto, 10 puntos.",
    publishedAt: "2026-02-19",
  },
  {
    id: "r4",
    authorName: "Diego Ramírez",
    rating: 5,
    body: "Venimos todos los sábados con la banda. El sonido es increíble y los equipos siempre funcionan. El mejor lugar de Almagro.",
    publishedAt: "2026-01-29",
  },
];

const PHOTO_A =
  "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80";
const PHOTO_B =
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80";
const PHOTO_C =
  "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=1200&q=80";
const PHOTO_D =
  "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1200&q=80";
const PHOTO_E =
  "https://images.unsplash.com/photo-1514320291840-3092126dffe3?w=1200&q=80";

const SONAR_SALAS: EstudioSala[] = [
  {
    id: "s1",
    slug: "sala-a-rock",
    name: "Sala A — Rock",
    description:
      "La sala más pedida del complejo. Acústica tratada profesionalmente, ideal para bandas de rock y metal.",
    categoria: "Música",
    tags: ["Música", "Rock", "Metal", "Punk", "Blues"],
    capacity: 5,
    anchoMetros: 6,
    largoMetros: 4,
    precioHora: 3500,
    acustica: "Profesional",
    horarioInicio: "10:00",
    horarioFin: "23:00",
    equipamiento: [
      "Batería completa (sin platos)",
      "Amplificador guitarra Marshall 100W",
      "Amplificador bajo Hartke 350W",
      "Consola 8 canales",
      "2 Micrófonos SM58",
      "2 Monitores de piso",
      "Atriles",
      "Cables XLR y plug",
    ],
    noIncluido: ["Platos", "Bajo", "Guitarra", "Teclado", "Pedales"],
    caracteristicas: [
      "Batería Mapex nueva",
      "Marshall 100W",
      "Aislamiento premium",
    ],
    photos: [PHOTO_A, PHOTO_B, PHOTO_C],
    popular: true,
    nueva: false,
    ratingAvg: 4.9,
    ratingCount: 47,
    disponibleHoy: true,
  },
  {
    id: "s2",
    slug: "sala-b-acustica",
    name: "Sala B — Acústica",
    description:
      "Espacio íntimo con tratamiento acústico fino. Perfecta para ensayar y grabar demos acústicos o jazz.",
    categoria: "Música",
    tags: ["Música", "Acústico", "Jazz"],
    capacity: 4,
    anchoMetros: 5,
    largoMetros: 4,
    precioHora: 2800,
    acustica: "Tratada",
    horarioInicio: "10:00",
    horarioFin: "23:00",
    equipamiento: [
      "Piano Yamaha afinado",
      "Micrófonos condensador",
      "Interface Focusrite",
      "Monitores de estudio",
      "Atriles",
      "Cables",
    ],
    noIncluido: ["Instrumentos de viento", "Pedales"],
    caracteristicas: [
      "Piano Yamaha afinado",
      "Micrófonos condensador",
      "Tratamiento acústico",
    ],
    photos: [PHOTO_B, PHOTO_A],
    popular: false,
    nueva: false,
    ratingAvg: 4.7,
    ratingCount: 33,
    disponibleHoy: true,
  },
  {
    id: "s3",
    slug: "sala-c-produccion",
    name: "Sala C — Producción",
    description:
      "Control room + booth chico para producción y grabación. Consola y monitores listos.",
    categoria: "Música",
    tags: ["Música", "Producción", "Grabación"],
    capacity: 3,
    anchoMetros: 4,
    largoMetros: 3.5,
    precioHora: 4200,
    acustica: "Control room",
    horarioInicio: "10:00",
    horarioFin: "23:00",
    equipamiento: [
      "Focusrite 18i20",
      "KRK Rokit 8",
      "Consola X32",
      "Micrófonos varios",
      "Auriculares",
    ],
    noIncluido: ["Plugins DAW", "Instrumentos"],
    caracteristicas: ["Focusrite 18i20", "KRK Rokit 8", "Consola X32"],
    photos: [PHOTO_C, PHOTO_A],
    popular: false,
    nueva: true,
    ratingAvg: 5.0,
    ratingCount: 12,
    disponibleHoy: false,
  },
  {
    id: "s4",
    slug: "sala-d-ensayo-grande",
    name: "Sala D — Ensayo grande",
    description:
      "La más grande del complejo. Ideal para bandas numerosas o ensayos con PA.",
    categoria: "Música",
    tags: ["Música", "Ensayo", "Bandas"],
    capacity: 8,
    anchoMetros: 8,
    largoMetros: 6,
    precioHora: 4800,
    acustica: "Profesional",
    horarioInicio: "10:00",
    horarioFin: "23:00",
    equipamiento: [
      "PA 2×15\"",
      "Backline completo",
      "Batería",
      "Monitores",
      "Aire acondicionado",
    ],
    noIncluido: ["Platos", "Instrumentos personales"],
    caracteristicas: ["PA 2×15\"", "Backline completo", "Aire acondicionado"],
    photos: [PHOTO_D, PHOTO_A],
    popular: true,
    nueva: false,
    ratingAvg: 4.8,
    ratingCount: 61,
    disponibleHoy: false,
  },
  {
    id: "s5",
    slug: "sala-e-multiuso",
    name: "Sala E — Multiuso",
    description:
      "Salón amplio con espejos y piso flotante. Sirve para danza, ensayo teatral o ensayos grandes.",
    categoria: "Multiuso",
    tags: ["Multiuso", "Danza", "Ensayo"],
    capacity: 12,
    anchoMetros: 10,
    largoMetros: 8,
    precioHora: 5200,
    acustica: "Sala viva",
    horarioInicio: "09:00",
    horarioFin: "22:00",
    equipamiento: ["Espejos", "Piso flotante", "Sistema de sonido", "Atriles"],
    noIncluido: ["Instrumentos", "Vestuario"],
    caracteristicas: ["Espejos", "Piso flotante", "Sistema de sonido"],
    photos: [PHOTO_E, PHOTO_B],
    popular: false,
    nueva: false,
    ratingAvg: 4.5,
    ratingCount: 28,
    disponibleHoy: true,
  },
];

function enrichSala(sala: EstudioSala, estudioId: string, i: number, precioBase: number): EstudioSala {
  return {
    ...sala,
    id: `${estudioId}-${sala.id}`,
    slug: sala.slug,
    precioHora: precioBase + i * 400,
  };
}

/** Detalle demo por slug — después sale de DB (tenant/sede + salas) */
export const DEMO_ESTUDIOS: Record<string, EstudioDetalle> = Object.fromEntries(
  DEMO_SALAS.filter((s) => s.plan !== "seed").map((s) => {
    const isSonar = s.slug === "estudio-sonar";
    const salas = isSonar
      ? SONAR_SALAS
      : SONAR_SALAS.slice(0, Math.min(s.cantidadSalas, 4)).map((sala, i) =>
          enrichSala(sala, s.id, i, s.precioDesde),
        );
    const gallery: string[] = [];
    const seen = new Set<string>();
    const push = (u?: string | null) => {
      const x = u?.trim();
      if (!x || seen.has(x)) return;
      seen.add(x);
      gallery.push(x);
    };
    push(s.photo);
    for (const sala of salas) {
      for (const p of sala.photos) push(p);
    }

    const estudio: EstudioDetalle = {
      ...s,
      photos: gallery.slice(0, 12),
      amenidades: isSonar
        ? [
            "Grabación",
            "Equipos premium",
            "Estacionamiento",
            "WiFi",
            "Aire acondicionado",
            "Sala de espera",
            "Baño",
          ]
        : [
            "WiFi",
            "Aire acondicionado",
            "Baño",
            ...s.tagsDestacados.slice(0, 2),
          ],
      horarios: [
        { dayOfWeek: 1, startTime: "10:00", endTime: "23:00" },
        { dayOfWeek: 2, startTime: "10:00", endTime: "23:00" },
        { dayOfWeek: 3, startTime: "10:00", endTime: "23:00" },
        { dayOfWeek: 4, startTime: "10:00", endTime: "23:00" },
        { dayOfWeek: 5, startTime: "10:00", endTime: "23:00" },
        { dayOfWeek: 6, startTime: "12:00", endTime: "22:00" },
      ],
      promociones: [],
      salas,
      resenas: isSonar
        ? SONAR_RESENAS
        : SONAR_RESENAS.slice(0, 2).map((r) => ({
            ...r,
            id: `${s.id}-${r.id}`,
          })),
    };
    return [s.slug, estudio];
  }),
);

export function getEstudioBySlug(slug: string): EstudioDetalle | null {
  return DEMO_ESTUDIOS[slug] ?? null;
}

export function getSalaDetalle(
  estudioSlug: string,
  salaSlug: string,
): SalaDetalle | null {
  const estudio = getEstudioBySlug(estudioSlug);
  if (!estudio) return null;
  const sala = estudio.salas.find((s) => s.slug === salaSlug);
  if (!sala) return null;
  return { estudio, sala };
}

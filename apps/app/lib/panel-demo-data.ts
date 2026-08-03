import type { AdicionalDto } from "@/app/actions/adicionales";
import type { BloqueoDto } from "@/app/actions/bloqueos";
import type { CajaDiaDto } from "@/app/actions/caja";
import type { ClienteDto } from "@/app/actions/clientes";
import type { MpStatusDto } from "@/app/actions/mp";
import type { NegocioDto } from "@/app/actions/negocio";
import type { PreciosBundleDto } from "@/app/actions/precios";
import type { AgendaReservaDto } from "@/app/actions/reservas";
import type { ResenasBundleDto } from "@/app/actions/resenas";
import type { MembresiasBundleDto } from "@/app/actions/membresias";
import type { SalaDto } from "@/app/actions/salas";
import type { SuscripcionDto } from "@/app/actions/suscripcion";
import type { EstudioDetalle, EstudioSala } from "@/lib/estudio-detalle-data";
import { loadEstudioBySlug } from "@/lib/publico-data";

/** Mismo slug que la ficha pública / seed. */
export const PANEL_DEMO_SLUG = "estudio-demo";

const PHOTO = {
  a: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80",
  b: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80",
  c: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=1200&q=80",
  d: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1200&q=80",
} as const;

function todayYmdAr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoAt(fecha: string, hhmm: string): string {
  // Display-oriented ISO; panel UI formatea en AR
  return `${fecha}T${hhmm}:00.000-03:00`;
}

function ymdPlus(days: number): string {
  const parts = todayYmdAr().split("-").map(Number);
  const d = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fallback si el seed no está en DB: mismos datos que seed-estudio-demo. */
function fallbackEstudio(): EstudioDetalle {
  const salas: EstudioSala[] = [
    {
      id: "demo-sala-a",
      slug: "sala-a-rock",
      name: "Sala A — Rock",
      description:
        "La sala más pedida del complejo. Acústica tratada, ideal para rock y metal.",
      categoria: "Música",
      tags: ["Música", "Rock", "Metal"],
      capacity: 5,
      anchoMetros: 6,
      largoMetros: 4,
      precioHora: 3500,
      acustica: "Profesional",
      horarioInicio: "10:00",
      horarioFin: "23:00",
      equipamiento: [
        "Batería completa (sin platos)",
        "Amp guitarra Marshall 100W",
        "Amp bajo Hartke 350W",
        "Consola 8 canales",
        "2 Micrófonos SM58",
        "2 Monitores de piso",
      ],
      noIncluido: ["Platos", "Guitarra", "Bajo", "Pedales"],
      caracteristicas: ["Batería Mapex", "Marshall 100W", "Aislamiento premium"],
      photos: [PHOTO.a, PHOTO.b, PHOTO.c],
      popular: true,
      nueva: false,
      ratingAvg: 4.9,
      ratingCount: 47,
      disponibleHoy: true,
    },
    {
      id: "demo-sala-b",
      slug: "sala-b-acustica",
      name: "Sala B — Acústica",
      description:
        "Espacio íntimo con piano. Ideal para acústico, jazz o grabar demos.",
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
      ],
      noIncluido: ["Instrumentos de viento", "Pedales"],
      caracteristicas: ["Piano Yamaha", "Micrófonos condensador"],
      photos: [PHOTO.b, PHOTO.a],
      popular: false,
      nueva: false,
      ratingAvg: 4.7,
      ratingCount: 33,
      disponibleHoy: true,
    },
    {
      id: "demo-sala-c",
      slug: "sala-c-produccion",
      name: "Sala C — Producción",
      description: "Control room + booth chico para producción y grabación.",
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
      ],
      noIncluido: ["Plugins DAW", "Instrumentos"],
      caracteristicas: ["Focusrite 18i20", "KRK Rokit 8", "Consola X32"],
      photos: [PHOTO.c, PHOTO.a],
      popular: false,
      nueva: true,
      ratingAvg: 5,
      ratingCount: 12,
      disponibleHoy: true,
    },
    {
      id: "demo-sala-d",
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
        'PA 2×15"',
        "Backline completo",
        "Batería",
        "Monitores",
        "Aire acondicionado",
      ],
      noIncluido: ["Platos", "Instrumentos personales"],
      caracteristicas: ['PA 2×15"', "Backline completo", "Aire acondicionado"],
      photos: [PHOTO.d, PHOTO.a],
      popular: true,
      nueva: false,
      ratingAvg: 4.8,
      ratingCount: 61,
      disponibleHoy: true,
    },
  ];

  return {
    id: "demo-tenant",
    name: "Estudio de prueba",
    slug: PANEL_DEMO_SLUG,
    zona: "Palermo",
    address: "Honduras 5200, Palermo, CABA",
    description:
      "Este es un estudio de prueba. Así se ve tu página pública cuando reclamás tu ficha y cargás salas, fotos, precios y horarios. No aparece en el directorio.",
    plan: "cliente",
    telefono: "11 5555-0000",
    precioDesde: 2800,
    cantidadSalas: salas.length,
    ratingAvg: 4.8,
    ratingCount: 153,
    tagsDestacados: ["Grabación", "Backline", "Estudio de prueba"],
    equipamiento: ["Batería", "PA", "Piano", "Aire acondicionado"],
    photo: PHOTO.a,
    lat: -34.5875,
    lng: -58.425,
    libresHoy: 3,
    amenidades: [
      "WiFi",
      "Aire acondicionado",
      "Estacionamiento",
      "Sala de espera",
      "Baño",
      "Grabación",
    ],
    horarios: [
      { dayOfWeek: 1, startTime: "10:00", endTime: "23:00" },
      { dayOfWeek: 2, startTime: "10:00", endTime: "23:00" },
      { dayOfWeek: 3, startTime: "10:00", endTime: "23:00" },
      { dayOfWeek: 4, startTime: "10:00", endTime: "23:00" },
      { dayOfWeek: 5, startTime: "10:00", endTime: "23:00" },
      { dayOfWeek: 6, startTime: "11:00", endTime: "22:00" },
    ],
    promociones: [
      {
        id: "promo-happy",
        nombre: "Happy hour",
        tipo: "continuo",
        daysOfWeek: [1, 2, 3, 4],
        startTime: "14:00",
        endTime: "18:00",
        fechaDesde: null,
        fechaHasta: null,
        descuentoPorcentaje: 20,
        precioPorHora: 2800,
      },
      {
        id: "promo-2x1",
        nombre: "2x1 mañanas",
        tipo: "continuo",
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: "10:00",
        endTime: "13:00",
        fechaDesde: null,
        fechaHasta: null,
        descuentoPorcentaje: 30,
        precioPorHora: 1960,
      },
      {
        id: "promo-flash",
        nombre: "Flash fin de semana",
        tipo: "puntual",
        daysOfWeek: [5, 6],
        startTime: null,
        endTime: null,
        fechaDesde: todayYmdAr(),
        fechaHasta: ymdPlus(21),
        descuentoPorcentaje: 25,
        precioPorHora: 3600,
      },
    ],
    salas,
    resenas: [
      {
        id: "r1",
        authorName: "Martín Gutiérrez",
        rating: 5,
        body: "Excelente sala, equipos impecables. (Reseña de ejemplo en el estudio de prueba.)",
        publishedAt: ymdPlus(-12),
      },
      {
        id: "r2",
        authorName: "Lucía Fernández",
        rating: 5,
        body: "Reservamos para un demo y el sonido nos sorprendió. Así se verían tus reseñas.",
        publishedAt: ymdPlus(-5),
      },
      {
        id: "r3",
        authorName: "Banda Ecos",
        rating: 4,
        body: "Muy buena sala. Esto es contenido de demostración para dueños.",
        publishedAt: ymdPlus(-2),
      },
    ],
  };
}

export async function loadPanelDemoEstudio(): Promise<EstudioDetalle> {
  const fromDb = await loadEstudioBySlug(PANEL_DEMO_SLUG);
  if (fromDb && fromDb.salas.length > 0) return fromDb;
  return fallbackEstudio();
}

function toSalaDto(s: EstudioSala, sedeId: string, sortOrder: number): SalaDto {
  return {
    id: s.id,
    sedeId,
    name: s.name,
    slug: s.slug,
    description: s.description,
    categoria: s.categoria,
    tags: s.tags,
    capacity: s.capacity,
    anchoMetros:
      s.anchoMetros != null ? Number(s.anchoMetros).toFixed(2) : null,
    largoMetros:
      s.largoMetros != null ? Number(s.largoMetros).toFixed(2) : null,
    precioHora: Number(s.precioHora).toFixed(2),
    acustica: s.acustica,
    equipamiento: s.equipamiento,
    noIncluido: s.noIncluido,
    caracteristicas: s.caracteristicas,
    photos: s.photos,
    popular: s.popular,
    nueva: s.nueva,
    active: true,
    sortOrder,
    ratingAvg: s.ratingAvg != null ? String(s.ratingAvg) : null,
    ratingCount: s.ratingCount,
    duracionMinMinutos: null,
    duracionMaxMinutos: null,
    granularidadMinutos: null,
  };
}

export function buildPanelDemoBundle(estudio: EstudioDetalle) {
  const sedeId = "demo-sede";
  const salas = estudio.salas.map((s, i) => toSalaDto(s, sedeId, i));
  const fecha = todayYmdAr();
  const [a, b, c, d] = salas;

  const negocio: NegocioDto = {
    tenant: {
      id: estudio.id,
      name: estudio.name,
      slug: estudio.slug,
      instagramUrl: estudio.instagramUrl ?? null,
      websiteUrl: estudio.websiteUrl ?? null,
      whatsapp: estudio.whatsapp ?? null,
      youtubeUrl: estudio.youtubeUrl ?? null,
      tiktokUrl: estudio.tiktokUrl ?? null,
      linksExtra: estudio.linksExtra ?? [],
    },
    sede: {
      id: sedeId,
      name: estudio.name,
      zona: estudio.zona,
      address: estudio.address,
      description: estudio.description,
      photoUrl: estudio.photo || null,
      photos: (() => {
        const seen = new Set<string>();
        const out: string[] = [];
        const push = (u?: string | null) => {
          const s = u?.trim();
          if (!s || seen.has(s)) return;
          seen.add(s);
          out.push(s);
        };
        for (const p of estudio.photos ?? []) push(p);
        push(estudio.photo);
        return out.slice(0, 12);
      })(),
      amenidades: estudio.amenidades,
      lat: estudio.lat,
      lng: estudio.lng,
    },
    politica: {
      holdMinutos: 5,
      cancelacionVentanaHoras: 24,
      duracionMinMinutos: 60,
      duracionMaxMinutos: 240,
      senaModo: "nunca",
      senaTipo: "porcentaje",
      senaValor: "30",
      senaDestinoCancelacion: "perder",
      permiteReprogramar: true,
    },
    horarios: estudio.horarios.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime ?? "10:00",
      endTime: h.endTime ?? "23:00",
    })),
    directorio: {
      tagsDestacados: estudio.tagsDestacados,
      telefono: estudio.telefono ?? null,
      plan: estudio.plan,
    },
    salasCount: salas.length,
  };

  const reservas: AgendaReservaDto[] = [
    {
      id: "demo-r1",
      salaId: a?.id ?? "demo-sala-a",
      salaName: a?.name ?? "Sala A — Rock",
      startsAt: "10:00",
      endsAt: "11:00",
      clienteNombre: "Martín Gutiérrez",
      clienteTelefono: "11 5555-0101",
      clienteEmail: "martin@ejemplo.com",
      precioTotal: 3500,
      precioSala: 3000,
      senaPagada: 0,
      saldo: 3500,
      estado: "confirmada",
      origen: "web",
      holdExpiresAt: null,
      createdAt: isoAt(ymdPlus(-3), "18:42"),
      adicionales: [
        {
          id: "demo-adic-microfono",
          name: "Micrófono extra",
          cantidad: 1,
          precioUnitario: 500,
          modalidad: "por_reserva",
        },
      ],
    },
    {
      id: "demo-r2",
      salaId: b?.id ?? "demo-sala-b",
      salaName: b?.name ?? "Sala B — Acústica",
      startsAt: "14:00",
      endsAt: "16:00",
      clienteNombre: "Lucía Fernández",
      clienteTelefono: "11 5555-0202",
      clienteEmail: null,
      precioTotal: 5600,
      precioSala: 4000,
      senaPagada: 1680,
      saldo: 3920,
      estado: "confirmada",
      origen: "web",
      holdExpiresAt: null,
      createdAt: isoAt(ymdPlus(-1), "11:28"),
      adicionales: [
        {
          id: "demo-adic-teclado",
          name: "Teclado",
          cantidad: 1,
          precioUnitario: 800,
          modalidad: "por_hora",
        },
      ],
    },
    {
      id: "demo-r3",
      salaId: d?.id ?? "demo-sala-d",
      salaName: d?.name ?? "Sala D — Ensayo grande",
      startsAt: "18:00",
      endsAt: "21:00",
      clienteNombre: "Banda Ecos",
      clienteTelefono: "11 5555-0303",
      clienteEmail: "ecos@ejemplo.com",
      precioTotal: 14400,
      precioSala: 12200,
      senaPagada: 0,
      saldo: 14400,
      estado: "hold",
      origen: "web",
      holdExpiresAt: isoAt(fecha, "18:05"),
      createdAt: isoAt(fecha, "17:51"),
      adicionales: [
        {
          id: "demo-adic-platos",
          name: "Set de platos",
          cantidad: 1,
          precioUnitario: 1200,
          modalidad: "por_reserva",
        },
        {
          id: "demo-adic-microfono",
          name: "Micrófono extra",
          cantidad: 2,
          precioUnitario: 500,
          modalidad: "por_reserva",
        },
      ],
    },
    {
      id: "demo-r4",
      salaId: c?.id ?? "demo-sala-c",
      salaName: c?.name ?? "Sala C — Producción",
      startsAt: "11:00",
      endsAt: "13:00",
      clienteNombre: "Nico Valdez",
      clienteTelefono: "11 5555-0404",
      clienteEmail: null,
      precioTotal: 8400,
      precioSala: 8400,
      senaPagada: 8400,
      saldo: 0,
      estado: "completada",
      origen: "panel",
      holdExpiresAt: null,
      createdAt: isoAt(ymdPlus(-5), "09:12"),
      adicionales: [],
    },
    {
      id: "demo-r5",
      salaId: a?.id ?? "demo-sala-a",
      salaName: a?.name ?? "Sala A — Rock",
      startsAt: "16:00",
      endsAt: "18:00",
      clienteNombre: "Sofía Ríos",
      clienteTelefono: "11 5555-0505",
      clienteEmail: "sofia@ejemplo.com",
      precioTotal: 7000,
      precioSala: 6000,
      senaPagada: 2000,
      saldo: 5000,
      estado: "senada",
      origen: "web",
      holdExpiresAt: null,
      createdAt: isoAt(ymdPlus(-2), "20:17"),
      adicionales: [
        {
          id: "demo-adic-microfono",
          name: "Micrófono extra",
          cantidad: 2,
          precioUnitario: 500,
          modalidad: "por_reserva",
        },
      ],
    },
  ];

  const clientes: ClienteDto[] = [
    {
      id: "c1",
      nombre: "Martín Gutiérrez",
      telefono: "11 5555-0101",
      email: "martin@ejemplo.com",
      banda: "Los Mártires",
      noShowCount: 0,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 12,
      ultimaReserva: fecha,
      salaHabitual: a?.name ?? "Sala A",
    },
    {
      id: "c2",
      nombre: "Lucía Fernández",
      telefono: "11 5555-0202",
      email: null,
      banda: null,
      noShowCount: 1,
      creditoFavor: 500,
      notasInternas: "Llega siempre puntual",
      reservasCount: 4,
      ultimaReserva: fecha,
      salaHabitual: b?.name ?? "Sala B",
    },
    {
      id: "c3",
      nombre: "Banda Ecos",
      telefono: "11 5555-0303",
      email: "ecos@ejemplo.com",
      banda: "Ecos",
      noShowCount: 0,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 7,
      ultimaReserva: fecha,
      salaHabitual: d?.name ?? c?.name ?? "Sala D",
    },
    {
      id: "c4",
      nombre: "Nico Valdez",
      telefono: "11 5555-0404",
      email: null,
      banda: "Valdez Trío",
      noShowCount: 0,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 3,
      ultimaReserva: fecha,
      salaHabitual: c?.name ?? "Sala C",
    },
    {
      id: "c5",
      nombre: "Sofía Ríos",
      telefono: "11 5555-0505",
      email: "sofia@ejemplo.com",
      banda: null,
      noShowCount: 2,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 5,
      ultimaReserva: ymdPlus(-3),
      salaHabitual: a?.name ?? "Sala A",
    },
    {
      id: "c6",
      nombre: "Diego Paredes",
      telefono: "11 5555-0606",
      email: null,
      banda: "Paredes & Co",
      noShowCount: 0,
      creditoFavor: 1200,
      notasInternas: null,
      reservasCount: 9,
      ultimaReserva: ymdPlus(-1),
      salaHabitual: b?.name ?? "Sala B",
    },
    {
      id: "c7",
      nombre: "Ana Molina",
      telefono: "11 5555-0707",
      email: "ana@ejemplo.com",
      banda: "Molina Quartet",
      noShowCount: 0,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 2,
      ultimaReserva: ymdPlus(-7),
      salaHabitual: null,
    },
    {
      id: "c8",
      nombre: "Tomás Vidal",
      telefono: "11 5555-0808",
      email: null,
      banda: null,
      noShowCount: 0,
      creditoFavor: 0,
      notasInternas: "Prefiere horario tarde",
      reservasCount: 6,
      ultimaReserva: ymdPlus(-2),
      salaHabitual: d?.name ?? "Sala D",
    },
    {
      id: "c9",
      nombre: "Camila Ortiz",
      telefono: "11 5555-0909",
      email: "camila@ejemplo.com",
      banda: "Ortiz Duo",
      noShowCount: 1,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 8,
      ultimaReserva: ymdPlus(-4),
      salaHabitual: a?.name ?? "Sala A",
    },
    {
      id: "c10",
      nombre: "Julián Castro",
      telefono: "11 5555-1010",
      email: null,
      banda: null,
      noShowCount: 0,
      creditoFavor: 300,
      notasInternas: null,
      reservasCount: 1,
      ultimaReserva: ymdPlus(-10),
      salaHabitual: c?.name ?? "Sala C",
    },
    {
      id: "c11",
      nombre: "Valentina Ruiz",
      telefono: "11 5555-1111",
      email: "valen@ejemplo.com",
      banda: "Ruiz Project",
      noShowCount: 0,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 11,
      ultimaReserva: ymdPlus(-1),
      salaHabitual: b?.name ?? "Sala B",
    },
    {
      id: "c12",
      nombre: "Facundo Sosa",
      telefono: "11 5555-1212",
      email: null,
      banda: "Sosa Band",
      noShowCount: 3,
      creditoFavor: 0,
      notasInternas: null,
      reservasCount: 4,
      ultimaReserva: ymdPlus(-14),
      salaHabitual: a?.name ?? "Sala A",
    },
  ];

  const caja: CajaDiaDto = {
    fecha,
    abierta: true,
    cerradaAt: null,
    inicioCaja: 5000,
    ingresos: 10080,
    egresos: 800,
    total: 14280,
    porMedio: {
      efectivo: 8120,
      mercadopago: 1680,
      transferencia: 4480,
      tarjeta: 0,
    },
    movimientos: [
      {
        id: "m0",
        tipo: "inicio_caja",
        estado: "cobrado",
        medioPago: "efectivo",
        monto: 5000,
        descripcion: "Apertura de caja",
        occurredAt: isoAt(fecha, "08:55"),
        reservaId: null,
        clienteNombre: "—",
        salaName: null,
        turnoStartsAt: null,
        turnoEndsAt: null,
      },
      {
        id: "m1",
        tipo: "sena",
        estado: "cobrado",
        medioPago: "mercadopago",
        monto: 1680,
        descripcion: "Seña online",
        occurredAt: isoAt(fecha, "09:12"),
        reservaId: "demo-r2",
        clienteNombre: "Lucía Fernández",
        salaName: b?.name ?? null,
        turnoStartsAt: "14:00",
        turnoEndsAt: "16:00",
      },
      {
        id: "m2",
        tipo: "saldo",
        estado: "cobrado",
        medioPago: "efectivo",
        monto: 3920,
        descripcion: null,
        occurredAt: isoAt(fecha, "12:05"),
        reservaId: "demo-r1",
        clienteNombre: "Martín Gutiérrez",
        salaName: a?.name ?? null,
        turnoStartsAt: "10:00",
        turnoEndsAt: "11:00",
      },
      {
        id: "m3",
        tipo: "saldo",
        estado: "cobrado",
        medioPago: "transferencia",
        monto: 4480,
        descripcion: "Cobro completo",
        occurredAt: isoAt(fecha, "13:10"),
        reservaId: "demo-r4",
        clienteNombre: "Nico Valdez",
        salaName: c?.name ?? null,
        turnoStartsAt: "11:00",
        turnoEndsAt: "13:00",
      },
      {
        id: "m4",
        tipo: "egreso",
        estado: "cobrado",
        medioPago: "efectivo",
        monto: 800,
        descripcion: "Compra de baquetas / insumos",
        occurredAt: isoAt(fecha, "15:40"),
        reservaId: null,
        clienteNombre: "—",
        salaName: null,
        turnoStartsAt: null,
        turnoEndsAt: null,
      },
    ],
  };

  const adicionales: AdicionalDto[] = [
    {
      id: "demo-adic-microfono",
      grupoId: "g-backline",
      grupo: "Backline",
      name: "Micrófono extra",
      precio: 500,
      modalidad: "por_reserva",
      stock: 8,
      active: true,
      caracteristicas: ["XLR", "Incluye pie"],
      photoUrl: PHOTO.a,
    },
    {
      id: "demo-adic-teclado",
      grupoId: "g-backline",
      grupo: "Backline",
      name: "Teclado",
      precio: 800,
      modalidad: "por_hora",
      stock: 2,
      active: true,
      caracteristicas: ["61 teclas", "Con stand"],
      photoUrl: PHOTO.c,
    },
    {
      id: "demo-adic-platos",
      grupoId: "g-backline",
      grupo: "Backline",
      name: "Set de platos",
      precio: 1200,
      modalidad: "por_reserva",
      stock: 3,
      active: true,
      caracteristicas: ["Hi-hat", "Crash", "Ride"],
      photoUrl: PHOTO.d,
    },
    {
      id: "ad3",
      grupoId: "g-servicios",
      grupo: "Servicios",
      name: "Ingeniero de sonido",
      precio: 3500,
      modalidad: "por_hora",
      stock: null,
      active: true,
      caracteristicas: ["Mix en vivo"],
      photoUrl: PHOTO.b,
    },
  ];

  const adicionalGrupos = [
    { id: "g-backline", name: "Backline", sortOrder: 0 },
    { id: "g-servicios", name: "Servicios", sortOrder: 1 },
    { id: "g-bebidas", name: "Bebidas", sortOrder: 2 },
  ];

  const bloqueos: BloqueoDto[] = [
    {
      id: "bl-hoy",
      sedeId,
      // Sala C queda libre después de 13:00 (turno Nico 11–13)
      salaId: c?.id ?? null,
      salaName: c?.name ?? null,
      fecha,
      startTime: "14:00",
      endTime: "16:00",
      startsAt: isoAt(fecha, "14:00"),
      endsAt: isoAt(fecha, "16:00"),
      motivo: "Limpieza profunda",
      scope: "sala",
    },
    {
      id: "bl1",
      sedeId,
      salaId: a?.id ?? null,
      salaName: a?.name ?? null,
      fecha: ymdPlus(1),
      startTime: "10:00",
      endTime: "14:00",
      startsAt: isoAt(ymdPlus(1), "10:00"),
      endsAt: isoAt(ymdPlus(1), "14:00"),
      motivo: "Mantenimiento de batería",
      scope: "sala",
    },
  ];

  const bySlug = Object.fromEntries(
    salas.filter((s) => s.slug).map((s) => [s.slug!, s]),
  );

  const precios: PreciosBundleDto = {
    salas: salas.map((s) => ({
      id: s.id,
      name: s.name,
      precioHora: Number(s.precioHora ?? 0),
      active: s.active,
    })),
    reglas: estudio.promociones.map((p) => {
      const lower = p.nombre.toLowerCase();
      const sala =
        (lower.includes("happy")
          ? bySlug["sala-a-rock"]
          : lower.includes("2x1")
            ? bySlug["sala-b-acustica"]
            : bySlug["sala-d-ensayo-grande"]) ?? salas[0];
      return {
        id: p.id,
        scope: "sala",
        scopeId: sala?.id ?? "",
        scopeLabel: sala?.name ?? "Sala",
        tipo: p.tipo,
        nombre: p.nombre,
        daysOfWeek: p.daysOfWeek,
        startTime: p.startTime,
        endTime: p.endTime,
        fechaDesde: p.fechaDesde,
        fechaHasta: p.fechaHasta,
        precioPorHora: p.precioPorHora,
        descuentoPorcentaje: p.descuentoPorcentaje,
        active: true,
      };
    }),
  };

  const resenas: ResenasBundleDto = {
    ratingAvg: estudio.ratingAvg,
    ratingCount: estudio.ratingCount,
    resenas: estudio.resenas.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating as 1 | 2 | 3 | 4 | 5,
      body: r.body,
      published: true,
      publishedAt: r.publishedAt,
      salaId: null,
    })),
  };

  const cLucrecia = clientes.find((c) => c.creditoFavor > 0) ?? clientes[0]!;
  const membresias: MembresiasBundleDto = {
    planes: [
      {
        id: "demo-plan-mensual",
        name: "Mensual banda",
        descripcion: "Paga el mes y gastá el crédito en turnos",
        precioMensual: 40000,
        creditoMensual: 50000,
        diasPeriodo: 30,
        active: true,
      },
      {
        id: "demo-plan-pro",
        name: "Pro 8h",
        descripcion: "Más crédito para ensayos largos",
        precioMensual: 70000,
        creditoMensual: 90000,
        diasPeriodo: 30,
        active: true,
      },
    ],
    membresias: [
      {
        id: "demo-mem-1",
        clienteId: cLucrecia.id,
        planId: "demo-plan-mensual",
        estado: "activa",
        vigenteDesde: fecha,
        vigenteHasta: fecha,
        clienteNombre: cLucrecia.nombre,
        clienteTelefono: cLucrecia.telefono,
        clienteEmail: cLucrecia.email,
        creditoFavor: cLucrecia.creditoFavor,
        planName: "Mensual banda",
        precioMensual: 40000,
        creditoMensual: 50000,
        diasPeriodo: 30,
      },
    ],
  };

  const plan: SuscripcionDto = {
    status: "exempt",
    planCode: "starter",
    planName: "Starter",
    priceArs: 0,
    trialEndsAt: null,
    periodEnd: null,
    plans: [
      {
        code: "starter",
        name: "Starter",
        priceArs: 0,
        periodDays: 30,
        directorioPlan: "cliente",
        current: true,
      },
      {
        code: "pro",
        name: "Pro",
        priceArs: 14900,
        periodDays: 30,
        directorioPlan: "destacado",
        current: false,
      },
    ],
    checkoutAvailable: false,
    canAccessPanel: true,
    blockedReason: null,
    mpPlatformConfigured: false,
    mock: true,
  };

  const mpStatus: MpStatusDto = {
    mock: true,
    oauthConfigured: false,
    oauthAvailable: false,
    connected: false,
    tenantConnected: false,
    mpUserId: null,
    expiresAt: null,
    marketplaceFeePercent: 0,
    marketplaceFeeEnabled: false,
  };

  const team = {
    members: [
      {
        userId: "demo-owner",
        email: "demo-owner@salaya.local",
        name: "Dueño Demo",
        role: "owner" as const,
        createdAt: isoAt(ymdPlus(-30), "10:00"),
        hasPassword: true,
      },
    ],
    invites: [] as Array<{
      id: string;
      email: string;
      role: "owner" | "employee";
      expiresAt: string;
      createdAt: string;
      token: string;
    }>,
  };

  return {
    estudio,
    estudioName: estudio.name,
    fecha,
    negocio,
    salas,
    reservas,
    clientes,
    caja,
    adicionales,
    adicionalGrupos,
    bloqueos,
    precios,
    resenas,
    membresias,
    plan,
    mpStatus,
    team,
  };
}

export type PanelDemoBundle = ReturnType<typeof buildPanelDemoBundle>;

export async function loadPanelDemoBundle(): Promise<PanelDemoBundle> {
  const estudio = await loadPanelDemoEstudio();
  return buildPanelDemoBundle(estudio);
}

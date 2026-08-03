/**
 * Seed: estudio demo para dueños (no sale en el directorio).
 *
 * URL pública: /estudio-demo
 * opt_out=true → oculto en listado
 *
 * Run: pnpm --filter api exec tsx scripts/seed-estudio-demo.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  closeDb,
  createDb,
  directorioEntradas,
  horariosAtencion,
  politicas,
  resenas,
  salas,
  sedes,
  tenants,
  userTenants,
  users,
  reglasPrecio,
} from "@repo/db";
import { POLITICA_DEFAULTS } from "@repo/shared";

config({ path: resolve(process.cwd(), "../../.env") });

const SLUG = "estudio-demo";
const DEMO_EMAIL = "demo-owner@salaya.local";
const DEMO_PASSWORD = "demo-salaya-2026";

const PHOTO = {
  a: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80",
  b: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80",
  c: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=1200&q=80",
  d: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1200&q=80",
  e: "https://images.unsplash.com/photo-1514320291840-3092126dffe3?w=1200&q=80",
} as const;

const SALAS_DEMO = [
  {
    name: "Sala A — Rock",
    slug: "sala-a-rock",
    description:
      "La sala más pedida del complejo. Acústica tratada, ideal para rock y metal.",
    categoria: "Música",
    tags: ["Música", "Rock", "Metal"],
    capacity: 5,
    anchoMetros: "6.00",
    largoMetros: "4.00",
    precioHora: "3500.00",
    acustica: "Profesional",
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
    ratingAvg: "4.9",
    ratingCount: 47,
    sortOrder: 0,
  },
  {
    name: "Sala B — Acústica",
    slug: "sala-b-acustica",
    description:
      "Espacio íntimo con piano. Ideal para acústico, jazz o grabar demos.",
    categoria: "Música",
    tags: ["Música", "Acústico", "Jazz"],
    capacity: 4,
    anchoMetros: "5.00",
    largoMetros: "4.00",
    precioHora: "2800.00",
    acustica: "Tratada",
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
    ratingAvg: "4.7",
    ratingCount: 33,
    sortOrder: 1,
  },
  {
    name: "Sala C — Producción",
    slug: "sala-c-produccion",
    description:
      "Control room + booth chico para producción y grabación.",
    categoria: "Música",
    tags: ["Música", "Producción", "Grabación"],
    capacity: 3,
    anchoMetros: "4.00",
    largoMetros: "3.50",
    precioHora: "4200.00",
    acustica: "Control room",
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
    ratingAvg: "5.0",
    ratingCount: 12,
    sortOrder: 2,
  },
  {
    name: "Sala D — Ensayo grande",
    slug: "sala-d-ensayo-grande",
    description:
      "La más grande del complejo. Ideal para bandas numerosas o ensayos con PA.",
    categoria: "Música",
    tags: ["Música", "Ensayo", "Bandas"],
    capacity: 8,
    anchoMetros: "8.00",
    largoMetros: "6.00",
    precioHora: "4800.00",
    acustica: "Profesional",
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
    ratingAvg: "4.8",
    ratingCount: 61,
    sortOrder: 3,
  },
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida");

  const db = createDb(url);
  try {
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, SLUG),
      columns: { id: true },
    });
    if (existing) {
      await db
        .delete(directorioEntradas)
        .where(eq(directorioEntradas.tenantId, existing.id));
      await db.delete(tenants).where(eq(tenants.id, existing.id));
      console.log("~ borrado tenant anterior", SLUG);
    }

    const oldUser = await db.query.users.findFirst({
      where: eq(users.email, DEMO_EMAIL),
      columns: { id: true },
    });
    if (oldUser) {
      const stillLinked = await db.query.userTenants.findFirst({
        where: eq(userTenants.userId, oldUser.id),
        columns: { tenantId: true },
      });
      if (!stillLinked) {
        await db.delete(users).where(eq(users.id, oldUser.id));
      }
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: DEMO_EMAIL,
          passwordHash,
          name: "Dueño Demo",
        })
        .returning({ id: users.id });

      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: "Estudio de prueba",
          slug: SLUG,
          websiteUrl: "https://salaya.com",
          comoLlegar: "A 2 cuadras del subte. Timbre «Demo».",
          subscriptionStatus: "exempt",
          subscriptionPlanCode: "starter",
        })
        .returning({ id: tenants.id, slug: tenants.slug, name: tenants.name });

      await tx.insert(userTenants).values({
        userId: user!.id,
        tenantId: tenant!.id,
        role: "owner",
      });

      const [sede] = await tx
        .insert(sedes)
        .values({
          tenantId: tenant!.id,
          name: "Sede Demo Palermo",
          address: "Honduras 5200, Palermo, CABA",
          zona: "Palermo",
          description:
            "Este es un estudio de prueba. Así se ve tu página pública cuando reclamás tu ficha y cargás salas, fotos, precios y horarios. No aparece en el directorio.",
          photoUrl: PHOTO.a,
          lat: "-34.5875000",
          lng: "-58.4250000",
          amenidades: [
            "WiFi",
            "Aire acondicionado",
            "Estacionamiento",
            "Sala de espera",
            "Baño",
            "Grabación",
          ],
          active: true,
        })
        .returning({ id: sedes.id });

      await tx.insert(politicas).values({
        tenantId: tenant!.id,
        sedeId: sede!.id,
        senaModo: POLITICA_DEFAULTS.senaModo,
        senaTipo: POLITICA_DEFAULTS.senaTipo,
        senaValor: POLITICA_DEFAULTS.senaValor,
        holdMinutos: POLITICA_DEFAULTS.holdMinutos,
        cancelacionVentanaHoras: POLITICA_DEFAULTS.cancelacionVentanaHoras,
        senaDestinoCancelacion: POLITICA_DEFAULTS.senaDestinoCancelacion,
        permiteReprogramar: POLITICA_DEFAULTS.permiteReprogramar,
        duracionMinMinutos: POLITICA_DEFAULTS.duracionMinMinutos,
        duracionMaxMinutos: POLITICA_DEFAULTS.duracionMaxMinutos,
        granularidadMinutos: POLITICA_DEFAULTS.granularidadMinutos,
        requiereAprobacionSinSena: POLITICA_DEFAULTS.requiereAprobacionSinSena,
      });

      // Lun–vie 10–23, sáb 11–22, domingo cerrado
      await tx.insert(horariosAtencion).values([
        { tenantId: tenant!.id, sedeId: sede!.id, dayOfWeek: 1, startTime: "10:00", endTime: "23:00" },
        { tenantId: tenant!.id, sedeId: sede!.id, dayOfWeek: 2, startTime: "10:00", endTime: "23:00" },
        { tenantId: tenant!.id, sedeId: sede!.id, dayOfWeek: 3, startTime: "10:00", endTime: "23:00" },
        { tenantId: tenant!.id, sedeId: sede!.id, dayOfWeek: 4, startTime: "10:00", endTime: "23:00" },
        { tenantId: tenant!.id, sedeId: sede!.id, dayOfWeek: 5, startTime: "10:00", endTime: "23:00" },
        { tenantId: tenant!.id, sedeId: sede!.id, dayOfWeek: 6, startTime: "11:00", endTime: "22:00" },
      ]);

      const insertedSalas: { id: string; slug: string; precioHora: string }[] =
        [];
      for (const s of SALAS_DEMO) {
        const [row] = await tx
          .insert(salas)
          .values({
            tenantId: tenant!.id,
            sedeId: sede!.id,
            name: s.name,
            slug: s.slug,
            description: s.description,
            categoria: s.categoria,
            tags: [...s.tags],
            capacity: s.capacity,
            anchoMetros: s.anchoMetros,
            largoMetros: s.largoMetros,
            precioHora: s.precioHora,
            acustica: s.acustica,
            equipamiento: [...s.equipamiento],
            noIncluido: [...s.noIncluido],
            caracteristicas: [...s.caracteristicas],
            photos: [...s.photos],
            popular: s.popular,
            nueva: s.nueva,
            ratingAvg: s.ratingAvg,
            ratingCount: s.ratingCount,
            sortOrder: s.sortOrder,
            active: true,
          })
          .returning({
            id: salas.id,
            slug: salas.slug,
            precioHora: salas.precioHora,
          });
        if (row?.id && row.slug && row.precioHora) {
          insertedSalas.push({
            id: row.id,
            slug: row.slug,
            precioHora: row.precioHora,
          });
        }
      }

      const salaRock = insertedSalas.find((s) => s.slug === "sala-a-rock");
      const salaAcustica = insertedSalas.find(
        (s) => s.slug === "sala-b-acustica",
      );
      const salaGrande = insertedSalas.find(
        (s) => s.slug === "sala-d-ensayo-grande",
      );

      // Promos de ejemplo (visibles en la ficha pública)
      if (salaRock) {
        const base = Number(salaRock.precioHora);
        await tx.insert(reglasPrecio).values({
          tenantId: tenant!.id,
          scope: "sala",
          scopeId: salaRock.id,
          tipo: "continuo",
          nombre: "Happy hour",
          daysOfWeek: [1, 2, 3, 4],
          startTime: "14:00",
          endTime: "18:00",
          precioPorHora: (base * 0.8).toFixed(2),
          descuentoPorcentaje: "20.00",
          active: true,
        });
      }
      if (salaAcustica) {
        const base = Number(salaAcustica.precioHora);
        await tx.insert(reglasPrecio).values({
          tenantId: tenant!.id,
          scope: "sala",
          scopeId: salaAcustica.id,
          tipo: "continuo",
          nombre: "2x1 mañanas",
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "10:00",
          endTime: "13:00",
          precioPorHora: (base * 0.7).toFixed(2),
          descuentoPorcentaje: "30.00",
          active: true,
        });
      }
      if (salaGrande) {
        const base = Number(salaGrande.precioHora);
        const desde = new Date();
        const hasta = new Date();
        hasta.setDate(hasta.getDate() + 21);
        const ymd = (d: Date) => d.toISOString().slice(0, 10);
        await tx.insert(reglasPrecio).values({
          tenantId: tenant!.id,
          scope: "sala",
          scopeId: salaGrande.id,
          tipo: "puntual",
          nombre: "Flash fin de semana",
          daysOfWeek: [5, 6],
          startTime: null,
          endTime: null,
          fechaDesde: ymd(desde),
          fechaHasta: ymd(hasta),
          precioPorHora: (base * 0.75).toFixed(2),
          descuentoPorcentaje: "25.00",
          active: true,
        });
      }

      await tx.insert(resenas).values([
        {
          tenantId: tenant!.id,
          sedeId: sede!.id,
          authorName: "Martín Gutiérrez",
          rating: 5,
          body: "Excelente sala, equipos impecables. (Reseña de ejemplo en el estudio de prueba.)",
          published: true,
        },
        {
          tenantId: tenant!.id,
          sedeId: sede!.id,
          authorName: "Lucía Fernández",
          rating: 5,
          body: "Reservamos para un demo y el sonido nos sorprendió. Así se verían tus reseñas.",
          published: true,
        },
        {
          tenantId: tenant!.id,
          sedeId: sede!.id,
          authorName: "Banda Ecos",
          rating: 4,
          body: "Muy buena sala. Esto es contenido de demostración para dueños.",
          published: true,
        },
      ]);

      await tx.insert(directorioEntradas).values({
        tenantId: tenant!.id,
        name: "Estudio de prueba",
        slug: SLUG,
        zona: "Palermo",
        address: "Honduras 5200, Palermo, CABA",
        description:
          "Estudio de demostración. No aparece en el directorio público (opt-out).",
        telefono: "11 5555-0000",
        photoUrl: PHOTO.a,
        lat: "-34.5875000",
        lng: "-58.4250000",
        precioDesde: "2800.00",
        cantidadSalas: SALAS_DEMO.length,
        ratingAvg: "4.8",
        ratingCount: 153,
        tagsDestacados: ["Grabación", "Backline", "Estudio de prueba"],
        equipamiento: ["Batería", "PA", "Piano", "Aire acondicionado"],
        plan: "cliente",
        optOut: true,
      });

      return tenant!;
    });

    console.log("OK estudio demo");
    console.log(`  URL:     /${result.slug}`);
    console.log(`  Nombre:  ${result.name}`);
    console.log(`  Salas:   ${SALAS_DEMO.length}`);
    console.log(`  Promos:  Happy hour · 2x1 mañanas · Flash fin de semana`);
    console.log(`  Horarios: lun–vie 10–23 · sáb 11–22 · dom cerrado`);
    console.log(`  Directorio: oculto (opt_out=true)`);
    console.log(`  Login demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error("SEED_ESTUDIO_DEMO_FAIL", e);
  process.exitCode = 1;
});

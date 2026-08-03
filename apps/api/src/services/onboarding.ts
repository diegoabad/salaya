import { getDb, politicas, sedes, tenants, userTenants } from "@repo/db";
import { seedHorariosDefaultSede } from "@repo/db/queries";
import { POLITICA_DEFAULTS, slugify } from "@repo/shared";
import { eq } from "drizzle-orm";
import { HttpError } from "../middlewares/errorHandler";
import { checkSlugAvailability, isSlugTaken } from "./auth";
import { subscriptionDefaultsNuevoTenant } from "./suscripcion";

/** Crea tenant + sede + políticas para un usuario ya autenticado (Google / onboarding). */
export async function onboardExistingUser(input: {
  userId: string;
  businessName: string;
  zona?: string;
  sedeName?: string;
}) {
  const db = getDb();

  const existing = await db.query.userTenants.findFirst({
    where: eq(userTenants.userId, input.userId),
  });
  if (existing) {
    throw new HttpError(409, "ALREADY_ONBOARDED", "Ya tenés un negocio asociado");
  }

  const slug = slugify(input.businessName);
  if (!slug) {
    throw new HttpError(400, "SLUG_INVALID", "No se pudo generar un slug válido");
  }
  if (await isSlugTaken(slug)) {
    const { suggestions } = await checkSlugAvailability(
      input.businessName,
      input.zona,
    );
    throw new HttpError(
      409,
      "SLUG_TAKEN",
      `Ese nombre/slug ya existe. Probá: ${suggestions.join(", ") || "otro nombre"}`,
    );
  }

  return db.transaction(async (tx) => {
    const sub = subscriptionDefaultsNuevoTenant();
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.businessName,
        slug,
        ...sub,
      })
      .returning();

    await tx.insert(userTenants).values({
      userId: input.userId,
      tenantId: tenant!.id,
      role: "owner",
    });

    const [sede] = await tx
      .insert(sedes)
      .values({
        tenantId: tenant!.id,
        name: input.sedeName ?? "Sede principal",
        zona: input.zona,
      })
      .returning();

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

    await seedHorariosDefaultSede(tx, tenant!.id, sede!.id);

    return {
      tenant: { id: tenant!.id, name: tenant!.name, slug: tenant!.slug },
      sede: { id: sede!.id, name: sede!.name },
    };
  });
}

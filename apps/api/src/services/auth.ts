import {
  getDb,
  politicas,
  sedes,
  tenants,
  userTenants,
  users,
} from "@repo/db";
import { seedHorariosDefaultSede } from "@repo/db/queries";
import { POLITICA_DEFAULTS, slugify, suggestSlugs } from "@repo/shared";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { HttpError } from "../middlewares/errorHandler";
import { createSession } from "./session";
import { subscriptionDefaultsNuevoTenant } from "./suscripcion";

export async function isSlugTaken(slug: string): Promise<boolean> {
  const db = getDb();
  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
    columns: { id: true },
  });
  return Boolean(existing);
}

export async function checkSlugAvailability(name: string, zona?: string) {
  const base = slugify(name);
  const taken = await isSlugTaken(base);
  if (!taken) {
    return { available: true as const, slug: base, suggestions: [] as string[] };
  }
  const suggestions: string[] = [];
  for (const candidate of suggestSlugs(name, zona)) {
    if (!(await isSlugTaken(candidate))) {
      suggestions.push(candidate);
    }
    if (suggestions.length >= 3) break;
  }
  return { available: false as const, slug: base, suggestions };
}

export async function registerOwner(input: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  slug?: string;
  sedeName?: string;
  zona?: string;
}) {
  const db = getDb();
  const email = input.email.toLowerCase();

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (existingUser) {
    throw new HttpError(409, "EMAIL_TAKEN", "Ese email ya está registrado");
  }

  const slug = slugify(input.slug ?? input.businessName);
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

  const passwordHash = await bcrypt.hash(input.password, 12);

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        name: input.name,
      })
      .returning();

    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.businessName,
        slug,
        ...subscriptionDefaultsNuevoTenant(),
      })
      .returning();

    await tx.insert(userTenants).values({
      userId: user!.id,
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

    return { user: user!, tenant: tenant!, sede: sede! };
  });

  const session = await createSession(result.user.id);

  return {
    session,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
    },
    sede: {
      id: result.sede.id,
      name: result.sede.name,
    },
  };
}

export async function loginUser(email: string, password: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  if (!user) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrectos");
  }
  if (!user.passwordHash) {
    throw new HttpError(
      401,
      "USE_GOOGLE",
      "Esta cuenta usa Google. Iniciá sesión con Google.",
    );
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrectos");
  }

  const memberships = await db.query.userTenants.findMany({
    where: (ut, { eq }) => eq(ut.userId, user.id),
    with: { tenant: true },
  });

  const session = await createSession(user.id);

  return {
    session,
    user: { id: user.id, email: user.email, name: user.name },
    tenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role,
    })),
  };
}

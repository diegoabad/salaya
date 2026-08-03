import { and, eq, gte } from "drizzle-orm";
import { getDb, directorioEntradas, directorioReclamaciones } from "@repo/db";
import type { ReclamarDirectorioInput } from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";

/** Evita spam: mismo email + misma entrada en las últimas 24h */
const DEDUPE_HOURS = 24;

export async function crearReclamacionDirectorio(input: ReclamarDirectorioInput) {
  const db = getDb();

  const [entrada] = await db
    .select({
      id: directorioEntradas.id,
      plan: directorioEntradas.plan,
      tenantId: directorioEntradas.tenantId,
      name: directorioEntradas.name,
      optOut: directorioEntradas.optOut,
    })
    .from(directorioEntradas)
    .where(eq(directorioEntradas.id, input.directorioEntradaId))
    .limit(1);

  if (!entrada || entrada.optOut) {
    throw new HttpError(404, "NOT_FOUND", "No encontramos esa sala en el directorio");
  }
  if (entrada.plan !== "seed" || entrada.tenantId) {
    throw new HttpError(
      409,
      "YA_RECLAMADA",
      "Esta sala ya tiene dueño en SalaYa. Si sos vos, iniciá sesión en el panel.",
    );
  }

  const email = input.email.trim().toLowerCase();
  const since = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000);
  const [dup] = await db
    .select({ id: directorioReclamaciones.id })
    .from(directorioReclamaciones)
    .where(
      and(
        eq(directorioReclamaciones.directorioEntradaId, input.directorioEntradaId),
        eq(directorioReclamaciones.email, email),
        gte(directorioReclamaciones.createdAt, since),
      ),
    )
    .limit(1);

  if (dup) {
    return { id: dup.id, duplicated: true as const, estudioName: entrada.name };
  }

  const [row] = await db
    .insert(directorioReclamaciones)
    .values({
      directorioEntradaId: input.directorioEntradaId,
      nombre: input.nombre.trim(),
      telefono: input.telefono.trim(),
      email,
      estado: "pendiente",
    })
    .returning({ id: directorioReclamaciones.id });

  if (!row) {
    throw new HttpError(500, "INSERT_FAILED", "No se pudo guardar el pedido");
  }

  return { id: row.id, duplicated: false as const, estudioName: entrada.name };
}

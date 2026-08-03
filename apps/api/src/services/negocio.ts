import {
  directorioEntradas,
  getDb,
  horariosAtencion,
  politicas,
  sedes,
  tenants,
} from "@repo/db";
import {
  getNegocioBundle,
  replaceHorariosAtencionSede,
  listHorariosEspecialesSede,
  upsertHorarioEspecialSede,
  deleteHorarioEspecialSede,
} from "@repo/db/queries";
import type {
  UpdateHorariosInput,
  UpdateNegocioInput,
  UpsertHorarioEspecialInput,
} from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { HttpError } from "../middlewares/errorHandler";

function serializeNegocio(
  bundle: NonNullable<Awaited<ReturnType<typeof getNegocioBundle>>>,
) {
  const { tenant, sede, politica, horarios, directorio, salasCount } = bundle;
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      instagramUrl: tenant.instagramUrl,
      websiteUrl: tenant.websiteUrl,
      whatsapp: tenant.whatsapp,
      youtubeUrl: tenant.youtubeUrl,
      tiktokUrl: tenant.tiktokUrl,
      linksExtra: tenant.linksExtra ?? [],
    },
    sede: {
      id: sede.id,
      name: sede.name,
      zona: sede.zona,
      address: sede.address,
      description: sede.description,
      photoUrl: sede.photoUrl,
      photos: (() => {
        const list = [...(sede.photos ?? [])];
        if (sede.photoUrl && !list.includes(sede.photoUrl)) {
          list.unshift(sede.photoUrl);
        }
        return list;
      })(),
      amenidades: sede.amenidades,
      lat: sede.lat != null ? Number(sede.lat) : null,
      lng: sede.lng != null ? Number(sede.lng) : null,
    },
    politica: politica
      ? {
          holdMinutos: politica.holdMinutos,
          cancelacionVentanaHoras: politica.cancelacionVentanaHoras,
          duracionMinMinutos: politica.duracionMinMinutos,
          duracionMaxMinutos: politica.duracionMaxMinutos,
          senaModo: politica.senaModo,
          senaTipo: politica.senaTipo,
          senaValor: politica.senaValor,
          senaDestinoCancelacion: politica.senaDestinoCancelacion,
          permiteReprogramar: politica.permiteReprogramar,
        }
      : null,
    horarios: horarios.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime,
      endTime: h.endTime,
    })),
    directorio: directorio
      ? {
          tagsDestacados: directorio.tagsDestacados,
          telefono: directorio.telefono,
          plan: directorio.plan,
        }
      : { tagsDestacados: [] as string[], telefono: null, plan: "cliente" as const },
    salasCount,
  };
}

export async function getNegocio(tenantId: string) {
  const bundle = await getNegocioBundle(getDb(), tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }
  return serializeNegocio(bundle);
}

export async function updateHorarios(
  tenantId: string,
  input: UpdateHorariosInput,
) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }

  const open = input.horarios
    .filter((h) => !h.closed && h.startTime && h.endTime)
    .map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime!,
      endTime: h.endTime!,
    }));

  if (open.length === 0) {
    throw new HttpError(
      400,
      "HORARIO_VACIO",
      "Tenés que dejar al menos un día abierto",
    );
  }

  const toMin = (t: string) => {
    const [hh, mm] = t.slice(0, 5).split(":").map(Number);
    return (hh ?? 0) * 60 + (mm ?? 0);
  };
  const byDay = new Map<number, typeof open>();
  for (const row of open) {
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push(row);
    byDay.set(row.dayOfWeek, list);
  }
  for (const [, list] of byDay) {
    if (list.length > 4) {
      throw new HttpError(
        400,
        "HORARIO_MAX",
        "Máximo 4 franjas por día",
      );
    }
    const sorted = [...list].sort(
      (a, b) => toMin(a.startTime) - toMin(b.startTime),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (toMin(cur.startTime) < toMin(prev.endTime)) {
        throw new HttpError(
          400,
          "HORARIO_SOLAPE",
          "Las franjas del mismo día no pueden solaparse",
        );
      }
    }
  }

  await replaceHorariosAtencionSede(db, tenantId, bundle.sede.id, open);
  return getNegocio(tenantId);
}

export async function listHorariosEspeciales(tenantId: string) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }
  const rows = await listHorariosEspecialesSede(db, tenantId, bundle.sede.id);
  return {
    especiales: rows
      .map((h) => ({
        fecha: h.fecha,
        closed: h.closed,
        startTime: h.startTime,
        endTime: h.endTime,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}

export async function upsertHorarioEspecial(
  tenantId: string,
  input: UpsertHorarioEspecialInput,
) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }
  await upsertHorarioEspecialSede(db, tenantId, bundle.sede.id, {
    fecha: input.fecha,
    closed: input.closed,
    startTime: input.startTime,
    endTime: input.endTime,
    nota: input.nota,
  });
  return listHorariosEspeciales(tenantId);
}

export async function deleteHorarioEspecial(tenantId: string, fecha: string) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }
  const ok = await deleteHorarioEspecialSede(
    db,
    tenantId,
    bundle.sede.id,
    fecha,
  );
  if (!ok) throw new HttpError(404, "NOT_FOUND", "Horario especial no encontrado");
  return listHorariosEspeciales(tenantId);
}

export async function updateNegocio(tenantId: string, input: UpdateNegocioInput) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  }

  const { sede, tenant, politica } = bundle;
  const tagsDestacados = input.tagsDestacados.filter((t) =>
    input.amenidades.includes(t),
  );

  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({
        name: input.tenantName,
        instagramUrl: input.instagramUrl || null,
        websiteUrl: input.websiteUrl || null,
        whatsapp: input.whatsapp || null,
        youtubeUrl: input.youtubeUrl || null,
        tiktokUrl: input.tiktokUrl || null,
        linksExtra: input.linksExtra ?? [],
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    const existingPhotos = (() => {
      const list = [...(sede.photos ?? [])];
      if (sede.photoUrl && !list.includes(sede.photoUrl)) {
        list.unshift(sede.photoUrl);
      }
      return list;
    })();
    const photos =
      input.photos !== undefined
        ? input.photos
        : input.photoUrl
          ? [
              input.photoUrl,
              ...existingPhotos.filter((p) => p !== input.photoUrl),
            ]
          : existingPhotos;
    const cover = photos[0] ?? input.photoUrl ?? null;

    await tx
      .update(sedes)
      .set({
        name: input.sedeName,
        zona: input.zona || null,
        address: input.address || null,
        description: input.description || null,
        photoUrl: cover,
        photos,
        amenidades: input.amenidades,
        ...(input.lat != null && input.lng != null
          ? {
              lat: String(input.lat),
              lng: String(input.lng),
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(sedes.id, sede.id), eq(sedes.tenantId, tenantId)));

    if (politica) {
      await tx
        .update(politicas)
        .set({
          ...(input.holdMinutos !== undefined
            ? { holdMinutos: input.holdMinutos }
            : {}),
          ...(input.cancelacionVentanaHoras !== undefined
            ? { cancelacionVentanaHoras: input.cancelacionVentanaHoras }
            : {}),
          ...(input.duracionMinMinutos !== undefined
            ? { duracionMinMinutos: input.duracionMinMinutos }
            : {}),
          ...(input.duracionMaxMinutos !== undefined
            ? { duracionMaxMinutos: input.duracionMaxMinutos }
            : {}),
          ...(input.senaModo !== undefined ? { senaModo: input.senaModo } : {}),
          ...(input.senaTipo !== undefined ? { senaTipo: input.senaTipo } : {}),
          ...(input.senaValor !== undefined ? { senaValor: input.senaValor } : {}),
          ...(input.senaDestinoCancelacion !== undefined
            ? { senaDestinoCancelacion: input.senaDestinoCancelacion }
            : {}),
          ...(input.permiteReprogramar !== undefined
            ? { permiteReprogramar: input.permiteReprogramar }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(politicas.id, politica.id));
    }

    const existingDir = await tx.query.directorioEntradas.findFirst({
      where: eq(directorioEntradas.tenantId, tenantId),
    });

    if (existingDir) {
      await tx
        .update(directorioEntradas)
        .set({
          name: input.tenantName,
          zona: input.zona || null,
          address: input.address || null,
          description: input.description || null,
          photoUrl: cover,
          telefono: input.telefono || null,
          tagsDestacados,
          ...(input.lat != null && input.lng != null
            ? {
                lat: String(input.lat),
                lng: String(input.lng),
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(directorioEntradas.id, existingDir.id));
    } else {
      await tx.insert(directorioEntradas).values({
        tenantId,
        name: input.tenantName,
        slug: tenant.slug,
        zona: input.zona || null,
        address: input.address || null,
        description: input.description || null,
        photoUrl: cover,
        telefono: input.telefono || null,
        tagsDestacados,
        plan: "cliente",
        ...(input.lat != null && input.lng != null
          ? {
              lat: String(input.lat),
              lng: String(input.lng),
            }
          : {}),
      });
    }

    // Si no hay horarios, crear lun–dom 10–23 por defecto
    const existingHours = await tx.query.horariosAtencion.findFirst({
      where: and(
        eq(horariosAtencion.tenantId, tenantId),
        eq(horariosAtencion.sedeId, sede.id),
      ),
    });
    if (!existingHours) {
      await tx.insert(horariosAtencion).values(
        [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
          tenantId,
          sedeId: sede.id,
          dayOfWeek,
          startTime: "10:00",
          endTime: "23:00",
        })),
      );
    }
  });

  // Refresh session tenant name if needed — caller can update session
  return getNegocio(tenantId);
}

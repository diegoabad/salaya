import { getDb } from "@repo/db";
import {
  deleteAdicionalRow,
  ensureAdicionalGrupo,
  getNegocioBundle,
  insertAdicional,
  listAdicionalGrupos,
  listAdicionalesConGrupo,
  updateAdicionalRow,
} from "@repo/db/queries";
import type {
  CreateAdicionalGrupoInput,
  CreateAdicionalInput,
  UpdateAdicionalInput,
} from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";

function mapRow(
  r: Awaited<ReturnType<typeof listAdicionalesConGrupo>>[number],
) {
  return {
    id: r.id,
    grupoId: r.grupoId,
    grupo: r.grupoName,
    name: r.name,
    precio: Number(r.precioBase),
    modalidad: r.modalidad,
    stock: r.stock,
    active: r.active,
    caracteristicas: r.caracteristicas ?? [],
    photoUrl: r.photoUrl ?? null,
  };
}

export async function listAdicionales(tenantId: string) {
  const rows = await listAdicionalesConGrupo(getDb(), tenantId);
  return rows.map(mapRow);
}

export async function listGrupos(tenantId: string) {
  const rows = await listAdicionalGrupos(getDb(), tenantId);
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sortOrder,
  }));
}

export async function createGrupo(
  tenantId: string,
  input: CreateAdicionalGrupoInput,
) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  const grupo = await ensureAdicionalGrupo(
    db,
    tenantId,
    bundle.sede.id,
    input.name.trim(),
  );
  return { id: grupo.id, name: grupo.name, sortOrder: grupo.sortOrder };
}

export async function createAdicional(
  tenantId: string,
  input: CreateAdicionalInput,
) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");

  let grupoId = input.grupoId;
  if (!grupoId) {
    const grupo = await ensureAdicionalGrupo(
      db,
      tenantId,
      bundle.sede.id,
      input.grupoName?.trim() || "General",
    );
    grupoId = grupo.id;
  }

  const row = await insertAdicional(db, tenantId, {
    grupoId,
    name: input.name,
    precioBase: input.precioBase,
    modalidad: input.modalidad,
    stock: input.stock,
    active: input.active,
    caracteristicas: input.caracteristicas ?? [],
    photoUrl: input.photoUrl ?? null,
  });

  return {
    id: row.id,
    grupoId: row.grupoId,
    name: row.name,
    precio: Number(row.precioBase),
    modalidad: row.modalidad,
    stock: row.stock,
    active: row.active,
    caracteristicas: row.caracteristicas ?? [],
    photoUrl: row.photoUrl ?? null,
  };
}

export async function updateAdicional(
  tenantId: string,
  id: string,
  input: UpdateAdicionalInput,
) {
  const db = getDb();
  let grupoId = input.grupoId;
  if (!grupoId && input.grupoName?.trim()) {
    const bundle = await getNegocioBundle(db, tenantId);
    if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
    const grupo = await ensureAdicionalGrupo(
      db,
      tenantId,
      bundle.sede.id,
      input.grupoName.trim(),
    );
    grupoId = grupo.id;
  }

  const row = await updateAdicionalRow(db, tenantId, id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.precioBase !== undefined ? { precioBase: input.precioBase } : {}),
    ...(input.modalidad !== undefined ? { modalidad: input.modalidad } : {}),
    ...(input.stock !== undefined ? { stock: input.stock } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(grupoId !== undefined ? { grupoId } : {}),
    ...(input.caracteristicas !== undefined
      ? { caracteristicas: input.caracteristicas }
      : {}),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
  });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Adicional no encontrado");
  return {
    id: row.id,
    name: row.name,
    precio: Number(row.precioBase),
    modalidad: row.modalidad,
    stock: row.stock,
    active: row.active,
    caracteristicas: row.caracteristicas ?? [],
    photoUrl: row.photoUrl ?? null,
  };
}

export async function deleteAdicional(tenantId: string, id: string) {
  const row = await deleteAdicionalRow(getDb(), tenantId, id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Adicional no encontrado");
}

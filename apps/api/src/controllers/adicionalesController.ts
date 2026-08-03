import type { Request, Response } from "express";
import {
  createAdicionalGrupoSchema,
  createAdicionalSchema,
  updateAdicionalSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  createAdicional,
  createGrupo,
  deleteAdicional,
  listAdicionales,
  listGrupos,
  updateAdicional,
} from "../services/adicionales";

export async function getAdicionalesHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const [adicionales, grupos] = await Promise.all([
    listAdicionales(tenantId),
    listGrupos(tenantId),
  ]);
  res.json({ adicionales, grupos });
}

export async function postAdicionalHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createAdicionalSchema.parse(req.body);
  const data = await createAdicional(tenantId, body);
  res.status(201).json(data);
}

export async function postGrupoHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createAdicionalGrupoSchema.parse(req.body);
  const data = await createGrupo(tenantId, body);
  res.status(201).json(data);
}

export async function patchAdicionalHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const id = String(req.params.id);
  const body = updateAdicionalSchema.parse(req.body);
  const data = await updateAdicional(tenantId, id, body);
  res.json(data);
}

export async function deleteAdicionalHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const id = String(req.params.id);
  await deleteAdicional(tenantId, id);
  res.status(204).end();
}

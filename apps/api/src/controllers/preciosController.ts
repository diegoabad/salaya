import type { Request, Response } from "express";
import {
  createReglaPrecioSchema,
  updateReglaPrecioSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  createRegla,
  deleteRegla,
  listPreciosBundle,
  updateRegla,
} from "../services/precios";

export async function getPreciosHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const data = await listPreciosBundle(tenantId);
  res.json(data);
}

export async function postReglaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createReglaPrecioSchema.parse(req.body);
  const data = await createRegla(tenantId, body);
  res.status(201).json(data);
}

export async function patchReglaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const id = String(req.params.id);
  const body = updateReglaPrecioSchema.parse(req.body);
  const data = await updateRegla(tenantId, id, body);
  res.json(data);
}

export async function deleteReglaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const id = String(req.params.id);
  await deleteRegla(tenantId, id);
  res.status(204).end();
}

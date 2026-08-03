import type { Request, Response } from "express";
import { createBloqueoSchema } from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  createBloqueo,
  deleteBloqueo,
  listBloqueos,
} from "../services/bloqueos";

export async function getBloqueosHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const data = await listBloqueos(tenantId);
  res.json({ bloqueos: data });
}

export async function postBloqueoHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createBloqueoSchema.parse(req.body);
  const data = await createBloqueo(tenantId, body);
  res.status(201).json(data);
}

export async function deleteBloqueoHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const id = String(req.params.id);
  await deleteBloqueo(tenantId, id);
  res.status(204).end();
}

import type { Request, Response } from "express";
import {
  createSalaSchema,
  toggleSalaSchema,
  updateSalaSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  createSala,
  listSalas,
  softDeleteSala,
  toggleSala,
  updateSala,
} from "../services/salas";

export async function getSalasHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const data = await listSalas(tenantId);
  res.json(data);
}

export async function postSalaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createSalaSchema.parse(req.body);
  const data = await createSala(tenantId, body);
  res.status(201).json(data);
}

export async function patchSalaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const salaId = String(req.params.salaId);
  const body = updateSalaSchema.parse(req.body);
  const data = await updateSala(tenantId, salaId, body);
  res.json(data);
}

export async function patchSalaToggleHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const salaId = String(req.params.salaId);
  const body = toggleSalaSchema.parse(req.body);
  const data = await toggleSala(tenantId, salaId, body.active);
  res.json(data);
}

export async function deleteSalaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const salaId = String(req.params.salaId);
  await softDeleteSala(tenantId, salaId);
  res.status(204).send();
}

import type { Request, Response } from "express";
import {
  updateHorariosSchema,
  updateNegocioSchema,
  upsertHorarioEspecialSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  deleteHorarioEspecial,
  getNegocio,
  listHorariosEspeciales,
  updateHorarios,
  updateNegocio,
  upsertHorarioEspecial,
} from "../services/negocio";

export async function getNegocioHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const data = await getNegocio(tenantId);
  res.json(data);
}

export async function patchNegocioHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = updateNegocioSchema.parse(req.body);
  const data = await updateNegocio(tenantId, body);
  res.json(data);
}

export async function putHorariosHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = updateHorariosSchema.parse(req.body);
  const data = await updateHorarios(tenantId, body);
  res.json(data);
}

export async function getHorariosEspecialesHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const data = await listHorariosEspeciales(tenantId);
  res.json(data);
}

export async function putHorarioEspecialHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = upsertHorarioEspecialSchema.parse(req.body);
  const data = await upsertHorarioEspecial(tenantId, body);
  res.json(data);
}

export async function deleteHorarioEspecialHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const fecha = String(req.params.fecha ?? "");
  const data = await deleteHorarioEspecial(tenantId, fecha);
  res.json(data);
}

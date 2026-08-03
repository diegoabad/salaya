import type { Request, Response } from "express";
import { createMovimientoSchema } from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  createMovimientoCaja,
  listCajaDia,
} from "../services/caja";
import { todayArDate } from "../services/arTime";

export async function getCajaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const fecha =
    typeof req.query.fecha === "string" && req.query.fecha
      ? req.query.fecha
      : todayArDate();
  const data = await listCajaDia(tenantId, fecha);
  res.json(data);
}

export async function postCajaHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createMovimientoSchema.parse(req.body);
  const data = await createMovimientoCaja(tenantId, body);
  res.status(201).json(data);
}

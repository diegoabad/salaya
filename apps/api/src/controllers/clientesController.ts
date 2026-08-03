import type { Request, Response } from "express";
import {
  cargarCreditoClienteSchema,
  createClienteSchema,
  updateClienteSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  cargarCreditoCliente,
  createCliente,
  getClienteDetalle,
  listClientes,
  updateCliente,
} from "../services/clientes";

export async function getClientesHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const data = await listClientes(tenantId);
  res.json({ clientes: data });
}

export async function getClienteDetalleHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const clienteId = String(req.params.clienteId);
  const data = await getClienteDetalle(tenantId, clienteId);
  res.json(data);
}

export async function postClienteHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createClienteSchema.parse(req.body);
  const data = await createCliente(tenantId, body);
  res.status(201).json(data);
}

export async function patchClienteHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const clienteId = String(req.params.clienteId);
  const body = updateClienteSchema.parse(req.body);
  const data = await updateCliente(tenantId, clienteId, body);
  res.json(data);
}

export async function postClienteCreditoHandler(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const clienteId = String(req.params.clienteId);
  const body = cargarCreditoClienteSchema.parse(req.body);
  const data = await cargarCreditoCliente(tenantId, clienteId, body);
  res.status(201).json(data);
}

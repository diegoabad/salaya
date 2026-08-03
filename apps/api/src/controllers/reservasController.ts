import type { Request, Response } from "express";
import {
  asistenciaSchema,
  cancelarReservaSchema,
  cobrarSaldoSchema,
  reprogramarReservaSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  createReservaPanel,
  createReservaPanelSchema,
  listAgendaDia,
  todayArDate,
  updateReservaAdicionalesPanel,
  updateReservaAdicionalesSchema,
} from "../services/reservas";
import {
  cancelarReservaPanel,
  cerrarAsistencia,
  cobrarSaldoReserva,
  reprogramarReservaPanel,
} from "../services/reserva-ops";

export async function getAgendaHoy(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const fecha =
    typeof req.query.fecha === "string" && req.query.fecha
      ? req.query.fecha
      : todayArDate();
  const data = await listAgendaDia(tenantId, fecha);
  res.json(data);
}

export async function postReservaPanel(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const body = createReservaPanelSchema.parse(req.body);
  const row = await createReservaPanel(tenantId, body);
  res.status(201).json({
    id: row.id,
    estado: row.estado,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  });
}

export async function postAsistencia(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const reservaId = String(req.params.reservaId);
  const body = asistenciaSchema.parse(req.body);
  const data = await cerrarAsistencia(tenantId, reservaId, body);
  res.json(data);
}

export async function postCobrarSaldo(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const reservaId = String(req.params.reservaId);
  const body = cobrarSaldoSchema.parse(req.body);
  const data = await cobrarSaldoReserva(tenantId, reservaId, body);
  res.status(201).json(data);
}

export async function postCancelarReserva(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const reservaId = String(req.params.reservaId);
  const body = cancelarReservaSchema.parse(req.body ?? {});
  const data = await cancelarReservaPanel(tenantId, reservaId, body);
  res.json(data);
}

export async function postReprogramarReserva(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const reservaId = String(req.params.reservaId);
  const body = reprogramarReservaSchema.parse(req.body);
  const data = await reprogramarReservaPanel(tenantId, reservaId, body);
  res.json(data);
}

export async function postReservaAdicionales(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const reservaId = String(req.params.reservaId);
  const body = updateReservaAdicionalesSchema.parse(req.body);
  const data = await updateReservaAdicionalesPanel(tenantId, reservaId, body);
  res.json(data);
}

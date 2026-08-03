import { Router } from "express";
import {
  getAgendaHoy,
  postAsistencia,
  postCancelarReserva,
  postCobrarSaldo,
  postReprogramarReserva,
  postReservaAdicionales,
  postReservaPanel,
} from "../controllers/reservasController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const reservasRouter = Router();

reservasRouter.get("/hoy", requireInternalTenant, getAgendaHoy);
reservasRouter.post(
  "/",
  requireInternalTenant,
  requireOwnerRole,
  postReservaPanel,
);
reservasRouter.post(
  "/:reservaId/asistencia",
  requireInternalTenant,
  postAsistencia,
);
reservasRouter.post(
  "/:reservaId/cobrar",
  requireInternalTenant,
  postCobrarSaldo,
);
reservasRouter.post(
  "/:reservaId/cancelar",
  requireInternalTenant,
  requireOwnerRole,
  postCancelarReserva,
);
reservasRouter.post(
  "/:reservaId/reprogramar",
  requireInternalTenant,
  requireOwnerRole,
  postReprogramarReserva,
);
reservasRouter.post(
  "/:reservaId/adicionales",
  requireInternalTenant,
  requireOwnerRole,
  postReservaAdicionales,
);

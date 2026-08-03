import { Router } from "express";
import {
  deleteHorarioEspecialHandler,
  getHorariosEspecialesHandler,
  getNegocioHandler,
  patchNegocioHandler,
  putHorarioEspecialHandler,
  putHorariosHandler,
} from "../controllers/negocioController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const negocioRouter = Router();

negocioRouter.get("/", requireInternalTenant, getNegocioHandler);
negocioRouter.patch(
  "/",
  requireInternalTenant,
  requireOwnerRole,
  patchNegocioHandler,
);
negocioRouter.put(
  "/horarios",
  requireInternalTenant,
  requireOwnerRole,
  putHorariosHandler,
);
negocioRouter.get(
  "/horarios-especiales",
  requireInternalTenant,
  getHorariosEspecialesHandler,
);
negocioRouter.put(
  "/horarios-especiales",
  requireInternalTenant,
  requireOwnerRole,
  putHorarioEspecialHandler,
);
negocioRouter.delete(
  "/horarios-especiales/:fecha",
  requireInternalTenant,
  requireOwnerRole,
  deleteHorarioEspecialHandler,
);

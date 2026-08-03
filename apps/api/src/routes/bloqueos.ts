import { Router } from "express";
import {
  deleteBloqueoHandler,
  getBloqueosHandler,
  postBloqueoHandler,
} from "../controllers/bloqueosController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const bloqueosRouter = Router();

bloqueosRouter.get("/", requireInternalTenant, getBloqueosHandler);
bloqueosRouter.post(
  "/",
  requireInternalTenant,
  requireOwnerRole,
  postBloqueoHandler,
);
bloqueosRouter.delete(
  "/:id",
  requireInternalTenant,
  requireOwnerRole,
  deleteBloqueoHandler,
);

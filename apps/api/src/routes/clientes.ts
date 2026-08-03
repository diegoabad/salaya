import { Router } from "express";
import {
  getClientesHandler,
  patchClienteHandler,
  postClienteCreditoHandler,
  postClienteHandler,
} from "../controllers/clientesController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const clientesRouter = Router();

clientesRouter.get("/", requireInternalTenant, getClientesHandler);
clientesRouter.post(
  "/",
  requireInternalTenant,
  requireOwnerRole,
  postClienteHandler,
);
clientesRouter.patch(
  "/:clienteId",
  requireInternalTenant,
  requireOwnerRole,
  patchClienteHandler,
);
clientesRouter.post(
  "/:clienteId/credito",
  requireInternalTenant,
  requireOwnerRole,
  postClienteCreditoHandler,
);

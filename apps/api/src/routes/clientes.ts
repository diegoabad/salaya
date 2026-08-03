import { Router } from "express";
import {
  getClienteDetalleHandler,
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
clientesRouter.get(
  "/:clienteId",
  requireInternalTenant,
  getClienteDetalleHandler,
);
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

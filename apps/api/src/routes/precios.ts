import { Router } from "express";
import {
  deleteReglaHandler,
  getPreciosHandler,
  patchReglaHandler,
  postReglaHandler,
} from "../controllers/preciosController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const preciosRouter = Router();

preciosRouter.get("/", requireInternalTenant, getPreciosHandler);
preciosRouter.post(
  "/reglas",
  requireInternalTenant,
  requireOwnerRole,
  postReglaHandler,
);
preciosRouter.patch(
  "/reglas/:id",
  requireInternalTenant,
  requireOwnerRole,
  patchReglaHandler,
);
preciosRouter.delete(
  "/reglas/:id",
  requireInternalTenant,
  requireOwnerRole,
  deleteReglaHandler,
);

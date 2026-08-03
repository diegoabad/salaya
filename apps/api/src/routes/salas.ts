import { Router } from "express";
import {
  deleteSalaHandler,
  getSalasHandler,
  patchSalaHandler,
  patchSalaToggleHandler,
  postSalaHandler,
} from "../controllers/salasController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const salasRouter = Router();

salasRouter.get("/", requireInternalTenant, getSalasHandler);
salasRouter.post("/", requireInternalTenant, requireOwnerRole, postSalaHandler);
salasRouter.patch(
  "/:salaId",
  requireInternalTenant,
  requireOwnerRole,
  patchSalaHandler,
);
salasRouter.patch(
  "/:salaId/active",
  requireInternalTenant,
  requireOwnerRole,
  patchSalaToggleHandler,
);
salasRouter.delete(
  "/:salaId",
  requireInternalTenant,
  requireOwnerRole,
  deleteSalaHandler,
);

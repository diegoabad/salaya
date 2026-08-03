import { Router } from "express";
import {
  deleteAdicionalHandler,
  getAdicionalesHandler,
  patchAdicionalHandler,
  postAdicionalHandler,
  postGrupoHandler,
} from "../controllers/adicionalesController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const adicionalesRouter = Router();

adicionalesRouter.get("/", requireInternalTenant, getAdicionalesHandler);
adicionalesRouter.post(
  "/grupos",
  requireInternalTenant,
  requireOwnerRole,
  postGrupoHandler,
);
adicionalesRouter.post(
  "/",
  requireInternalTenant,
  requireOwnerRole,
  postAdicionalHandler,
);
adicionalesRouter.patch(
  "/:id",
  requireInternalTenant,
  requireOwnerRole,
  patchAdicionalHandler,
);
adicionalesRouter.delete(
  "/:id",
  requireInternalTenant,
  requireOwnerRole,
  deleteAdicionalHandler,
);

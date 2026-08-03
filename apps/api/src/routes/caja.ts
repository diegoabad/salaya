import { Router } from "express";
import {
  getCajaHandler,
  postCajaHandler,
} from "../controllers/cajaController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const cajaRouter = Router();

cajaRouter.get("/", requireInternalTenant, getCajaHandler);
cajaRouter.post(
  "/",
  requireInternalTenant,
  requireOwnerRole,
  postCajaHandler,
);

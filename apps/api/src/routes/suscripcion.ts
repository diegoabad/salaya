import { Router } from "express";
import {
  activarPlanGratis,
  checkoutSuscripcion,
  checkoutSuscripcionSchema,
  forceTrialExpired,
  getSuscripcionOverview,
} from "../services/suscripcion";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const suscripcionRouter = Router();

suscripcionRouter.get("/", requireInternalTenant, async (req, res, next) => {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    res.json(await getSuscripcionOverview(tenantId));
  } catch (err) {
    next(err);
  }
});

suscripcionRouter.post(
  "/checkout",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = checkoutSuscripcionSchema.parse(req.body);
      const data = await checkoutSuscripcion(tenantId, body);
      res.status(data.free ? 200 : 201).json(data);
    } catch (err) {
      next(err);
    }
  },
);

suscripcionRouter.post(
  "/activar-gratis",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = checkoutSuscripcionSchema.parse(req.body);
      res.json(await activarPlanGratis(tenantId, body.planCode));
    } catch (err) {
      next(err);
    }
  },
);

/** Dev/mock: vence el trial para probar el gate */
suscripcionRouter.post(
  "/dev/expire-trial",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      res.json(await forceTrialExpired(tenantId));
    } catch (err) {
      next(err);
    }
  },
);

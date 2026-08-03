import { Router } from "express";
import {
  asignarMembresiaSchema,
  createMembresiaPlanSchema,
  renovarMembresiaSchema,
  updateMembresiaEstadoSchema,
  updateMembresiaPlanSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";
import {
  asignarMembresia,
  createPlan,
  listMembresiasBundle,
  renovarMembresia,
  setMembresiaEstado,
  updatePlan,
} from "../services/membresias";

export const membresiasRouter = Router();

membresiasRouter.get("/", requireInternalTenant, async (req, res, next) => {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    res.json(await listMembresiasBundle(tenantId));
  } catch (err) {
    next(err);
  }
});

membresiasRouter.post(
  "/planes",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = createMembresiaPlanSchema.parse(req.body);
      res.status(201).json(await createPlan(tenantId, body));
    } catch (err) {
      next(err);
    }
  },
);

membresiasRouter.patch(
  "/planes/:planId",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = updateMembresiaPlanSchema.parse(req.body);
      res.json(await updatePlan(tenantId, String(req.params.planId), body));
    } catch (err) {
      next(err);
    }
  },
);

membresiasRouter.post(
  "/asignar",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = asignarMembresiaSchema.parse(req.body);
      res.status(201).json(await asignarMembresia(tenantId, body));
    } catch (err) {
      next(err);
    }
  },
);

membresiasRouter.post(
  "/:membresiaId/renovar",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = renovarMembresiaSchema.parse(req.body);
      res.json(
        await renovarMembresia(
          tenantId,
          String(req.params.membresiaId),
          body,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

membresiasRouter.patch(
  "/:membresiaId/estado",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = updateMembresiaEstadoSchema.parse(req.body);
      res.json(
        await setMembresiaEstado(
          tenantId,
          String(req.params.membresiaId),
          body.estado,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

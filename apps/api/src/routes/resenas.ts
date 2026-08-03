import { Router } from "express";
import {
  createResenaSchema,
  invitarResenaSchema,
  toggleResenaSchema,
} from "@repo/shared";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";
import {
  createResena,
  invitarResena,
  listResenas,
  toggleResena,
} from "../services/resenas";

export const resenasRouter = Router();

resenasRouter.get("/", requireInternalTenant, async (req, res, next) => {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    res.json(await listResenas(tenantId));
  } catch (err) {
    next(err);
  }
});

resenasRouter.post(
  "/invitar",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = invitarResenaSchema.parse(req.body);
      res.status(201).json(await invitarResena(tenantId, body));
    } catch (err) {
      next(err);
    }
  },
);

resenasRouter.post(
  "/",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = createResenaSchema.parse(req.body);
      res.status(201).json(await createResena(tenantId, body));
    } catch (err) {
      next(err);
    }
  },
);

resenasRouter.patch(
  "/:id/published",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = toggleResenaSchema.parse(req.body);
      res.json(
        await toggleResena(tenantId, String(req.params.id), body.published),
      );
    } catch (err) {
      next(err);
    }
  },
);

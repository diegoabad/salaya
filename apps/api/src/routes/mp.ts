import { Router } from "express";
import {
  connectMp,
  connectMpSchema,
  disconnectMp,
  getMpStatus,
  handleMpOAuthCallback,
  startMpOAuthLink,
} from "../services/mp";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const mpRouter = Router();

mpRouter.get("/status", requireInternalTenant, async (req, res, next) => {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    res.json(await getMpStatus(tenantId));
  } catch (err) {
    next(err);
  }
});

mpRouter.post(
  "/oauth/link",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId, userId } = req as TenantAuthedRequest;
      const returnTo =
        typeof req.body?.returnTo === "string" ? req.body.returnTo : undefined;
      res.json(await startMpOAuthLink(tenantId, userId, returnTo));
    } catch (err) {
      next(err);
    }
  },
);

/** Callback público de MP (browser redirect) */
mpRouter.get("/oauth/callback", async (req, res, next) => {
  try {
    const { redirectUrl } = await handleMpOAuthCallback({
      code: typeof req.query.code === "string" ? req.query.code : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      error: typeof req.query.error === "string" ? req.query.error : undefined,
    });
    res.redirect(302, redirectUrl);
  } catch (err) {
    next(err);
  }
});

mpRouter.post(
  "/connect",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      const body = connectMpSchema.parse(req.body);
      res.json(await connectMp(tenantId, body));
    } catch (err) {
      next(err);
    }
  },
);

mpRouter.delete(
  "/connect",
  requireInternalTenant,
  requireOwnerRole,
  async (req, res, next) => {
    try {
      const { tenantId } = req as TenantAuthedRequest;
      res.json(await disconnectMp(tenantId));
    } catch (err) {
      next(err);
    }
  },
);

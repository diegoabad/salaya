import type { NextFunction, Request, Response } from "express";
import { getDb } from "@repo/db";
import {
  getMembership,
  getTenantSubscription,
} from "@repo/db/queries";
import {
  canAccessPanel,
  mensajeBloqueoSuscripcion,
  subscriptionStatusEfectivo,
  type SubscriptionStatus,
  type UserTenantRole,
} from "@repo/shared";
import { getEnv } from "../config/env";
import { HttpError } from "./errorHandler";

export type TenantAuthedRequest = Request & {
  userId: string;
  tenantId: string;
  role: UserTenantRole;
};

/** Rutas de suscripción siempre accesibles (ver plan / pagar). */
function isSuscripcionRoute(req: Request): boolean {
  const path = (req.originalUrl ?? req.url).split("?")[0] ?? "";
  return path === "/suscripcion" || path.startsWith("/suscripcion/");
}

/**
 * Next (Auth.js) → API: secret + userId + tenantId.
 * Valida membresía; el tenant nunca se toma del body de negocio.
 * Si la suscripción está vencida/cancelada, bloquea todo salvo /suscripcion.
 */
export function requireInternalTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  void (async () => {
    try {
      const env = getEnv();
      const secret = req.header("x-internal-secret");
      const userId = req.header("x-user-id");
      const tenantId = req.header("x-tenant-id");

      if (!secret || secret !== env.INTERNAL_API_SECRET) {
        throw new HttpError(401, "UNAUTHENTICATED", "Secret interno inválido");
      }
      if (!userId || !tenantId) {
        throw new HttpError(401, "UNAUTHENTICATED", "Falta usuario o tenant");
      }

      const membership = await getMembership(getDb(), userId, tenantId);
      if (!membership) {
        throw new HttpError(403, "FORBIDDEN", "No pertenecés a este estudio");
      }

      const authed = req as TenantAuthedRequest;
      authed.userId = userId;
      authed.tenantId = tenantId;
      authed.role = membership.role;

      if (!isSuscripcionRoute(req)) {
        const row = await getTenantSubscription(getDb(), tenantId);
        if (row) {
          const status = subscriptionStatusEfectivo({
            subscriptionStatus: row.subscriptionStatus as SubscriptionStatus,
            trialEndsAt: row.trialEndsAt,
            subscriptionPeriodEnd: row.subscriptionPeriodEnd,
          });
          if (!canAccessPanel(status)) {
            throw new HttpError(
              402,
              "SUBSCRIPTION_REQUIRED",
              mensajeBloqueoSuscripcion(status),
              { status, redirectTo: "/panel/plan" },
            );
          }
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  })();
}

export function requireOwnerRole(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const role = (req as TenantAuthedRequest).role;
    if (role !== "owner") {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Solo el dueño puede hacer esta acción",
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

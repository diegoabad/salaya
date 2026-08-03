import type { NextFunction, Request, Response } from "express";
import { getEnv } from "../config/env";
import { HttpError } from "./errorHandler";

export type InternalAuthedRequest = Request & { userId: string };

/**
 * Auth entre Next (Server Actions) y la API.
 * Next envía x-internal-secret + x-user-id (userId ya validado por Auth.js).
 */
export function requireInternalUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const env = getEnv();
    const secret = req.header("x-internal-secret");
    const userId = req.header("x-user-id");

    if (!secret || secret !== env.INTERNAL_API_SECRET) {
      throw new HttpError(401, "UNAUTHENTICATED", "Secret interno inválido");
    }
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "Falta usuario");
    }

    (req as InternalAuthedRequest).userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

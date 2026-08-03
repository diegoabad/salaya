import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler";
import { getSessionUserId } from "../services/session";

export type AuthedRequest = Request & {
  userId: string;
  sessionId: string;
};

const COOKIE_NAME = "session";

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!sessionId) {
      throw new HttpError(401, "UNAUTHENTICATED", "Tenés que iniciar sesión");
    }
    const userId = await getSessionUserId(sessionId);
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "Sesión inválida o expirada");
    }
    (req as AuthedRequest).userId = userId;
    (req as AuthedRequest).sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

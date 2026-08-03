import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  slugCheckSchema,
} from "@repo/shared";
import { z } from "zod";
import { getEnv } from "../config/env";
import { getSessionCookieName } from "../middlewares/auth";
import type { InternalAuthedRequest } from "../middlewares/internalAuth";
import {
  checkSlugAvailability,
  loginUser,
  registerOwner,
} from "../services/auth";
import { onboardExistingUser } from "../services/onboarding";
import { deleteSession } from "../services/session";

function setSessionCookie(res: Response, sessionId: string, expiresAt: Date) {
  const env = getEnv();
  res.cookie(getSessionCookieName(), sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    expires: expiresAt,
    path: "/",
  });
}

export async function postRegister(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);
  const result = await registerOwner(data);
  setSessionCookie(res, result.session.id, result.session.expiresAt);
  res.status(201).json({
    user: result.user,
    tenant: result.tenant,
    sede: result.sede,
  });
}

export async function postLogin(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);
  const result = await loginUser(data.email, data.password);
  setSessionCookie(res, result.session.id, result.session.expiresAt);
  res.json({
    user: result.user,
    tenants: result.tenants,
  });
}

export async function postLogout(req: Request, res: Response) {
  const sessionId = req.cookies?.[getSessionCookieName()] as string | undefined;
  if (sessionId) {
    await deleteSession(sessionId);
  }
  res.clearCookie(getSessionCookieName(), { path: "/" });
  res.status(204).send();
}

export async function getSlugCheck(req: Request, res: Response) {
  const data = slugCheckSchema.parse({
    name: req.query.name,
    zona: req.query.zona,
  });
  const result = await checkSlugAvailability(data.name, data.zona);
  res.json(result);
}

const onboardingBody = z.object({
  businessName: z.string().trim().min(2).max(120),
  zona: z.string().trim().max(120).optional(),
  sedeName: z.string().trim().min(2).max(120).optional(),
});

export async function postOnboarding(req: Request, res: Response) {
  const userId = (req as InternalAuthedRequest).userId;
  const data = onboardingBody.parse(req.body);
  const result = await onboardExistingUser({ userId, ...data });
  res.status(201).json(result);
}

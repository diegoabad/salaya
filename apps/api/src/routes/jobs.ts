import { Router } from "express";
import { getEnv } from "../config/env";
import { HttpError } from "../middlewares/errorHandler";
import {
  clearMockSentEmails,
  getMockSentEmails,
} from "../services/email";
import { tickNotifications } from "../services/notifications";

export const jobsRouter = Router();

function requireInternalSecret(
  req: { header: (n: string) => string | undefined },
) {
  const env = getEnv();
  const secret = req.header("x-internal-secret");
  if (!secret || secret !== env.INTERNAL_API_SECRET) {
    throw new HttpError(401, "UNAUTHENTICATED", "Secret interno inválido");
  }
}

/** Procesa recordatorios + pending del outbox (email). Llamar desde cron o smoke. */
jobsRouter.post("/notifications/tick", async (req, res, next) => {
  try {
    requireInternalSecret(req);
    const limit =
      typeof req.body?.limit === "number" && req.body.limit > 0
        ? Math.min(100, req.body.limit)
        : 20;
    const hoursAhead =
      typeof req.body?.hoursAhead === "number" && req.body.hoursAhead > 0
        ? Math.min(168, req.body.hoursAhead)
        : 24;
    const data = await tickNotifications({ limit, hoursAhead });
    res.json({
      ...data.outbox,
      reminders: data.reminders,
      outbox: data.outbox,
    });
  } catch (err) {
    next(err);
  }
});

/** Debug mock: últimos emails “enviados” en EMAIL_MOCK */
jobsRouter.get("/notifications/mock-sent", async (req, res, next) => {
  try {
    requireInternalSecret(req);
    if (!getEnv().emailMock) {
      res.status(404).json({ error: { message: "Solo en EMAIL_MOCK" } });
      return;
    }
    res.json({ emails: getMockSentEmails() });
  } catch (err) {
    next(err);
  }
});

jobsRouter.post("/notifications/mock-clear", async (req, res, next) => {
  try {
    requireInternalSecret(req);
    clearMockSentEmails();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

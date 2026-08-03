import { Router } from "express";
import { z } from "zod";
import { trackEvent } from "../services/analytics";

const uuid = z.string().uuid().optional().nullable();

const bodySchema = z.object({
  eventType: z.enum([
    "guia.contacto_abrir",
    "guia.contacto_llamar",
    "reserva.hold_creado",
    "reserva.confirmada",
    "reserva.senada",
  ]),
  directorioEntradaId: uuid,
  tenantId: uuid,
  salaId: uuid,
  reservaId: uuid,
  sessionId: z.string().max(120).optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const publicAnalyticsRouter = Router();

publicAnalyticsRouter.post("/", async (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    await trackEvent(body);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

import { Router, type Request } from "express";
import { z } from "zod";
import { HttpError } from "../middlewares/errorHandler";
import {
  confirmHold,
  confirmHoldSchema,
  listAdicionalesPublicos,
  listHolds,
  listOcupacion,
  politicaPublicaSala,
  releaseHoldBySession,
  upsertHold,
} from "../services/holds";
import { checkoutHoldSchema, createCheckoutFromHold } from "../services/mp";

const upsertSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horas: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  adicionales: z
    .array(
      z.object({
        id: z.string().uuid(),
        cantidad: z.number().int().min(1).max(99),
      }),
    )
    .optional(),
});

type SalaParams = { salaId: string };

function sessionIdFromReq(req: {
  header: (name: string) => string | undefined;
}): string {
  const sid = req.header("x-hold-session")?.trim();
  if (!sid || sid.length < 8) {
    throw new HttpError(
      400,
      "SESSION_REQUIRED",
      "Falta cabecera X-Hold-Session",
    );
  }
  return sid;
}

function salaIdOf(req: Request) {
  return String((req.params as SalaParams).salaId ?? "");
}

export const holdsRouter = Router({ mergeParams: true });

holdsRouter.get("/", async (req, res, next) => {
  try {
    const salaId = salaIdOf(req);
    const fecha =
      typeof req.query.fecha === "string" ? req.query.fecha : undefined;
    const [holds, politica] = await Promise.all([
      listHolds(salaId, fecha),
      politicaPublicaSala(salaId),
    ]);
    res.json({ ...politica, holds });
  } catch (err) {
    next(err);
  }
});

holdsRouter.get("/ocupacion", async (req, res, next) => {
  try {
    const salaId = salaIdOf(req);
    const fecha = typeof req.query.fecha === "string" ? req.query.fecha : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new HttpError(400, "FECHA_REQUIRED", "Query fecha=YYYY-MM-DD requerida");
    }
    const data = await listOcupacion(salaId, fecha);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

holdsRouter.get("/adicionales", async (req, res, next) => {
  try {
    const data = await listAdicionalesPublicos(salaIdOf(req));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

holdsRouter.put("/", async (req, res, next) => {
  try {
    const salaId = salaIdOf(req);
    const sessionId = sessionIdFromReq(req);
    const body = upsertSchema.parse(req.body);
    const hold = await upsertHold({
      salaId,
      sessionId,
      fecha: body.fecha,
      horas: body.horas,
      adicionales: body.adicionales,
    });
    res.json({ hold });
  } catch (err) {
    next(err);
  }
});

holdsRouter.delete("/", async (req, res, next) => {
  try {
    const salaId = salaIdOf(req);
    const sessionId = sessionIdFromReq(req);
    const hold = await releaseHoldBySession(salaId, sessionId);
    res.json({ ok: true, hold });
  } catch (err) {
    next(err);
  }
});

holdsRouter.post("/confirm", async (req, res, next) => {
  try {
    const salaId = salaIdOf(req);
    const sessionId = sessionIdFromReq(req);
    const body = confirmHoldSchema.parse(req.body);
    const data = await confirmHold(salaId, sessionId, body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

holdsRouter.post("/checkout", async (req, res, next) => {
  try {
    const salaId = salaIdOf(req);
    const sessionId = sessionIdFromReq(req);
    const body = checkoutHoldSchema.parse(req.body);
    const data = await createCheckoutFromHold(salaId, sessionId, body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

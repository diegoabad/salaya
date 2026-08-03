import { Router } from "express";
import { reprogramarReservaSchema } from "@repo/shared";
import { z } from "zod";
import {
  confirmarCancelacionPublica,
  confirmarReprogramacionPublica,
  previewCancelacionPublica,
  previewReprogramacionPublica,
} from "../services/reserva-ops";

export const publicCancelRouter = Router();

publicCancelRouter.get("/cancel", async (req, res, next) => {
  try {
    const t = String(req.query.t ?? "");
    if (!t) {
      res.status(400).json({
        error: { code: "TOKEN_REQUIRED", message: "Falta el token" },
      });
      return;
    }
    const data = await previewCancelacionPublica(t);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

publicCancelRouter.post("/cancel", async (req, res, next) => {
  try {
    const body = z
      .object({
        t: z.string().min(10),
        confirm: z.literal(true),
      })
      .parse(req.body);
    const data = await confirmarCancelacionPublica(body.t);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

publicCancelRouter.get("/reprogramar", async (req, res, next) => {
  try {
    const t = String(req.query.t ?? "");
    if (!t) {
      res.status(400).json({
        error: { code: "TOKEN_REQUIRED", message: "Falta el token" },
      });
      return;
    }
    const data = await previewReprogramacionPublica(t);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

publicCancelRouter.post("/reprogramar", async (req, res, next) => {
  try {
    const body = z
      .object({
        t: z.string().min(10),
        confirm: z.literal(true),
      })
      .merge(reprogramarReservaSchema)
      .parse(req.body);
    const { t, confirm: _c, ...slot } = body;
    const data = await confirmarReprogramacionPublica(t, slot);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

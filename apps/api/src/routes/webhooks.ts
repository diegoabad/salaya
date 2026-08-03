import { Router } from "express";
import { getEnv } from "../config/env";
import {
  handleMpWebhook,
  simulateMockPay,
} from "../services/mp";
import { isSuscripcionExternalRef } from "../services/suscripcion";

export const webhooksRouter = Router();

webhooksRouter.post("/mercadopago", async (req, res, next) => {
  try {
    const dataId =
      typeof req.query["data.id"] === "string"
        ? req.query["data.id"]
        : typeof req.query.id === "string"
          ? req.query.id
          : undefined;
    const result = await handleMpWebhook({
      xSignature: req.header("x-signature") ?? undefined,
      xRequestId: req.header("x-request-id") ?? undefined,
      dataId,
      body: req.body,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

webhooksRouter.get("/mercadopago", (_req, res) => {
  res.sendStatus(200);
});

export const publicPagosRouter = Router();

/** Mock Checkout Pro: aprueba el pago y redirige al front */
publicPagosRouter.get("/mock-pay", async (req, res, next) => {
  try {
    const env = getEnv();
    const ref = typeof req.query.ref === "string" ? req.query.ref : "";
    if (!ref) {
      res.status(400).send("Falta ref");
      return;
    }
    await simulateMockPay(ref);
    const back = isSuscripcionExternalRef(ref)
      ? `${env.APP_URL}/panel/plan?sub=ok&ref=${encodeURIComponent(ref)}`
      : `${env.APP_URL}/?pago=ok&ref=${encodeURIComponent(ref)}`;
    res.redirect(302, back);
  } catch (err) {
    next(err);
  }
});

/** Confirmar mock vía API (smoke) */
publicPagosRouter.post("/mock-pay", async (req, res, next) => {
  try {
    const ref =
      typeof req.body?.externalReference === "string"
        ? req.body.externalReference
        : typeof req.query.ref === "string"
          ? req.query.ref
          : "";
    if (!ref) {
      res.status(400).json({ error: { message: "Falta externalReference" } });
      return;
    }
    const data = await simulateMockPay(ref);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

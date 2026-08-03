import { Router } from "express";
import { publicResenaSubmitSchema } from "@repo/shared";
import {
  previewResenaInvite,
  submitResenaPublica,
} from "../services/resenas";

export const publicResenasRouter = Router();

publicResenasRouter.get("/invitar", async (req, res, next) => {
  try {
    const t = String(req.query.t ?? "");
    if (!t) {
      res.status(400).json({
        error: { code: "TOKEN_REQUIRED", message: "Falta el token" },
      });
      return;
    }
    res.json(await previewResenaInvite(t));
  } catch (err) {
    next(err);
  }
});

publicResenasRouter.post("/invitar", async (req, res, next) => {
  try {
    const body = publicResenaSubmitSchema.parse(req.body);
    const data = await submitResenaPublica(body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

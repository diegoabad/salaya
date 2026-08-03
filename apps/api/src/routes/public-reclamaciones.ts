import { Router } from "express";
import { reclamarDirectorioSchema } from "@repo/shared";
import { crearReclamacionDirectorio } from "../services/reclamaciones";

export const publicReclamacionesRouter = Router();

publicReclamacionesRouter.post("/", async (req, res, next) => {
  try {
    const body = reclamarDirectorioSchema.parse(req.body);
    const result = await crearReclamacionDirectorio(body);
    res.status(result.duplicated ? 200 : 201).json({
      ok: true,
      id: result.id,
      duplicated: result.duplicated,
      estudioName: result.estudioName,
    });
  } catch (err) {
    next(err);
  }
});

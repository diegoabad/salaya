import { Router } from "express";
import {
  deleteAdicionalPhotoHandler,
  deleteSalaPhotoHandler,
  deleteSedePhotoHandler,
  multerError,
  postUploadAdicional,
  postUploadSala,
  postUploadSede,
  uploadAdicionalMiddleware,
  uploadSalaMiddleware,
  uploadSedeMiddleware,
} from "../controllers/uploadsController";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";
import type { NextFunction, Request, Response } from "express";

export const uploadsRouter = Router();

function wrapMulter(
  mw: (req: Request, res: Response, next: NextFunction) => void,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    mw(req, res, (err) => {
      if (err) {
        multerError(err, next);
        return;
      }
      next();
    });
  };
}

uploadsRouter.post(
  "/sede",
  requireInternalTenant,
  requireOwnerRole,
  wrapMulter(uploadSedeMiddleware),
  postUploadSede,
);

uploadsRouter.delete(
  "/sede/photo",
  requireInternalTenant,
  requireOwnerRole,
  deleteSedePhotoHandler,
);

uploadsRouter.post(
  "/salas/:salaId",
  requireInternalTenant,
  requireOwnerRole,
  wrapMulter(uploadSalaMiddleware),
  postUploadSala,
);

uploadsRouter.delete(
  "/salas/:salaId/photo",
  requireInternalTenant,
  requireOwnerRole,
  deleteSalaPhotoHandler,
);

uploadsRouter.post(
  "/adicionales/:adicionalId",
  requireInternalTenant,
  requireOwnerRole,
  wrapMulter(uploadAdicionalMiddleware),
  postUploadAdicional,
);

uploadsRouter.delete(
  "/adicionales/:adicionalId/photo",
  requireInternalTenant,
  requireOwnerRole,
  deleteAdicionalPhotoHandler,
);

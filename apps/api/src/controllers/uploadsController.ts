import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import { HttpError } from "../middlewares/errorHandler";
import {
  removeAdicionalPhoto,
  removeSalaPhoto,
  removeSedePhoto,
  uploadAdicionalPhoto,
  uploadSalaPhotos,
  uploadSedePhotos,
} from "../services/uploads";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
});

export const uploadSedeMiddleware = upload.array("files", 12);
export const uploadSalaMiddleware = upload.array("files", 12);
export const uploadAdicionalMiddleware = upload.single("file");

export function multerError(err: unknown, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(400, "ARCHIVO_GRANDE", "Máximo 8 MB por imagen"));
      return;
    }
    next(new HttpError(400, "UPLOAD_ERROR", err.message));
    return;
  }
  next(err);
}

export async function postUploadSede(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      throw new HttpError(400, "SIN_ARCHIVOS", "Subí al menos una imagen");
    }
    const data = await uploadSedePhotos(tenantId, files);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteSedePhotoHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    const photoUrl = String(req.body?.url ?? "");
    if (!photoUrl) {
      throw new HttpError(400, "URL_REQUIRED", "Falta url de la foto");
    }
    const data = await removeSedePhoto(tenantId, photoUrl);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function postUploadSala(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    const salaId = String(req.params.salaId);
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      throw new HttpError(400, "SIN_ARCHIVOS", "Subí al menos una imagen");
    }
    const data = await uploadSalaPhotos(tenantId, salaId, files);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteSalaPhotoHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    const salaId = String(req.params.salaId);
    const photoUrl = String(req.body?.url ?? "");
    if (!photoUrl) {
      throw new HttpError(400, "URL_REQUIRED", "Falta url de la foto");
    }
    const data = await removeSalaPhoto(tenantId, salaId, photoUrl);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function postUploadAdicional(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    const adicionalId = String(req.params.adicionalId);
    const file = req.file;
    if (!file) {
      throw new HttpError(400, "SIN_ARCHIVOS", "Subí una imagen");
    }
    const data = await uploadAdicionalPhoto(tenantId, adicionalId, file);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteAdicionalPhotoHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { tenantId } = req as TenantAuthedRequest;
    const adicionalId = String(req.params.adicionalId);
    const data = await removeAdicionalPhoto(tenantId, adicionalId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

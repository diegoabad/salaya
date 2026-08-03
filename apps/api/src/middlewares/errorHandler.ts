import { DomainError } from "@repo/core";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { getLogger } from "../config/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Datos inválidos",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof DomainError) {
    const status = err.code === "SLOT_OCUPADO" ? 409 : 400;
    res.status(status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  getLogger().error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Error interno" },
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

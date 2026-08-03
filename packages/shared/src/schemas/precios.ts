import { z } from "zod";
import {
  ADICIONAL_MODALIDADES,
  DESCUENTO_TIPOS,
  REGLA_PRECIO_SCOPES,
} from "../constants";

const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createAdicionalGrupoSchema = z.object({
  name: z.string().trim().min(2).max(80),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const createAdicionalSchema = z.object({
  grupoId: z.string().uuid().optional(),
  /** Si no hay grupoId, se crea/usa el grupo con este nombre (default "General") */
  grupoName: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2).max(120),
  precioBase: money,
  modalidad: z.enum(ADICIONAL_MODALIDADES).default("por_reserva"),
  stock: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  caracteristicas: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  photoUrl: z.string().max(2000).nullable().optional(),
});

export const updateAdicionalSchema = createAdicionalSchema
  .omit({ grupoId: true, grupoName: true })
  .partial()
  .extend({
    grupoId: z.string().uuid().optional(),
    grupoName: z.string().trim().min(2).max(80).optional(),
  });

export const createReglaPrecioSchema = z
  .object({
    scope: z.enum(REGLA_PRECIO_SCOPES),
    scopeId: z.string().uuid(),
    tipo: z.enum(DESCUENTO_TIPOS).default("continuo"),
    nombre: z.string().trim().min(2).max(120).optional().nullable(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
    startTime: hhmm.nullable().optional(),
    endTime: hhmm.nullable().optional(),
    fechaDesde: ymd.nullable().optional(),
    fechaHasta: ymd.nullable().optional(),
    precioPorHora: money,
    descuentoPorcentaje: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .nullable()
      .optional(),
    active: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "puntual" && (!v.fechaDesde || !v.fechaHasta)) {
      ctx.addIssue({
        code: "custom",
        message: "Las reglas puntuales requieren fechaDesde y fechaHasta",
        path: ["fechaDesde"],
      });
    }
  });

export const updateReglaPrecioSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional().nullable(),
  tipo: z.enum(DESCUENTO_TIPOS).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: hhmm.nullable().optional(),
  endTime: hhmm.nullable().optional(),
  fechaDesde: ymd.nullable().optional(),
  fechaHasta: ymd.nullable().optional(),
  precioPorHora: money.optional(),
  descuentoPorcentaje: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  active: z.boolean().optional(),
});

export type CreateAdicionalInput = z.infer<typeof createAdicionalSchema>;
export type UpdateAdicionalInput = z.infer<typeof updateAdicionalSchema>;
export type CreateAdicionalGrupoInput = z.infer<
  typeof createAdicionalGrupoSchema
>;
export type CreateReglaPrecioInput = z.infer<typeof createReglaPrecioSchema>;
export type UpdateReglaPrecioInput = z.infer<typeof updateReglaPrecioSchema>;

import { z } from "zod";
import {
  SENA_DESTINOS_CANCELACION,
  SENA_MODOS,
  SENA_TIPOS,
} from "../constants";
import { moneySchema } from "../money";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

function isPhotoUrl(v: string) {
  return /^https?:\/\//.test(v) || v.startsWith("/media/");
}

export const updateNegocioSchema = z.object({
  tenantName: z.string().trim().min(2).max(120),
  sedeName: z.string().trim().min(2).max(120),
  zona: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  photoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v === "") return null;
      return v;
    })
    .refine((v) => v === null || isPhotoUrl(v), "URL de foto inválida"),
  photos: z
    .array(
      z
        .string()
        .trim()
        .max(500)
        .refine((v) => isPhotoUrl(v), "URL de foto inválida"),
    )
    .max(12)
    .optional(),
  amenidades: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  tagsDestacados: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  instagramUrl: z.string().trim().max(255).optional().nullable(),
  websiteUrl: z.string().trim().max(255).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  youtubeUrl: z.string().trim().max(255).optional().nullable(),
  tiktokUrl: z.string().trim().max(255).optional().nullable(),
  linksExtra: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z.string().trim().min(3).max(255),
      }),
    )
    .max(8)
    .optional()
    .default([]),
  telefono: z.string().trim().max(40).optional().nullable(),
  lat: z.preprocess((v) => {
    if (v === "" || v == null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }, z.number().min(-90).max(90).nullable().optional()),
  lng: z.preprocess((v) => {
    if (v === "" || v == null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }, z.number().min(-180).max(180).nullable().optional()),
  holdMinutos: z.coerce.number().int().min(1).max(120).optional(),
  cancelacionVentanaHoras: z.coerce.number().int().min(0).max(168).optional(),
  duracionMinMinutos: z.coerce.number().int().min(15).max(480).optional(),
  duracionMaxMinutos: z.coerce.number().int().min(30).max(720).optional(),
  senaModo: z.enum(SENA_MODOS).optional(),
  senaTipo: z.enum(SENA_TIPOS).optional(),
  senaValor: moneySchema.optional(),
  senaDestinoCancelacion: z.enum(SENA_DESTINOS_CANCELACION).optional(),
  permiteReprogramar: z.boolean().optional(),
});

export type UpdateNegocioInput = z.infer<typeof updateNegocioSchema>;

/** Un día abierto; días cerrados no se envían (o closed: true) */
export const horarioDiaSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    closed: z.boolean().optional().default(false),
    startTime: hhmm.optional().nullable(),
    endTime: hhmm.optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.closed) return;
    if (!v.startTime || !v.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "Horario abierto requiere desde y hasta",
        path: ["startTime"],
      });
      return;
    }
    const [sh, sm] = v.startTime.split(":").map(Number);
    const [eh, em] = v.endTime.split(":").map(Number);
    if (eh! * 60 + em! <= sh! * 60 + sm!) {
      ctx.addIssue({
        code: "custom",
        message: "La hora de fin debe ser posterior al inicio",
        path: ["endTime"],
      });
    }
  });

/** Hasta 4 franjas × 7 días (abiertas) + marcadores de cerrado */
export const updateHorariosSchema = z.object({
  horarios: z.array(horarioDiaSchema).min(1).max(35),
});

export const upsertHorarioEspecialSchema = z
  .object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    closed: z.boolean(),
    startTime: hhmm.optional().nullable(),
    endTime: hhmm.optional().nullable(),
    nota: z.string().trim().max(200).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.closed) return;
    if (!v.startTime || !v.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "Día especial abierto requiere desde y hasta",
        path: ["startTime"],
      });
      return;
    }
    const [sh, sm] = v.startTime.split(":").map(Number);
    const [eh, em] = v.endTime.split(":").map(Number);
    if (eh! * 60 + em! <= sh! * 60 + sm!) {
      ctx.addIssue({
        code: "custom",
        message: "La hora de fin debe ser posterior al inicio",
        path: ["endTime"],
      });
    }
  });

export type UpdateHorariosInput = z.infer<typeof updateHorariosSchema>;
export type HorarioDiaInput = z.infer<typeof horarioDiaSchema>;
export type UpsertHorarioEspecialInput = z.infer<typeof upsertHorarioEspecialSchema>;

/** Campos de ficha pública + operación de una sala */
export const salaFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  categoria: z.string().trim().min(1).max(40).default("Música"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  capacity: z.coerce.number().int().min(1).max(200).optional().nullable(),
  anchoMetros: z.coerce.number().positive().max(100).optional().nullable(),
  largoMetros: z.coerce.number().positive().max(100).optional().nullable(),
  /** Base opcional: el precio operativo se define en Precios */
  precioHora: moneySchema.optional(),
  acustica: z.string().trim().max(80).optional().nullable(),
  equipamiento: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  noIncluido: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  caracteristicas: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  photos: z
    .array(
      z
        .string()
        .max(500)
        .refine(
          (v) => /^https?:\/\//.test(v) || v.startsWith("/media/"),
          "URL de foto inválida",
        ),
    )
    .max(12)
    .default([]),
  popular: z.boolean().default(false),
  nueva: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  duracionMinMinutos: z.coerce
    .number()
    .int()
    .min(15)
    .max(480)
    .optional()
    .nullable(),
  duracionMaxMinutos: z.coerce
    .number()
    .int()
    .min(30)
    .max(720)
    .optional()
    .nullable(),
  granularidadMinutos: z.coerce
    .number()
    .int()
    .min(15)
    .max(240)
    .optional()
    .nullable(),
});

export const createSalaSchema = salaFieldsSchema;

export const updateSalaSchema = salaFieldsSchema.partial().extend({
  name: z.string().trim().min(2).max(120).optional(),
  precioHora: moneySchema.optional(),
});

export const toggleSalaSchema = z.object({
  active: z.boolean(),
});

export type CreateSalaInput = z.infer<typeof createSalaSchema>;
export type UpdateSalaInput = z.infer<typeof updateSalaSchema>;

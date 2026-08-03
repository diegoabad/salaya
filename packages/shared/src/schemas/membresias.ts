import { z } from "zod";
import { MEDIOS_PAGO, MEMBRESIA_ESTADOS } from "../constants";

const money = z.string().regex(/^\d+(\.\d{1,2})?$/);
const hours = z.string().regex(/^\d+(\.\d{1,2})?$/);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const diaSemana = z.number().int().min(0).max(6);

export const createMembresiaPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(500).optional().nullable(),
  /** Lo que paga el cliente por período */
  precioMensual: money,
  /** Horas de ensayo incluidas en el período */
  horasMensuales: hours,
  /** Mínimo orientativo de horas por semana */
  horasMinSemanales: hours.default("0"),
  /** Días preferidos: 0=domingo … 6=sábado */
  diasPreferidos: z.array(diaSemana).max(7).default([]),
  /**
   * Crédito $ opcional al cobrar (legacy). Default 0 —
   * el abono se mide en horas, no en saldo.
   */
  creditoMensual: money.optional().default("0"),
  /** Días de vigencia del período (default 30) */
  diasPeriodo: z.number().int().min(7).max(366).default(30),
  active: z.boolean().optional(),
});

export const updateMembresiaPlanSchema = createMembresiaPlanSchema.partial();

export const asignarMembresiaSchema = z.object({
  clienteId: z.string().uuid(),
  planId: z.string().uuid(),
  medioPago: z.enum(MEDIOS_PAGO),
  /** Si false, solo da de alta sin cobrar. Default true */
  cobrarAhora: z.boolean().optional(),
  nota: z.string().trim().max(200).optional().nullable(),
});

export const renovarMembresiaSchema = z.object({
  medioPago: z.enum(MEDIOS_PAGO),
  nota: z.string().trim().max(200).optional().nullable(),
  fecha: ymd.optional(),
});

export const updateMembresiaEstadoSchema = z.object({
  estado: z.enum(MEMBRESIA_ESTADOS),
});

export type CreateMembresiaPlanInput = z.infer<typeof createMembresiaPlanSchema>;
export type UpdateMembresiaPlanInput = z.infer<typeof updateMembresiaPlanSchema>;
export type AsignarMembresiaInput = z.infer<typeof asignarMembresiaSchema>;
export type RenovarMembresiaInput = z.infer<typeof renovarMembresiaSchema>;

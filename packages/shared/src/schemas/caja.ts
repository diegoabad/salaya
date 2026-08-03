import { z } from "zod";
import { MEDIOS_PAGO, MOVIMIENTO_TIPOS } from "../constants";

export const createClienteSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  telefono: z.string().trim().min(6).max(40),
  email: z.string().trim().email().optional().nullable(),
  banda: z.string().trim().max(120).optional().nullable(),
  notasInternas: z.string().trim().max(2000).optional().nullable(),
  creditoFavor: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
});

export const updateClienteSchema = createClienteSchema.partial().extend({
  nombre: z.string().trim().min(2).max(120).optional(),
  telefono: z.string().trim().min(6).max(40).optional(),
});

/** Carga crédito a favor + ingreso en caja (medio + día). */
export const cargarCreditoClienteSchema = z.object({
  monto: z.string().regex(/^\d+(\.\d{1,2})?$/),
  medioPago: z.enum(MEDIOS_PAGO),
  /** Día civil AR del cobro; default = hoy / sesión abierta */
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  nota: z.string().trim().max(200).optional().nullable(),
});

export const createMovimientoSchema = z.object({
  tipo: z.enum(MOVIMIENTO_TIPOS),
  medioPago: z.enum(MEDIOS_PAGO),
  monto: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reservaId: z.string().uuid().optional().nullable(),
  descripcion: z.string().trim().max(500).optional().nullable(),
  /** Si es seña/saldo de una reserva, marcar seña pagada / completar cobro */
  marcarSenaPagada: z.boolean().optional(),
  /** Día civil AR (YYYY-MM-DD) al que imputar el movimiento; default = hoy */
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
export type CargarCreditoClienteInput = z.infer<
  typeof cargarCreditoClienteSchema
>;
export type CreateMovimientoInput = z.infer<typeof createMovimientoSchema>;

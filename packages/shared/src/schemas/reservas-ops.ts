import { z } from "zod";
import { MEDIOS_PAGO } from "../constants";

export const asistenciaSchema = z.object({
  asistio: z.boolean(),
});

export const cobrarSaldoSchema = z.object({
  medioPago: z.enum(MEDIOS_PAGO),
  monto: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  descripcion: z.string().trim().max(500).optional().nullable(),
});

export const cancelarReservaSchema = z.object({
  motivo: z.string().trim().max(500).optional().nullable(),
});

export const reprogramarReservaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
});

export type AsistenciaInput = z.infer<typeof asistenciaSchema>;
export type CobrarSaldoInput = z.infer<typeof cobrarSaldoSchema>;
export type CancelarReservaInput = z.infer<typeof cancelarReservaSchema>;
export type ReprogramarReservaInput = z.infer<typeof reprogramarReservaSchema>;

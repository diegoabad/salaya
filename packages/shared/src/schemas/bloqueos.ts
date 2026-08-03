import { z } from "zod";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

export const createBloqueoSchema = z
  .object({
    /** null / omit = bloqueo de toda la sede */
    salaId: z.string().uuid().nullable().optional(),
    fecha: ymd,
    startTime: hhmm,
    endTime: hhmm,
    motivo: z.string().trim().min(1, "El motivo es obligatorio").max(200),
  })
  .superRefine((v, ctx) => {
    const [sh, sm] = v.startTime.split(":").map(Number);
    const [eh, em] = v.endTime.split(":").map(Number);
    const start = sh! * 60 + sm!;
    const end = eh! * 60 + em!;
    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        message: "La hora de fin debe ser posterior al inicio",
        path: ["endTime"],
      });
    }
  });

export type CreateBloqueoInput = z.infer<typeof createBloqueoSchema>;

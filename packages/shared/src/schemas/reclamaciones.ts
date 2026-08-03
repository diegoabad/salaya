import { z } from "zod";

export const reclamarDirectorioSchema = z.object({
  directorioEntradaId: z.string().uuid(),
  nombre: z.string().trim().min(2, "Ingresá tu nombre").max(120),
  telefono: z
    .string()
    .trim()
    .min(8, "Ingresá un teléfono válido")
    .max(40),
  email: z.string().trim().email("Ingresá un email válido").max(200),
});

export type ReclamarDirectorioInput = z.infer<typeof reclamarDirectorioSchema>;

import { z } from "zod";

export const createResenaSchema = z.object({
  authorName: z.string().trim().min(2).max(120),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(5).max(2000),
  published: z.boolean().optional(),
  salaId: z.string().uuid().optional().nullable(),
});

export const toggleResenaSchema = z.object({
  published: z.boolean(),
});

/** Dueño invita a un cliente a dejar reseña (email). */
export const invitarResenaSchema = z.object({
  clienteId: z.string().uuid(),
  /** Si el cliente no tiene email, se guarda y se usa para el invite */
  email: z.string().trim().email().optional(),
});

export const publicResenaSubmitSchema = z.object({
  t: z.string().min(20),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(5).max(2000),
});

export type CreateResenaInput = z.infer<typeof createResenaSchema>;
export type InvitarResenaInput = z.infer<typeof invitarResenaSchema>;
export type PublicResenaSubmitInput = z.infer<typeof publicResenaSubmitSchema>;

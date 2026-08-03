import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  businessName: z.string().trim().min(2).max(120),
  /** Si se omite, se deriva del nombre */
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido")
    .optional(),
  sedeName: z.string().trim().min(2).max(120).optional(),
  zona: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const slugCheckSchema = z.object({
  name: z.string().trim().min(2).max(120),
  zona: z.string().trim().max(120).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["owner", "employee"]).default("employee"),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(16).max(128),
  /** Si el usuario aún no existe / no tiene password */
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8).max(128).optional(),
});

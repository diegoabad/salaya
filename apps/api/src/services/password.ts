import { getDb, users } from "@repo/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { HttpError } from "../middlewares/errorHandler";

export async function changePassword(input: {
  userId: string;
  currentPassword?: string;
  newPassword: string;
}) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (!user) {
    throw new HttpError(404, "NOT_FOUND", "Usuario no encontrado");
  }

  if (user.passwordHash) {
    if (!input.currentPassword) {
      throw new HttpError(
        400,
        "CURRENT_PASSWORD_REQUIRED",
        "Ingresá tu contraseña actual",
      );
    }
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new HttpError(
        401,
        "INVALID_PASSWORD",
        "La contraseña actual es incorrecta",
      );
    }
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, input.userId));

  return { ok: true as const, hadPassword: Boolean(user.passwordHash) };
}

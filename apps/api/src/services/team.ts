import {
  getDb,
  tenantInvites,
  userTenants,
  users,
} from "@repo/db";
import {
  findInviteByToken,
  listPendingInvites,
  listTenantMembers,
} from "@repo/db/queries";
import type { UserTenantRole } from "@repo/shared";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { HttpError } from "../middlewares/errorHandler";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

export async function listTeam(tenantId: string) {
  const db = getDb();
  const [members, invites] = await Promise.all([
    listTenantMembers(db, tenantId),
    listPendingInvites(db, tenantId),
  ]);

  return {
    members: members.map((m) => ({
      userId: m.userId,
      email: m.email,
      name: m.name,
      role: m.role,
      createdAt: m.createdAt,
      hasPassword: Boolean(m.passwordHash),
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      token: i.token,
    })),
  };
}

export async function createInvite(input: {
  tenantId: string;
  invitedByUserId: string;
  email: string;
  role: UserTenantRole;
}) {
  const db = getDb();
  const email = input.email.toLowerCase();

  if (input.role === "owner") {
    throw new HttpError(
      400,
      "INVALID_ROLE",
      "Los colaboradores se invitan como empleados",
    );
  }

  const existingMember = await db
    .select({ userId: userTenants.userId })
    .from(userTenants)
    .innerJoin(users, eq(users.id, userTenants.userId))
    .where(and(eq(userTenants.tenantId, input.tenantId), eq(users.email, email)))
    .limit(1);

  if (existingMember[0]) {
    throw new HttpError(409, "ALREADY_MEMBER", "Esa persona ya está en el equipo");
  }

  const pending = await db.query.tenantInvites.findFirst({
    where: and(
      eq(tenantInvites.tenantId, input.tenantId),
      eq(tenantInvites.email, email),
      isNull(tenantInvites.acceptedAt),
    ),
  });
  if (pending) {
    throw new HttpError(
      409,
      "INVITE_PENDING",
      "Ya hay una invitación pendiente para ese email",
    );
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const [invite] = await db
    .insert(tenantInvites)
    .values({
      tenantId: input.tenantId,
      email,
      role: input.role,
      token,
      invitedByUserId: input.invitedByUserId,
      expiresAt,
    })
    .returning();

  return invite!;
}

export async function revokeInvite(input: {
  tenantId: string;
  inviteId: string;
}) {
  const db = getDb();
  const deleted = await db
    .delete(tenantInvites)
    .where(
      and(
        eq(tenantInvites.id, input.inviteId),
        eq(tenantInvites.tenantId, input.tenantId),
        isNull(tenantInvites.acceptedAt),
      ),
    )
    .returning({ id: tenantInvites.id });

  if (!deleted[0]) {
    throw new HttpError(404, "NOT_FOUND", "Invitación no encontrada");
  }
  return { ok: true as const };
}

export async function removeMember(input: {
  tenantId: string;
  actorUserId: string;
  memberUserId: string;
}) {
  if (input.actorUserId === input.memberUserId) {
    throw new HttpError(400, "CANNOT_REMOVE_SELF", "No podés quitarte a vos mismo");
  }

  const db = getDb();
  const target = await db.query.userTenants.findFirst({
    where: and(
      eq(userTenants.tenantId, input.tenantId),
      eq(userTenants.userId, input.memberUserId),
    ),
  });
  if (!target) {
    throw new HttpError(404, "NOT_FOUND", "Miembro no encontrado");
  }
  if (target.role === "owner") {
    throw new HttpError(400, "CANNOT_REMOVE_OWNER", "No se puede quitar al dueño");
  }

  await db
    .delete(userTenants)
    .where(
      and(
        eq(userTenants.tenantId, input.tenantId),
        eq(userTenants.userId, input.memberUserId),
      ),
    );

  return { ok: true as const };
}

export async function getInvitePublic(token: string) {
  const invite = await findInviteByToken(getDb(), token);
  if (!invite) {
    throw new HttpError(404, "NOT_FOUND", "Invitación no encontrada");
  }
  if (invite.acceptedAt) {
    throw new HttpError(409, "ALREADY_ACCEPTED", "Esta invitación ya fue usada");
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, "EXPIRED", "La invitación expiró");
  }

  const existingUser = await getDb().query.users.findFirst({
    where: eq(users.email, invite.email),
    columns: { id: true, passwordHash: true, name: true },
  });

  return {
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    tenant: {
      id: invite.tenant.id,
      name: invite.tenant.name,
      slug: invite.tenant.slug,
    },
    userExists: Boolean(existingUser),
    needsPassword: !existingUser?.passwordHash,
    existingName: existingUser?.name ?? null,
  };
}

export async function acceptInvite(input: {
  token: string;
  /** Si Auth.js ya autenticó, debe coincidir el email */
  actingUserId?: string;
  name?: string;
  password?: string;
}) {
  const db = getDb();
  const invite = await findInviteByToken(db, input.token);
  if (!invite) {
    throw new HttpError(404, "NOT_FOUND", "Invitación no encontrada");
  }
  if (invite.acceptedAt) {
    throw new HttpError(409, "ALREADY_ACCEPTED", "Esta invitación ya fue usada");
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, "EXPIRED", "La invitación expiró");
  }

  return db.transaction(async (tx) => {
    let user = await tx.query.users.findFirst({
      where: eq(users.email, invite.email),
    });

    if (input.actingUserId) {
      const acting = await tx.query.users.findFirst({
        where: eq(users.id, input.actingUserId),
      });
      if (!acting) {
        throw new HttpError(401, "UNAUTHENTICATED", "Sesión inválida");
      }
      if (acting.email.toLowerCase() !== invite.email) {
        throw new HttpError(
          403,
          "EMAIL_MISMATCH",
          `Entrá con ${invite.email} para aceptar la invitación`,
        );
      }
      user = acting;
    }

    if (!user) {
      if (!input.password || !input.name) {
        throw new HttpError(
          400,
          "ACCOUNT_REQUIRED",
          "Creá tu cuenta con nombre y contraseña",
        );
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const [created] = await tx
        .insert(users)
        .values({
          email: invite.email,
          name: input.name,
          passwordHash,
        })
        .returning();
      user = created!;
    } else if (!input.actingUserId) {
      // Aceptación sin sesión: hay que demostrar la cuenta
      if (!user.passwordHash) {
        if (!input.password) {
          throw new HttpError(
            400,
            "PASSWORD_REQUIRED",
            "Definí una contraseña o entrá con Google y volvé al link",
          );
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const [updated] = await tx
          .update(users)
          .set({
            passwordHash,
            name: input.name?.trim() || user.name,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();
        user = updated!;
      } else {
        if (!input.password) {
          throw new HttpError(
            400,
            "PASSWORD_REQUIRED",
            "Ingresá tu contraseña para unirte",
          );
        }
        const ok = await bcrypt.compare(input.password, user.passwordHash);
        if (!ok) {
          throw new HttpError(
            401,
            "INVALID_CREDENTIALS",
            "Contraseña incorrecta",
          );
        }
      }
    } else if (!user.passwordHash && input.password) {
      const passwordHash = await bcrypt.hash(input.password, 12);
      const [updated] = await tx
        .update(users)
        .set({
          passwordHash,
          name: input.name?.trim() || user.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      user = updated!;
    }

    const already = await tx.query.userTenants.findFirst({
      where: and(
        eq(userTenants.userId, user.id),
        eq(userTenants.tenantId, invite.tenantId),
      ),
    });
    if (!already) {
      await tx.insert(userTenants).values({
        userId: user.id,
        tenantId: invite.tenantId,
        role: invite.role,
      });
    }

    await tx
      .update(tenantInvites)
      .set({ acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(tenantInvites.id, invite.id));

    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenant: {
        id: invite.tenant.id,
        name: invite.tenant.name,
        slug: invite.tenant.slug,
      },
      role: invite.role,
    };
  });
}

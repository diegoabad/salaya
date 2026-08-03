import type { Request, Response } from "express";
import {
  acceptInviteSchema,
  changePasswordSchema,
  inviteMemberSchema,
} from "@repo/shared";
import type { InternalAuthedRequest } from "../middlewares/internalAuth";
import type { TenantAuthedRequest } from "../middlewares/tenantAuth";
import { changePassword } from "../services/password";
import {
  acceptInvite,
  createInvite,
  getInvitePublic,
  listTeam,
  removeMember,
  revokeInvite,
} from "../services/team";

export async function postChangePassword(req: Request, res: Response) {
  const userId = (req as InternalAuthedRequest).userId;
  const data = changePasswordSchema.parse(req.body);
  const result = await changePassword({
    userId,
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
  });
  res.json(result);
}

export async function getTeam(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const result = await listTeam(tenantId);
  res.json(result);
}

export async function postInvite(req: Request, res: Response) {
  const { tenantId, userId } = req as TenantAuthedRequest;
  const data = inviteMemberSchema.parse(req.body);
  const invite = await createInvite({
    tenantId,
    invitedByUserId: userId,
    email: data.email,
    role: data.role,
  });
  res.status(201).json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    token: invite.token,
  });
}

export async function deleteInvite(req: Request, res: Response) {
  const { tenantId } = req as TenantAuthedRequest;
  const inviteId = String(req.params.inviteId);
  await revokeInvite({ tenantId, inviteId });
  res.status(204).send();
}

export async function deleteMember(req: Request, res: Response) {
  const { tenantId, userId } = req as TenantAuthedRequest;
  const memberUserId = String(req.params.userId);
  await removeMember({
    tenantId,
    actorUserId: userId,
    memberUserId,
  });
  res.status(204).send();
}

export async function getInviteByToken(req: Request, res: Response) {
  const token = String(req.params.token);
  const result = await getInvitePublic(token);
  res.json(result);
}

export async function postAcceptInvite(req: Request, res: Response) {
  const data = acceptInviteSchema.parse({
    ...req.body,
    token: req.body.token ?? req.params.token,
  });
  const actingUserId = req.header("x-user-id") || undefined;
  // Si viene secret+user, preferimos usuario autenticado
  const secret = req.header("x-internal-secret");
  const envSecret = process.env.INTERNAL_API_SECRET;
  const userId =
    secret && envSecret && secret === envSecret ? actingUserId : undefined;

  const result = await acceptInvite({
    token: data.token,
    actingUserId: userId,
    name: data.name,
    password: data.password,
  });
  res.json(result);
}

import { Router } from "express";
import {
  getSlugCheck,
  postLogin,
  postLogout,
  postOnboarding,
  postRegister,
} from "../controllers/authController";
import {
  deleteInvite,
  deleteMember,
  getInviteByToken,
  getTeam,
  postAcceptInvite,
  postChangePassword,
  postInvite,
} from "../controllers/teamController";
import { requireAuth } from "../middlewares/auth";
import { requireInternalUser } from "../middlewares/internalAuth";
import {
  requireInternalTenant,
  requireOwnerRole,
} from "../middlewares/tenantAuth";

export const authRouter = Router();

authRouter.post("/register", postRegister);
authRouter.post("/login", postLogin);
authRouter.post("/logout", requireAuth, postLogout);
authRouter.get("/slug-check", getSlugCheck);
authRouter.post("/onboarding", requireInternalUser, postOnboarding);
authRouter.post("/change-password", requireInternalUser, postChangePassword);

authRouter.get("/invite/:token", getInviteByToken);
authRouter.post("/invite/:token/accept", postAcceptInvite);

authRouter.get("/team", requireInternalTenant, getTeam);
authRouter.post(
  "/team/invites",
  requireInternalTenant,
  requireOwnerRole,
  postInvite,
);
authRouter.delete(
  "/team/invites/:inviteId",
  requireInternalTenant,
  requireOwnerRole,
  deleteInvite,
);
authRouter.delete(
  "/team/members/:userId",
  requireInternalTenant,
  requireOwnerRole,
  deleteMember,
);


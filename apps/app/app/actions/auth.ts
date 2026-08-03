"use server";

import { auth, signIn, unstable_update } from "@/auth";
import { getAppDb } from "@/lib/db";
import { userTenants } from "@repo/db";
import {
  acceptInviteSchema,
  changePasswordSchema,
  inviteMemberSchema,
  registerSchema,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ActionResult =
  | { ok: true; error?: undefined }
  | { ok: false; error: string };

function apiError(body: { error?: { message?: string } } | null, fallback: string) {
  return body?.error?.message ?? fallback;
}

async function refreshSession() {
  await unstable_update({});
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const rawCb = String(formData.get("callbackUrl") ?? "/favoritos");
  const callbackUrl =
    rawCb.startsWith("/") && !rawCb.startsWith("//") ? rawCb : "/favoritos";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Email o contraseña incorrectos" };
    }
    throw err;
  }

  return { ok: true };
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    zona: String(formData.get("zona") ?? "") || undefined,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Revisá los datos del formulario" };
  }

  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, error: apiError(body, "No se pudo completar el registro") };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/panel",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        ok: false,
        error: "Cuenta creada, pero falló el inicio de sesión. Probá entrar.",
      };
    }
    throw err;
  }

  return { ok: true };
}

export async function googleSignInAction(formData: FormData) {
  const rawCb = String(formData.get("callbackUrl") ?? "/favoritos");
  const callbackUrl =
    rawCb.startsWith("/") && !rawCb.startsWith("//") ? rawCb : "/favoritos";
  await signIn("google", { redirectTo: callbackUrl });
}

export async function onboardingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Tenés que iniciar sesión" };
  }

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return { ok: false, error: "Falta INTERNAL_API_SECRET en el entorno" };
  }

  const businessName = String(formData.get("businessName") ?? "").trim();
  const zona = String(formData.get("zona") ?? "").trim() || undefined;
  if (businessName.length < 2) {
    return { ok: false, error: "Ingresá el nombre del negocio" };
  }

  const res = await fetch(`${API_URL}/auth/onboarding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
      "x-user-id": session.user.id,
    },
    body: JSON.stringify({ businessName, zona }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, error: apiError(body, "No se pudo crear el negocio") };
  }

  await refreshSession();
  redirect("/panel");
}

export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Tenés que iniciar sesión" };
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return { ok: false, error: "Falta INTERNAL_API_SECRET en el entorno" };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? "") || undefined,
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá las contraseñas",
    };
  }

  const res = await fetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
      "x-user-id": session.user.id,
    },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, error: apiError(body, "No se pudo cambiar la contraseña") };
  }

  await refreshSession();
  return { ok: true };
}

export async function inviteMemberAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { inviteUrl?: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    return { ok: false, error: "Sesión sin estudio" };
  }
  if (session.user.role !== "owner") {
    return { ok: false, error: "Solo el dueño puede invitar" };
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return { ok: false, error: "Falta INTERNAL_API_SECRET en el entorno" };
  }

  const parsed = inviteMemberSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: "employee",
  });
  if (!parsed.success) {
    return { ok: false, error: "Email inválido" };
  }

  const res = await fetch(`${API_URL}/auth/team/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
      "x-user-id": session.user.id,
      "x-tenant-id": session.user.tenantId,
    },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, error: apiError(body, "No se pudo crear la invitación") };
  }

  const invite = (await res.json()) as { token: string };
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return {
    ok: true,
    inviteUrl: `${base}/invite/${invite.token}`,
  };
}

export async function revokeInviteAction(inviteId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId || session.user.role !== "owner") {
    return { ok: false, error: "No autorizado" };
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return { ok: false, error: "Falta INTERNAL_API_SECRET" };

  const res = await fetch(`${API_URL}/auth/team/invites/${inviteId}`, {
    method: "DELETE",
    headers: {
      "x-internal-secret": secret,
      "x-user-id": session.user.id,
      "x-tenant-id": session.user.tenantId,
    },
  });
  if (!res.ok) {
    return { ok: false, error: "No se pudo revocar la invitación" };
  }
  return { ok: true };
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId || session.user.role !== "owner") {
    return { ok: false, error: "No autorizado" };
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return { ok: false, error: "Falta INTERNAL_API_SECRET" };

  const res = await fetch(`${API_URL}/auth/team/members/${userId}`, {
    method: "DELETE",
    headers: {
      "x-internal-secret": secret,
      "x-user-id": session.user.id,
      "x-tenant-id": session.user.tenantId,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, error: apiError(body, "No se pudo quitar al miembro") };
  }
  return { ok: true };
}

export async function acceptInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  const secret = process.env.INTERNAL_API_SECRET;

  const parsed = acceptInviteSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    name: String(formData.get("name") ?? "") || undefined,
    password: String(formData.get("password") ?? "") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Revisá los datos" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.user?.id && secret) {
    headers["x-internal-secret"] = secret;
    headers["x-user-id"] = session.user.id;
  }

  const res = await fetch(`${API_URL}/auth/invite/${parsed.data.token}/accept`, {
    method: "POST",
    headers,
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, error: apiError(body, "No se pudo aceptar la invitación") };
  }

  const result = (await res.json()) as {
    user: { email: string };
  };

  // Si creó cuenta con password, iniciar sesión
  if (parsed.data.password) {
    try {
      await signIn("credentials", {
        email: result.user.email,
        password: parsed.data.password,
        redirectTo: "/panel",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        await refreshSession();
        redirect("/panel");
      }
      throw err;
    }
  }

  await refreshSession();
  redirect("/panel");
}

export async function userHasTenant(userId: string): Promise<boolean> {
  const rows = await getAppDb()
    .select({ tenantId: userTenants.tenantId })
    .from(userTenants)
    .where(eq(userTenants.userId, userId))
    .limit(1);
  return rows.length > 0;
}

export async function fetchTeam() {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) return null;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return null;

  const res = await fetch(`${API_URL}/auth/team`, {
    headers: {
      "x-internal-secret": secret,
      "x-user-id": session.user.id,
      "x-tenant-id": session.user.tenantId,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    members: Array<{
      userId: string;
      email: string;
      name: string;
      role: "owner" | "employee";
      createdAt: string;
      hasPassword: boolean;
    }>;
    invites: Array<{
      id: string;
      email: string;
      role: "owner" | "employee";
      expiresAt: string;
      createdAt: string;
      token: string;
    }>;
  };
}

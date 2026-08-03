import { acceptInviteAction, googleSignInAction } from "@/app/actions/auth";
import { auth } from "@/auth";
import { AuthForm, Field } from "@/app/(auth)/_components/auth-form";
import { IconGoogle } from "@/components/icons/icon-google";
import { BrandLogo } from "@/components/layouts/brand-logo";
import Link from "next/link";
import type { ReactNode } from "react";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const session = await auth();

  const res = await fetch(`${API_URL}/auth/invite/${token}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return (
      <Shell>
        <h1 className="font-display text-3xl tracking-tight">Invitación</h1>
        <p className="mt-3 text-sm text-red-300">
          {body?.error?.message ?? "Invitación inválida o expirada"}
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-brand underline">
          Ir al login
        </Link>
      </Shell>
    );
  }

  const invite = (await res.json()) as {
    email: string;
    role: string;
    tenant: { name: string };
    userExists: boolean;
    needsPassword: boolean;
  };

  const emailMatch =
    session?.user?.email?.toLowerCase() === invite.email.toLowerCase();

  return (
    <Shell>
      <h1 className="font-display text-3xl tracking-tight">Unirte al equipo</h1>
      <p className="mt-2 text-sm text-muted">
        Te invitaron a <span className="text-ink">{invite.tenant.name}</span> como
        colaborador ({invite.email}).
      </p>

      {emailMatch ? (
        <div className="mt-8">
          <AuthForm action={acceptInviteAction} submitLabel="Aceptar invitación">
            <input type="hidden" name="token" value={token} />
          </AuthForm>
        </div>
      ) : session?.user ? (
        <p className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          Estás logueado como {session.user.email}. Salí e ingresá con{" "}
          {invite.email} para aceptar.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          <AuthForm
            action={acceptInviteAction}
            submitLabel={
              invite.userExists ? "Entrar y unirme" : "Crear cuenta y unirme"
            }
          >
            <input type="hidden" name="token" value={token} />
            {!invite.userExists && (
              <Field label="Tu nombre" name="name" required autoComplete="name" />
            )}
            <Field
              label={
                invite.userExists && !invite.needsPassword
                  ? "Contraseña"
                  : "Crear contraseña"
              }
              name="password"
              type="password"
              required
              autoComplete={
                invite.userExists && !invite.needsPassword
                  ? "current-password"
                  : "new-password"
              }
              placeholder="Mínimo 8 caracteres"
            />
          </AuthForm>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-paper px-2 text-muted">o</span>
            </div>
          </div>

          <form action={googleSignInAction}>
            <input type="hidden" name="callbackUrl" value="/panel" />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-2"
            >
              <IconGoogle size={20} />
              Continuar con Google
            </button>
          </form>
          <p className="text-center text-xs text-muted">
            Si usás Google, entrá con {invite.email} y volvé a este link para
            aceptar.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center bg-paper px-4 py-16">
      <div className="mx-auto mb-8">
        <BrandLogo height={40} href="/" />
      </div>
      <div className="mx-auto w-full max-w-sm">{children}</div>
    </div>
  );
}

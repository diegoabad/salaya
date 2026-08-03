import Link from "next/link";
import { googleSignInAction, loginAction } from "@/app/actions/auth";
import { IconGoogle } from "@/components/icons/icon-google";
import { AuthForm, Field } from "../_components/auth-form";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  const next =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/favoritos";
  const esPanel = next.startsWith("/panel") || next.startsWith("/onboarding");

  return (
    <div className="mx-auto w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
          Entrar
        </h1>
        <p className="mt-2 text-sm text-muted">
          {esPanel
            ? "Panel para dueños de salas de ensayo."
            : "Guardá favoritos y compartí tu lista de estudios."}
        </p>

        <div className="mt-8">
          <AuthForm action={loginAction} submitLabel="Entrar">
            <input type="hidden" name="callbackUrl" value={next} />
            <Field
              label="Email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
            <Field
              label="Contraseña"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </AuthForm>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-paper px-2 text-muted">o</span>
          </div>
        </div>

        <form action={googleSignInAction}>
          <input type="hidden" name="callbackUrl" value={next} />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-2"
          >
            <IconGoogle size={20} />
            Continuar con Google
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿Tenés un estudio?{" "}
          <Link href="/register" className="font-medium text-brand underline">
            Registrate
          </Link>
        </p>
    </div>
  );
}

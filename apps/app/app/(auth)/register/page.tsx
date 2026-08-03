import Link from "next/link";
import { googleSignInAction } from "@/app/actions/auth";
import { IconGoogle } from "@/components/icons/icon-google";
import { RegisterForm } from "../_components/register-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
          Crear cuenta
        </h1>
        <p className="mt-2 text-sm text-muted">
          Registrá tu sala y empezá a gestionar reservas.
        </p>

        <div className="mt-8">
          <RegisterForm />
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
          <input type="hidden" name="callbackUrl" value="/panel" />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-2"
          >
            <IconGoogle size={20} />
            Continuar con Google
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-brand underline">
            Entrar
          </Link>
        </p>
    </div>
  );
}

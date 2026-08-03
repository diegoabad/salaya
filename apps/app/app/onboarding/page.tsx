import { BrandLogo } from "@/components/layouts/brand-logo";
import { onboardingAction } from "@/app/actions/auth";
import { AuthForm, Field } from "../(auth)/_components/auth-form";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center bg-paper px-4 py-16">
      <div className="mx-auto mb-8">
        <BrandLogo height={40} href="/" />
      </div>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
          Tu negocio
        </h1>
        <p className="mt-2 text-sm text-muted">
          Completá el nombre de tu sala para entrar al panel. Si te invitaron
          como colaborador, usá el link de invitación en vez de crear un
          negocio.
        </p>
        <div className="mt-8">
          <AuthForm action={onboardingAction} submitLabel="Continuar al panel">
            <Field
              label="Nombre del negocio"
              name="businessName"
              required
              placeholder="Ej. Sala Norte"
            />
            <Field
              label="Zona (opcional)"
              name="zona"
              placeholder="Ej. Palermo"
            />
          </AuthForm>
        </div>
      </div>
    </div>
  );
}

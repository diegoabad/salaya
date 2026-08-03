import { auth } from "@/auth";
import { fetchMpStatus } from "@/app/actions/mp";
import { fetchNegocio } from "@/app/actions/negocio";
import { PanelConfigView } from "@/components/features/panel/panel-config";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PanelConfigPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = (await searchParams) ?? {};
  const mpLinked = params.mp_linked === "1";
  const mpErrorRaw = params.mp_error;
  const mpError =
    typeof mpErrorRaw === "string"
      ? mpErrorRaw
      : Array.isArray(mpErrorRaw)
        ? mpErrorRaw[0]
        : null;

  const [negocio, mpStatus] = await Promise.all([
    fetchNegocio(),
    fetchMpStatus(),
  ]);
  if (!negocio) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">
          No se pudo cargar el negocio. ¿Está corriendo la API?
        </p>
        <Link href="/panel" className="mt-3 inline-block text-sm text-brand underline">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <PanelConfigView
      negocio={negocio}
      hasPassword={session.user.hasPassword}
      userEmail={session.user.email ?? ""}
      mpStatus={mpStatus}
      mpFlash={{ linked: mpLinked, error: mpError }}
    />
  );
}

import { auth } from "@/auth";
import { fetchNegocio } from "@/app/actions/negocio";
import { PanelMiEstudioView } from "@/components/features/panel/panel-mi-estudio";
import { loadEstudioBySlug } from "@/lib/publico-data";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PanelMiEstudioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const negocio = await fetchNegocio();
  if (!negocio) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">
          No se pudo cargar el estudio. ¿Está corriendo la API?
        </p>
        <Link href="/panel" className="mt-3 inline-block text-sm text-brand underline">
          Volver
        </Link>
      </div>
    );
  }

  const estudio = await loadEstudioBySlug(negocio.tenant.slug);
  if (!estudio) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">
          Todavía no hay ficha pública para{" "}
          <span className="font-medium text-ink">/{negocio.tenant.slug}</span>.
          Completá los datos y publicá salas.
        </p>
        <Link
          href="/panel/salas"
          className="mt-3 inline-block text-sm text-brand underline"
        >
          Ir a Salas
        </Link>
      </div>
    );
  }

  return (
    <PanelMiEstudioView
      estudio={estudio}
      negocio={negocio}
      basePath="/panel"
    />
  );
}

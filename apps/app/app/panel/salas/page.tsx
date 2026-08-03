import { auth } from "@/auth";
import { fetchSalas } from "@/app/actions/salas";
import { PanelSalasView } from "@/components/features/panel/panel-salas";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PanelSalasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await fetchSalas();
  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">
          No se pudieron cargar las salas. ¿Está corriendo la API?
        </p>
        <p className="mt-2 text-sm text-muted">
          Si acabás de registrar el estudio, completá primero{" "}
          <Link href="/panel/mi-estudio" className="text-brand underline">
            Mi estudio
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <PanelSalasView
      initialSalas={data.salas}
      isOwner={session.user.role === "owner"}
      basePath="/panel"
    />
  );
}

import { auth } from "@/auth";
import { fetchTeam } from "@/app/actions/auth";
import { PanelEquipoView } from "@/components/features/panel/panel-equipo";
import { redirect } from "next/navigation";

export default async function PanelEquipoPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    redirect("/panel");
  }

  const team = await fetchTeam();
  if (!team) {
    return (
      <p className="text-sm text-muted">
        No se pudo cargar el equipo. ¿Está corriendo la API?
      </p>
    );
  }

  return (
    <PanelEquipoView
      initial={team}
      authUrl={process.env.AUTH_URL ?? "http://localhost:3000"}
    />
  );
}

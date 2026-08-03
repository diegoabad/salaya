import { fetchAdicionales } from "@/app/actions/adicionales";
import { PanelAdicionalesView } from "@/components/features/panel/panel-adicionales";

export default async function PanelAdicionalesPage() {
  const data = await fetchAdicionales();
  if (!data) {
    return (
      <p className="text-sm text-muted">
        No se pudieron cargar los adicionales. ¿Está corriendo la API?
      </p>
    );
  }
  return (
    <PanelAdicionalesView
      adicionales={data.adicionales}
      grupos={data.grupos}
    />
  );
}

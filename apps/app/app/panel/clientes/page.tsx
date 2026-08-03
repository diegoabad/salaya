import { fetchClientes } from "@/app/actions/clientes";
import { PanelClientesView } from "@/components/features/panel/panel-clientes";

export default async function PanelClientesPage() {
  const clientes = await fetchClientes();
  if (!clientes) {
    return (
      <p className="text-sm text-muted">
        No se pudieron cargar los clientes. ¿Está corriendo la API?
      </p>
    );
  }
  return <PanelClientesView clientes={clientes} />;
}

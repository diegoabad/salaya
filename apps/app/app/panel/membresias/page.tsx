import { fetchClientes } from "@/app/actions/clientes";
import { fetchMembresias } from "@/app/actions/membresias";
import { PanelMembresiasView } from "@/components/features/panel/panel-membresias";

export default async function PanelMembresiasPage() {
  const [data, clientes] = await Promise.all([
    fetchMembresias(),
    fetchClientes(),
  ]);
  if (!data) {
    return (
      <p className="text-sm text-muted">
        No se pudieron cargar las membresías. ¿Está corriendo la API?
      </p>
    );
  }
  return (
    <PanelMembresiasView data={data} clientes={clientes ?? []} />
  );
}

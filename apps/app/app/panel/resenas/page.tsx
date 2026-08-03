import { fetchClientes } from "@/app/actions/clientes";
import { fetchResenas } from "@/app/actions/resenas";
import { PanelResenasView } from "@/components/features/panel/panel-resenas";

export default async function PanelResenasPage() {
  const [data, clientes] = await Promise.all([
    fetchResenas(),
    fetchClientes(),
  ]);
  if (!data) {
    return (
      <p className="text-sm text-muted">
        No se pudieron cargar las reseñas. ¿Está corriendo la API?
      </p>
    );
  }
  return <PanelResenasView data={data} clientes={clientes ?? []} />;
}

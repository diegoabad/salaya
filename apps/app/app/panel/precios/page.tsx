import { fetchPrecios } from "@/app/actions/precios";
import { PanelPreciosView } from "@/components/features/panel/panel-precios";

export default async function PanelPreciosPage() {
  const data = await fetchPrecios();
  if (!data) {
    return (
      <p className="text-sm text-muted">
        No se pudieron cargar los precios. ¿Está corriendo la API?
      </p>
    );
  }
  return <PanelPreciosView data={data} />;
}

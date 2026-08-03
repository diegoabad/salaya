import { fetchPrecios } from "@/app/actions/precios";
import { PanelPromocionesView } from "@/components/features/panel/panel-promociones";

export default async function PanelPromocionesPage() {
  const data = await fetchPrecios();
  if (!data) {
    return (
      <p className="text-sm text-muted">
        No se pudieron cargar las promociones. ¿Está corriendo la API?
      </p>
    );
  }
  return <PanelPromocionesView data={data} />;
}

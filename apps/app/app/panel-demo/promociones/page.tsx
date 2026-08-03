import { PanelPromocionesView } from "@/components/features/panel/panel-promociones";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoPromocionesPage() {
  const demo = await loadPanelDemoBundle();
  return <PanelPromocionesView data={demo.precios} />;
}

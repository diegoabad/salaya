import { PanelPreciosView } from "@/components/features/panel/panel-precios";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoPreciosPage() {
  const demo = await loadPanelDemoBundle();
  // Sin readOnly: se puede probar la grilla (cambios quedan locales si no hay API).
  return <PanelPreciosView data={demo.precios} />;
}

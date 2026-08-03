import { PanelAdicionalesView } from "@/components/features/panel/panel-adicionales";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoAdicionalesPage() {
  const demo = await loadPanelDemoBundle();
  return (
    <PanelAdicionalesView
      adicionales={demo.adicionales}
      grupos={demo.adicionalGrupos}
    />
  );
}

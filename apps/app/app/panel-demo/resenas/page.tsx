import { PanelResenasView } from "@/components/features/panel/panel-resenas";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoResenasPage() {
  const demo = await loadPanelDemoBundle();
  return (
    <PanelResenasView
      data={demo.resenas}
      clientes={demo.clientes}
      isDemo
    />
  );
}

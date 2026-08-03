import { PanelClientesView } from "@/components/features/panel/panel-clientes";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoClientesPage() {
  const demo = await loadPanelDemoBundle();
  return <PanelClientesView clientes={demo.clientes} isDemo />;
}

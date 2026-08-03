import { PanelMembresiasView } from "@/components/features/panel/panel-membresias";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoAbonosPage() {
  const demo = await loadPanelDemoBundle();
  return (
    <PanelMembresiasView
      data={demo.membresias}
      clientes={demo.clientes}
      isDemo
    />
  );
}

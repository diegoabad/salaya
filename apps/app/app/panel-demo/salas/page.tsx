import { PanelSalasView } from "@/components/features/panel/panel-salas";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoSalasPage() {
  const demo = await loadPanelDemoBundle();
  return (
    <PanelSalasView
      initialSalas={demo.salas}
      isOwner
      basePath="/panel-demo"
    />
  );
}

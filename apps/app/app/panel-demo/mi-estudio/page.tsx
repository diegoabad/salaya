import { PanelMiEstudioView } from "@/components/features/panel/panel-mi-estudio";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoMiEstudioPage() {
  const demo = await loadPanelDemoBundle();
  return (
    <PanelMiEstudioView
      estudio={demo.estudio}
      negocio={demo.negocio}
      basePath="/panel-demo"
      readOnly
    />
  );
}

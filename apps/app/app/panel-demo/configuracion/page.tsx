import { PanelConfigView } from "@/components/features/panel/panel-config";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoConfigPage() {
  const demo = await loadPanelDemoBundle();
  return (
    <PanelConfigView
      negocio={demo.negocio}
      hasPassword
      userEmail="demo-owner@salaya.local"
      mpStatus={demo.mpStatus}
      basePath="/panel-demo"
    />
  );
}

import { PanelEquipoView } from "@/components/features/panel/panel-equipo";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoEquipoPage() {
  const demo = await loadPanelDemoBundle();
  return (
    <PanelEquipoView
      initial={demo.team}
      authUrl={process.env.AUTH_URL ?? "http://localhost:3000"}
    />
  );
}

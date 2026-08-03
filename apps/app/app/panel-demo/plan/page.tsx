import { PanelPlanView } from "@/components/features/panel/panel-plan";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

export default async function PanelDemoPlanPage() {
  const demo = await loadPanelDemoBundle();
  return <PanelPlanView data={demo.plan} />;
}

import { redirect } from "next/navigation";

/** Bloqueos se gestionan desde Agenda → Bloquear */
export default function PanelDemoBloqueosRedirect() {
  redirect("/panel-demo");
}

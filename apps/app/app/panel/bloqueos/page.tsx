import { redirect } from "next/navigation";

/** Bloqueos se gestionan desde Agenda → Bloquear */
export default function PanelBloqueosRedirect() {
  redirect("/panel");
}

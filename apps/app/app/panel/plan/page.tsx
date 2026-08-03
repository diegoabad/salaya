import { fetchSuscripcion } from "@/app/actions/suscripcion";
import { PanelPlanView } from "@/components/features/panel/panel-plan";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PanelPlanPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const sub = params.sub;
  const flash = {
    ok: sub === "ok",
    fail: sub === "fail",
  };

  const data = await fetchSuscripcion();
  if (!data) {
    return (
      <p className="text-sm text-muted">
        No se pudo cargar el plan. ¿Está corriendo la API?
      </p>
    );
  }
  return <PanelPlanView data={data} flash={flash} />;
}

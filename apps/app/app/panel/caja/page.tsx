import { fetchAdicionales } from "@/app/actions/adicionales";
import { fetchCajaHoy } from "@/app/actions/caja";
import { fetchPrecios } from "@/app/actions/precios";
import { fetchAgendaHoy } from "@/app/actions/reservas";
import { fetchSalas } from "@/app/actions/salas";
import { PanelCajaView } from "@/components/features/panel/panel-caja";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function paramStr(
  v: string | string[] | undefined,
): string | undefined {
  if (typeof v === "string" && v) return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function PanelCajaPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const fechaParam = paramStr(params.fecha);

  // Sin ?fecha → sesión abierta (si hay) o hoy; con fecha → ese día operativo.
  const caja = await fetchCajaHoy(fechaParam);
  if (!caja) {
    return (
      <p className="text-sm text-muted">
        No se pudo cargar la caja. ¿Está corriendo la API?
      </p>
    );
  }

  const [agenda, adicionales, salasData, precios] = await Promise.all([
    fetchAgendaHoy(caja.fecha),
    fetchAdicionales(),
    fetchSalas(),
    fetchPrecios(),
  ]);

  return (
    <PanelCajaView
      caja={caja}
      turnosHoy={agenda?.reservas ?? []}
      adicionales={adicionales?.adicionales ?? []}
      salas={
        salasData?.salas.map((s) => ({
          id: s.id,
          name: s.name,
          precioHora: s.precioHora,
        })) ?? []
      }
      reglasPrecio={precios?.reglas ?? []}
      basePath="/panel/caja"
    />
  );
}

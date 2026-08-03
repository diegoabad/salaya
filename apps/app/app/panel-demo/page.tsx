import { PanelHoyView } from "@/components/features/panel/panel-hoy";
import { franjaDelDia } from "@/lib/horario-dia";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";

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

export default async function PanelDemoHomePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const fechaParam = paramStr(params.fecha);
  const salaId = paramStr(params.sala) ?? null;
  const demo = await loadPanelDemoBundle();
  const fecha = fechaParam ?? demo.fecha;
  const franja = franjaDelDia(fecha, demo.negocio.horarios);

  // Los turnos demo son del día ancla; otros días se muestran vacíos.
  const reservasDelDia = fecha === demo.fecha ? demo.reservas : [];
  const bloqueosDelDia = demo.bloqueos.filter((b) => b.fecha === fecha);

  return (
    <PanelHoyView
      fecha={fecha}
      reservas={reservasDelDia}
      salas={demo.salas.map((s) => ({
        id: s.id,
        name: s.name,
        precioHora: s.precioHora,
        duracionMinMinutos: s.duracionMinMinutos,
        duracionMaxMinutos: s.duracionMaxMinutos,
        granularidadMinutos: s.granularidadMinutos,
      }))}
      adicionales={demo.adicionales}
      reglasPrecio={demo.precios.reglas}
      bloqueos={bloqueosDelDia}
      clientes={demo.clientes}
      duracionMinMinutos={demo.negocio.politica?.duracionMinMinutos ?? 60}
      duracionMaxMinutos={demo.negocio.politica?.duracionMaxMinutos ?? 240}
      granularidadMinutos={60}
      horaApertura={franja.apertura}
      horaCierre={franja.cierre}
      diaCerrado={franja.cerrado}
      basePath="/panel-demo"
      salaIdInicial={salaId}
    />
  );
}

import type { CajaDiaDto } from "@/app/actions/caja";
import { PanelCajaView } from "@/components/features/panel/panel-caja";
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

function emptyCaja(fecha: string): CajaDiaDto {
  return {
    fecha,
    abierta: false,
    cerradaAt: null,
    inicioCaja: 0,
    ingresos: 0,
    egresos: 0,
    total: 0,
    porMedio: {},
    movimientos: [],
  };
}

export default async function PanelDemoCajaPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const fechaParam = paramStr(params.fecha);
  const demo = await loadPanelDemoBundle();
  const fecha = fechaParam ?? demo.fecha;
  const esDiaAncla = fecha === demo.fecha;

  return (
    <PanelCajaView
      caja={esDiaAncla ? demo.caja : emptyCaja(fecha)}
      turnosHoy={esDiaAncla ? demo.reservas : []}
      adicionales={demo.adicionales}
      salas={demo.salas}
      reglasPrecio={demo.precios.reglas}
      isDemo
      basePath="/panel-demo/caja"
    />
  );
}

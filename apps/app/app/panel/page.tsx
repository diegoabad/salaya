import { fetchAdicionales } from "@/app/actions/adicionales";
import { fetchBloqueos } from "@/app/actions/bloqueos";
import { fetchClientes } from "@/app/actions/clientes";
import { fetchHorariosEspeciales, fetchNegocio } from "@/app/actions/negocio";
import { fetchPrecios } from "@/app/actions/precios";
import { fetchAgendaHoy } from "@/app/actions/reservas";
import { fetchSalas } from "@/app/actions/salas";
import { PanelHoyView } from "@/components/features/panel/panel-hoy";
import { franjaDelDia } from "@/lib/horario-dia";
import Link from "next/link";

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

export default async function PanelHomePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const fecha = paramStr(params.fecha);
  const salaId = paramStr(params.sala) ?? null;

  const [
    negocio,
    agenda,
    salasData,
    adicionales,
    especiales,
    precios,
    bloqueos,
    clientes,
  ] = await Promise.all([
    fetchNegocio(),
    fetchAgendaHoy(fecha),
    fetchSalas(),
    fetchAdicionales(),
    fetchHorariosEspeciales(),
    fetchPrecios(),
    fetchBloqueos(),
    fetchClientes(),
  ]);
  const salasCount = negocio?.salasCount ?? 0;
  const franja = agenda
    ? franjaDelDia(agenda.fecha, negocio?.horarios ?? [], especiales)
    : { apertura: null, cierre: null, cerrado: false };
  const salas =
    salasData?.salas.map((s) => ({
      id: s.id,
      name: s.name,
      precioHora: s.precioHora,
      duracionMinMinutos: s.duracionMinMinutos,
      duracionMaxMinutos: s.duracionMaxMinutos,
      granularidadMinutos: s.granularidadMinutos,
    })) ?? [];

  const bloqueosDelDia =
    agenda && bloqueos
      ? bloqueos.filter((b) => b.fecha === agenda.fecha)
      : [];

  return (
    <>
      {salasCount === 0 ? (
        <div className="mb-6 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-4">
          <p className="font-medium text-ink">Próximo paso: creá tu primera sala</p>
          <p className="mt-1 text-sm text-muted">
            Completá el negocio en Configuración y sumá salas para publicar.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/panel/configuracion"
              className="text-sm font-semibold text-brand underline"
            >
              Configurar negocio
            </Link>
            <Link
              href="/panel/salas"
              className="text-sm font-semibold text-brand underline"
            >
              Crear salas
            </Link>
          </div>
        </div>
      ) : null}

      {agenda ? (
        <PanelHoyView
          fecha={agenda.fecha}
          reservas={agenda.reservas}
          salas={salas}
          adicionales={adicionales?.adicionales ?? []}
          reglasPrecio={precios?.reglas ?? []}
          bloqueos={bloqueosDelDia}
          clientes={clientes ?? []}
          duracionMinMinutos={negocio?.politica?.duracionMinMinutos ?? 60}
          duracionMaxMinutos={negocio?.politica?.duracionMaxMinutos ?? 240}
          granularidadMinutos={60}
          horaApertura={franja.apertura}
          horaCierre={franja.cierre}
          diaCerrado={franja.cerrado}
          basePath="/panel"
          salaIdInicial={salaId}
        />
      ) : (
        <p className="text-sm text-muted">
          No se pudo cargar la agenda. ¿Está corriendo la API?
        </p>
      )}
    </>
  );
}

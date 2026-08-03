"use client";

import {
  cerrarCajaAction,
  createMovimientoAction,
  type CajaDiaDto,
  type MovimientoDto,
  type MovimientoTipoUi,
} from "@/app/actions/caja";
import type { AdicionalDto } from "@/app/actions/adicionales";
import type { ReglaPrecioDto } from "@/app/actions/precios";
import {
  reprogramarReservaAction,
  updateReservaAdicionalesAction,
  type AgendaReservaDto,
} from "@/app/actions/reservas";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { DatePicker } from "@/components/ui/date-picker";
import { FilterSelect } from "@/components/ui/filter-select";
import { Modal } from "@/components/ui/modal";
import { cotizarPrecioSala } from "@/lib/cotizar-precio";
import { formatPrecio } from "@/lib/directorio-data";
import { fechaHoyIso } from "@/lib/fechas";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type SalaCaja = { id: string; name: string; precioHora: number | string | null };
type AdicSel = Record<string, number>;

function shiftYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function parseHhMm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function hhmm(mins: number): string {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function duracionHorasEntre(start: string, end: string): number {
  let mins = parseHhMm(end) - parseHhMm(start);
  if (mins <= 0) mins += 24 * 60;
  return Math.max(0.25, mins / 60);
}

function adicionalesTotal(
  adicionales: AdicionalDto[],
  sel: AdicSel,
  duracionHoras: number,
) {
  return adicionales.reduce((acc, a) => {
    const qty = sel[a.id] ?? 0;
    if (qty <= 0) return acc;
    const unit =
      a.modalidad === "por_hora" ? a.precio * duracionHoras : a.precio;
    return acc + unit * qty;
  }, 0);
}

function formatFechaLarga(fecha: string) {
  const label = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${fecha}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function conceptoLabel(c: string) {
  switch (c) {
    case "sena":
      return "Seña";
    case "saldo":
      return "Saldo";
    case "reembolso":
      return "Reembolso";
    case "ajuste":
      return "Ajuste";
    case "egreso":
      return "Egreso";
    case "inicio_caja":
      return "Inicio de caja";
    case "cierre_caja":
      return "Cierre de caja";
    case "credito":
      return "Crédito a favor";
    case "membresia":
      return "Abono";
    default:
      return c;
  }
}

function medioLabel(m: string) {
  switch (m) {
    case "efectivo":
      return "Efectivo";
    case "transferencia":
      return "Transferencia";
    case "mercadopago":
      return "Mercado Pago";
    case "tarjeta":
      return "Tarjeta";
    default:
      return m;
  }
}

function formatHoraMov(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function esSalida(tipo: string) {
  return tipo === "egreso" || tipo === "reembolso";
}

function esInicio(tipo: string) {
  return tipo === "inicio_caja";
}

function esCierre(tipo: string) {
  return tipo === "cierre_caja";
}

function recomputeCaja(
  prev: CajaDiaDto,
  movimientos: MovimientoDto[],
  extra?: Partial<CajaDiaDto>,
): CajaDiaDto {
  const inicioCaja = movimientos
    .filter((x) => esInicio(x.tipo))
    .reduce((a, x) => a + x.monto, 0);
  const ingresos = movimientos
    .filter((x) => !esSalida(x.tipo) && !esInicio(x.tipo) && !esCierre(x.tipo))
    .reduce((a, x) => a + x.monto, 0);
  const egresos = movimientos
    .filter((x) => esSalida(x.tipo))
    .reduce((a, x) => a + x.monto, 0);
  const porMedio: Record<string, number> = {};
  for (const m of movimientos) {
    if (esCierre(m.tipo)) continue;
    const signed = esSalida(m.tipo) ? -m.monto : m.monto;
    porMedio[m.medioPago] = (porMedio[m.medioPago] ?? 0) + signed;
  }
  return {
    ...prev,
    movimientos,
    inicioCaja,
    ingresos,
    egresos,
    total: inicioCaja + ingresos - egresos,
    porMedio,
    ...extra,
  };
}

function montoSugeridoTurno(
  t: AgendaReservaDto,
  tipo: MovimientoTipoUi,
): string {
  if (tipo === "saldo" && t.saldo > 0) return String(t.saldo);
  if (tipo === "sena" && t.senaPagada <= 0 && t.precioTotal > 0) {
    // Sin seña cargada: sugerir ~30% o el saldo si es menor
    const sug = Math.min(t.saldo || t.precioTotal, Math.round(t.precioTotal * 0.3));
    return String(sug);
  }
  if (tipo === "sena" && t.saldo > 0) return String(Math.min(t.saldo, t.precioTotal));
  return t.saldo > 0 ? String(t.saldo) : "";
}

type SortKey = "recientes" | "antiguos" | "monto_desc" | "monto_asc";

type Props = {
  caja: CajaDiaDto;
  turnosHoy?: AgendaReservaDto[];
  adicionales?: AdicionalDto[];
  salas?: SalaCaja[];
  reglasPrecio?: ReglaPrecioDto[];
  isDemo?: boolean;
  basePath?: string;
};

export function PanelCajaView({
  caja,
  turnosHoy = [],
  adicionales = [],
  salas = [],
  reglasPrecio = [],
  isDemo = false,
  basePath = "/panel/caja",
}: Props) {
  const router = useRouter();
  const [local, setLocal] = useState(caja);
  useEffect(() => {
    setLocal(caja);
  }, [caja]);

  const fecha = local.fecha;
  const abierta = local.abierta;
  const { movimientos, porMedio, inicioCaja, ingresos, egresos } = local;

  const goFecha = (next: string) => {
    const q = new URLSearchParams();
    q.set("fecha", next);
    router.push(`${basePath}?${q.toString()}`);
  };

  /** Total del día = inicio + ingresos − egresos */
  const totalCorrecto = inicioCaja + ingresos - egresos;

  const [open, setOpen] = useState(false);
  const [openCerrar, setOpenCerrar] = useState(false);
  const [modo, setModo] = useState<"movimiento" | "inicio">("movimiento");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<MovimientoTipoUi>("saldo");
  const [salaFiltro, setSalaFiltro] = useState("");
  const [reservaId, setReservaId] = useState("");
  const [monto, setMonto] = useState("");
  const [sort, setSort] = useState<SortKey>("recientes");
  const [endsEdit, setEndsEdit] = useState("");
  const [adicSel, setAdicSel] = useState<AdicSel>({});

  const yaHayInicio = useMemo(
    () => movimientos.some((m) => esInicio(m.tipo)),
    [movimientos],
  );
  const yaHayCierre = useMemo(
    () => movimientos.some((m) => esCierre(m.tipo)),
    [movimientos],
  );
  /** Cerrada = solo lectura. Sin abrir o abierta = se puede cargar. */
  const puedeEditar = !yaHayCierre;
  const esHoy = fecha === fechaHoyIso();
  const puedeIniciar = esHoy && !yaHayInicio && !yaHayCierre;

  const salasOpciones = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of turnosHoy) {
      if (t.salaId) map.set(t.salaId, t.salaName);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [turnosHoy]);

  const turnosFiltrados = useMemo(() => {
    const list = salaFiltro
      ? turnosHoy.filter((t) => t.salaId === salaFiltro)
      : turnosHoy;
    return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [turnosHoy, salaFiltro]);

  const turnoSel = useMemo(
    () => turnosFiltrados.find((t) => t.id === reservaId) ?? null,
    [turnosFiltrados, reservaId],
  );

  const salaSel = useMemo(
    () =>
      turnoSel
        ? (salas.find((s) => s.id === turnoSel.salaId) ?? null)
        : null,
    [salas, turnoSel],
  );

  const duracionEditHoras = useMemo(() => {
    if (!turnoSel || !endsEdit) return 1;
    return duracionHorasEntre(turnoSel.startsAt, endsEdit);
  }, [turnoSel, endsEdit]);

  const precioSalaEdit = useMemo(() => {
    if (!turnoSel || !endsEdit) return 0;
    return cotizarPrecioSala({
      precioHoraBase: salaSel?.precioHora ?? null,
      reglas: reglasPrecio,
      salaId: turnoSel.salaId,
      fecha,
      horaInicio: turnoSel.startsAt,
      horaFin: endsEdit,
    });
  }, [turnoSel, endsEdit, salaSel, reglasPrecio, fecha]);

  const precioAdicEdit = useMemo(
    () => adicionalesTotal(adicionales, adicSel, duracionEditHoras),
    [adicionales, adicSel, duracionEditHoras],
  );

  const totalEdit = precioSalaEdit + precioAdicEdit;
  const saldoEdit = turnoSel
    ? Math.max(0, totalEdit - turnoSel.senaPagada)
    : 0;

  const tiempoDirty = Boolean(
    turnoSel && endsEdit && endsEdit !== turnoSel.endsAt,
  );
  const adicDirty = useMemo(() => {
    if (!turnoSel) return false;
    const ids = new Set([
      ...Object.keys(adicSel),
      ...turnoSel.adicionales.map((a) => a.id),
    ]);
    for (const id of ids) {
      const cur = adicSel[id] ?? 0;
      const orig =
        turnoSel.adicionales.find((a) => a.id === id)?.cantidad ?? 0;
      if (cur !== orig) return true;
    }
    return false;
  }, [turnoSel, adicSel]);

  const syncMontoDesdeSaldo = (saldo: number) => {
    if (tipo === "saldo" || tipo === "sena") {
      setMonto(saldo > 0 ? String(Math.round(saldo * 100) / 100) : "");
    }
  };

  useEffect(() => {
    if (!turnoSel || !(tipo === "saldo" || tipo === "sena")) return;
    if (tiempoDirty || adicDirty) {
      syncMontoDesdeSaldo(saldoEdit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar cotización
  }, [saldoEdit, tiempoDirty, adicDirty, tipo, turnoSel?.id]);

  const movimientosOrdenados = useMemo(() => {
    const list = [...movimientos];
    switch (sort) {
      case "antiguos":
        return list.sort(
          (a, b) =>
            new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
        );
      case "monto_desc":
        return list.sort((a, b) => b.monto - a.monto);
      case "monto_asc":
        return list.sort((a, b) => a.monto - b.monto);
      case "recientes":
      default:
        return list.sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        );
    }
  }, [movimientos, sort]);

  const abrirMovimiento = () => {
    if (!puedeEditar) return;
    setModo("movimiento");
    setTipo("saldo");
    setSalaFiltro("");
    setReservaId("");
    setMonto("");
    setEndsEdit("");
    setAdicSel({});
    setError(null);
    setOpen(true);
  };

  const abrirInicio = () => {
    if (!puedeIniciar) return;
    setModo("inicio");
    setTipo("inicio_caja");
    setSalaFiltro("");
    setReservaId("");
    setMonto("");
    setEndsEdit("");
    setAdicSel({});
    setError(null);
    setOpen(true);
  };

  const confirmarCerrar = () => {
    setError(null);
    start(async () => {
      if (isDemo) {
        const hhmm = new Intl.DateTimeFormat("en-GB", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date());
        const occurredAt = new Date().toISOString();
        setLocal((prev) => {
          const mov: MovimientoDto = {
            id: `demo-cierre-${Date.now()}`,
            tipo: "cierre_caja",
            estado: "cobrado",
            medioPago: "efectivo",
            monto: prev.inicioCaja + prev.ingresos - prev.egresos,
            descripcion: "Cierre de caja",
            occurredAt:
              prev.fecha === fechaHoyIso()
                ? occurredAt
                : `${prev.fecha}T${hhmm}:00.000-03:00`,
            reservaId: null,
            clienteNombre: "—",
            salaName: null,
            turnoStartsAt: null,
            turnoEndsAt: null,
          };
          return recomputeCaja(prev, [mov, ...prev.movimientos], {
            abierta: false,
            cerradaAt: mov.occurredAt,
          });
        });
        setOpenCerrar(false);
        return;
      }
      const res = await cerrarCajaAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpenCerrar(false);
      router.refresh();
    });
  };

  const onPickTurno = (id: string) => {
    setReservaId(id);
    const t = turnosFiltrados.find((x) => x.id === id);
    if (!t) {
      setMonto("");
      setEndsEdit("");
      setAdicSel({});
      return;
    }
    setEndsEdit(t.endsAt);
    const sel: AdicSel = {};
    for (const a of t.adicionales) sel[a.id] = a.cantidad;
    setAdicSel(sel);
    setMonto(montoSugeridoTurno(t, tipo));
  };

  const onChangeTipo = (next: MovimientoTipoUi) => {
    setTipo(next);
    if (turnoSel && (next === "saldo" || next === "sena")) {
      if (tiempoDirty || adicDirty) {
        syncMontoDesdeSaldo(saldoEdit);
      } else {
        setMonto(montoSugeridoTurno(turnoSel, next));
      }
    }
  };

  const extenderFin = (mins: number) => {
    if (!turnoSel) return;
    const base = endsEdit || turnoSel.endsAt;
    setEndsEdit(hhmm(parseHhMm(base) + mins));
  };

  const medios = [
    ["efectivo", "Efectivo"],
    ["transferencia", "Transferencia"],
    ["mercadopago", "Mercado Pago"],
    ["tarjeta", "Tarjeta"],
  ] as const;

  return (
    <PanelPage
      title="Caja"
      description={
        abierta
          ? undefined
          : yaHayCierre
            ? "Caja cerrada · solo consulta"
            : "Cobros del día ligados a turnos"
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {puedeIniciar ? (
            <PanelButton variant="ghost" onClick={abrirInicio}>
              Inicio de caja
            </PanelButton>
          ) : null}
          {abierta && yaHayInicio ? (
            <PanelButton variant="ghost" onClick={() => setOpenCerrar(true)}>
              Cerrar caja
            </PanelButton>
          ) : null}
          <PanelButton onClick={abrirMovimiento} disabled={!puedeEditar}>
            + Movimiento
          </PanelButton>
        </div>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Total" value={totalCorrecto} emphasis />
        <MiniStat label="Inicio" value={inicioCaja} />
        <MiniStat label="Ingresos" value={ingresos} />
        <MiniStat label="Egresos" value={egresos} negative />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {medios.map(([key, label]) => (
          <MiniStat key={key} label={label} value={porMedio[key] ?? 0} />
        ))}
      </div>

      <div className="mb-3 grid min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Movimientos</h2>
          <p className="text-xs text-muted">
            {movimientos.length === 0
              ? "Sin movimientos todavía"
              : `${movimientos.length} registro${movimientos.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => goFecha(shiftYmd(fecha, -1))}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-brand/40"
          >
            ←
          </button>
          <div className="w-[11.5rem] min-w-0 sm:w-[13rem]">
            <DatePicker
              compact
              value={fecha}
              onChange={(v) => {
                if (v) goFecha(v);
              }}
              aria-label="Fecha de la caja"
            />
          </div>
          <button
            type="button"
            aria-label="Día siguiente"
            onClick={() => goFecha(shiftYmd(fecha, 1))}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-brand/40"
          >
            →
          </button>
          {fecha !== fechaHoyIso() ? (
            <button
              type="button"
              onClick={() => goFecha(fechaHoyIso())}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-brand/40"
            >
              Hoy
            </button>
          ) : null}
        </div>

        <div className="flex min-w-0 justify-start sm:justify-end">
          <div className="w-40 min-w-0 sm:w-44">
            <FilterSelect
              className="min-w-0! max-w-full! sm:min-w-0! sm:max-w-full! sm:flex-none!"
              aria-label="Ordenar movimientos"
              placeholder="Ordenar"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "recientes", label: "Más recientes" },
                { value: "antiguos", label: "Más antiguos" },
                { value: "monto_desc", label: "Mayor monto" },
                { value: "monto_asc", label: "Menor monto" },
              ]}
            />
          </div>
        </div>
      </div>

      {movimientosOrdenados.length === 0 ? (
        <PanelEmpty>
          Registrá el inicio de caja o un cobro. Las señas y saldos de la agenda
          también aparecen acá.
        </PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {movimientosOrdenados.map((m) => (
            <MovimientoRow key={m.id} m={m} />
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={modo === "inicio" ? "Inicio de caja" : "Nuevo movimiento"}
        placement="center"
        className={`max-w-[calc(100vw-1.25rem)]! overflow-x-hidden ${
          modo === "inicio"
            ? "sm:max-w-lg!"
            : "sm:max-w-4xl! max-h-[min(94vh,52rem)]!"
        }`}
        headerClassName="px-5 py-4 sm:px-6 sm:py-5"
        bodyClassName="overflow-x-hidden px-5 py-4 sm:px-6 sm:py-5"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Monto</span>
                <input
                  form="caja-mov-form"
                  name="monto"
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  inputMode="decimal"
                  placeholder="1500.00"
                  className="w-full min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5 text-base tabular-nums"
                />
                {turnoSel && (tipo === "saldo" || tipo === "sena") ? (
                  <span className="text-[11px] text-muted">
                    {tiempoDirty || adicDirty
                      ? "Se actualiza al cambiar tiempo/adicionales"
                      : "Sugerido del turno · podés editarlo"}
                  </span>
                ) : null}
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Nota</span>
                <input
                  form="caja-mov-form"
                  name="descripcion"
                  placeholder={
                    modo === "inicio" ? "Ej. Fondo inicial" : "Opcional"
                  }
                  className="w-full min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              <PanelButton
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </PanelButton>
              <PanelButton
                type="submit"
                form="caja-mov-form"
                disabled={pending}
              >
                {pending ? "Guardando…" : "Registrar"}
              </PanelButton>
            </div>
          </div>
        }
      >
        <form
          id="caja-mov-form"
          data-demo-allow="true"
          className="flex min-w-0 flex-col gap-5 overflow-x-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const medioPago = String(fd.get("medioPago") ?? "efectivo") as
              | "efectivo"
              | "transferencia"
              | "mercadopago"
              | "tarjeta";
            const descripcion =
              String(fd.get("descripcion") ?? "").trim() || null;
            const tipoFinal: MovimientoTipoUi =
              modo === "inicio" ? "inicio_caja" : tipo;
            const reservaFinal =
              modo === "inicio" || !reservaId ? null : reservaId;
            const montoFinal = monto.trim();

            setError(null);
            start(async () => {
              let montoCobrar = montoFinal;
              let endsFinal = endsEdit || turnoSel?.endsAt || null;
              let adicFinal = adicSel;

              if (
                !isDemo &&
                reservaFinal &&
                turnoSel &&
                (tipoFinal === "saldo" || tipoFinal === "sena")
              ) {
                if (tiempoDirty && endsFinal) {
                  const repro = await reprogramarReservaAction({
                    reservaId: reservaFinal,
                    fecha,
                    horaInicio: turnoSel.startsAt,
                    horaFin: endsFinal,
                  });
                  if (!repro.ok) {
                    setError(repro.error);
                    return;
                  }
                  if (tipoFinal === "saldo" && repro.saldo > 0) {
                    montoCobrar = String(repro.saldo);
                  }
                }

                if (adicDirty) {
                  const pedidos = Object.entries(adicFinal)
                    .filter(([, q]) => q > 0)
                    .map(([id, cantidad]) => ({ id, cantidad }));
                  const adicRes = await updateReservaAdicionalesAction({
                    reservaId: reservaFinal,
                    adicionales: pedidos,
                  });
                  if (!adicRes.ok) {
                    setError(adicRes.error);
                    return;
                  }
                  if (tipoFinal === "saldo") {
                    montoCobrar = String(adicRes.saldo);
                  }
                }
              }

              if (isDemo) {
                const occurredAt = new Date().toISOString();
                const turno = turnosHoy.find((t) => t.id === reservaFinal);
                const montoNum = Math.abs(
                  Number(montoCobrar.replace(",", ".")) || 0,
                );
                setLocal((prev) => {
                  const mov: MovimientoDto = {
                    id: `demo-m-${Date.now()}`,
                    tipo: tipoFinal,
                    estado: "cobrado",
                    medioPago,
                    monto: montoNum,
                    descripcion:
                      modo === "inicio"
                        ? (descripcion ?? "Apertura de caja")
                        : descripcion ??
                          (tiempoDirty
                            ? `Extensión hasta ${endsFinal}`
                            : adicDirty
                              ? "Adicionales / ajuste de turno"
                              : null),
                    occurredAt,
                    reservaId: reservaFinal,
                    clienteNombre: turno?.clienteNombre ?? "—",
                    salaName: turno?.salaName ?? null,
                    turnoStartsAt: turno?.startsAt ?? null,
                    turnoEndsAt: endsFinal ?? turno?.endsAt ?? null,
                  };
                  return recomputeCaja(prev, [mov, ...prev.movimientos], {
                    abierta:
                      tipoFinal === "inicio_caja" ? true : prev.abierta,
                  });
                });
                setOpen(false);
                return;
              }

              const res = await createMovimientoAction({
                tipo: tipoFinal,
                medioPago,
                monto: montoCobrar,
                reservaId: reservaFinal,
                fecha,
                descripcion:
                  modo === "inicio"
                    ? (descripcion ?? "Apertura de caja")
                    : descripcion,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {modo === "inicio" ? (
            <>
              <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3">
                <p className="text-sm text-ink">
                  Registrá el fondo con el que abrís la caja hoy. Suma al total
                  del día.
                </p>
              </div>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Medio</span>
                <select
                  name="medioPago"
                  className="w-full min-w-0 max-w-full rounded-xl border border-line bg-paper px-3 py-2.5"
                  defaultValue="efectivo"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mercadopago">Mercado Pago</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">Concepto</span>
                  <select
                    value={tipo}
                    onChange={(e) =>
                      onChangeTipo(e.target.value as MovimientoTipoUi)
                    }
                    className="w-full min-w-0 max-w-full rounded-xl border border-line bg-paper px-3 py-2.5"
                  >
                    <option value="saldo">Saldo de turno</option>
                    <option value="sena">Seña</option>
                    <option value="ajuste">Ajuste</option>
                    <option value="egreso">Egreso</option>
                    <option value="reembolso">Reembolso</option>
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">Medio</span>
                  <select
                    name="medioPago"
                    className="w-full min-w-0 max-w-full rounded-xl border border-line bg-paper px-3 py-2.5"
                    defaultValue="efectivo"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="mercadopago">Mercado Pago</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </label>
              </div>

              {(tipo === "saldo" || tipo === "sena") &&
              turnosHoy.length > 0 ? (
                <div className="min-w-0 space-y-4">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <label className="flex min-w-0 flex-col gap-1 text-sm">
                      <span className="font-medium text-muted">Sala</span>
                      <select
                        value={salaFiltro}
                        onChange={(e) => {
                          setSalaFiltro(e.target.value);
                          setReservaId("");
                          setMonto("");
                        }}
                        className="w-full min-w-0 max-w-full rounded-xl border border-line bg-paper px-3 py-2.5"
                      >
                        <option value="">Todas las salas</option>
                        {salasOpciones.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-sm">
                      <span className="font-medium text-muted">Turno</span>
                      <select
                        value={reservaId}
                        onChange={(e) => onPickTurno(e.target.value)}
                        className="w-full min-w-0 max-w-full rounded-xl border border-line bg-paper px-3 py-2.5"
                      >
                        <option value="">Sin turno</option>
                        {turnosFiltrados.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.startsAt} {t.clienteNombre}
                            {t.saldo > 0 ? ` · ${formatPrecio(t.saldo)}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {turnoSel ? (
                    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                      <div className="min-w-0 space-y-4">
                        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
                          <p className="text-base font-semibold text-ink">
                            {turnoSel.clienteNombre}
                          </p>
                          <p className="mt-0.5 text-sm text-muted">
                            {turnoSel.salaName}
                          </p>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-surface/80 px-2 py-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                                Inicio
                              </p>
                              <p className="mt-1 font-display text-xl tabular-nums text-ink">
                                {turnoSel.startsAt}
                              </p>
                            </div>
                            <div className="rounded-xl bg-surface/80 px-2 py-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                                Fin
                              </p>
                              <p
                                className={`mt-1 font-display text-xl tabular-nums ${
                                  tiempoDirty ? "text-brand" : "text-ink"
                                }`}
                              >
                                {endsEdit || turnoSel.endsAt}
                              </p>
                            </div>
                            <div className="rounded-xl bg-surface/80 px-2 py-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                                Duración
                              </p>
                              <p className="mt-1 font-display text-xl tabular-nums text-ink">
                                {formatDuracionCorta(duracionEditHoras)}
                              </p>
                            </div>
                          </div>
                          <TurnoTimeline
                            start={turnoSel.startsAt}
                            endOrig={turnoSel.endsAt}
                            endEdit={endsEdit || turnoSel.endsAt}
                          />
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <span className="text-muted">
                              Total{" "}
                              <span className="font-semibold text-brand">
                                {formatPrecio(
                                  totalEdit || turnoSel.precioTotal,
                                )}
                              </span>
                            </span>
                            <span className="text-muted">
                              Saldo{" "}
                              <span className="font-semibold text-brand">
                                {formatPrecio(
                                  tiempoDirty || adicDirty
                                    ? saldoEdit
                                    : turnoSel.saldo,
                                )}
                              </span>
                            </span>
                            {turnoSel.senaPagada > 0 ? (
                              <span className="text-muted">
                                Seña{" "}
                                <span className="font-medium text-ink">
                                  {formatPrecio(turnoSel.senaPagada)}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-line bg-paper p-4">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                Extender tiempo
                              </p>
                              <p className="mt-0.5 text-xs text-muted">
                                Sumá al fin del turno y recalculá el saldo
                              </p>
                            </div>
                            {tiempoDirty ? (
                              <button
                                type="button"
                                onClick={() => setEndsEdit(turnoSel.endsAt)}
                                className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-brand/40 hover:text-ink"
                              >
                                Restablecer
                              </button>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(
                              [
                                { mins: 30, label: "+30 min" },
                                { mins: 60, label: "+1 h" },
                                { mins: 120, label: "+2 h" },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.mins}
                                type="button"
                                onClick={() => extenderFin(opt.mins)}
                                className="rounded-2xl border border-line bg-surface px-3 py-3 text-center transition-colors hover:border-brand/50 hover:bg-brand/5"
                              >
                                <p className="font-display text-lg text-ink">
                                  {opt.label}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted">
                                  →{" "}
                                  {hhmm(
                                    parseHhMm(endsEdit || turnoSel.endsAt) +
                                      opt.mins,
                                  )}
                                </p>
                              </button>
                            ))}
                          </div>
                          {tiempoDirty ? (
                            <p className="mt-3 rounded-xl bg-brand/10 px-3 py-2 text-center text-sm text-ink">
                              Nuevo fin{" "}
                              <span className="font-semibold text-brand">
                                {endsEdit}
                              </span>
                              {" · "}+
                              {Math.round(
                                (duracionEditHoras -
                                  duracionHorasEntre(
                                    turnoSel.startsAt,
                                    turnoSel.endsAt,
                                  )) *
                                  60,
                              )}{" "}
                              min
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <CajaAdicionalesPicker
                          adicionales={adicionales}
                          sel={adicSel}
                          onChange={setAdicSel}
                          duracionHoras={duracionEditHoras}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line bg-paper/60 px-4 py-6 text-center text-sm text-muted">
                      Elegí un turno para ver el horario, extender tiempo y
                      gestionar adicionales.
                    </p>
                  )}
                </div>
              ) : null}
            </>
          )}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={openCerrar}
        onClose={() => setOpenCerrar(false)}
        title="Cerrar caja"
        placement="center"
        className="max-w-[calc(100vw-2rem)]! sm:max-w-md!"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Vas a cerrar la caja del{" "}
            <span className="font-medium text-ink">
              {formatFechaLarga(fecha)}
            </span>
            . Hasta que no la cierres, los cobros de madrugada siguen contando
            en este día.
          </p>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted">
              Total a cerrar
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-brand">
              {formatPrecio(totalCorrecto)}
            </p>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <PanelButton
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpenCerrar(false)}
            >
              Seguir abierta
            </PanelButton>
            <PanelButton
              type="button"
              disabled={pending}
              onClick={confirmarCerrar}
            >
              {pending ? "Cerrando…" : "Cerrar caja"}
            </PanelButton>
          </div>
        </div>
      </Modal>
    </PanelPage>
  );
}

function formatDuracionCorta(horas: number) {
  const mins = Math.round(horas * 60);
  if (mins % 60 === 0) return `${mins / 60} h`;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${m} m`;
}

function TurnoTimeline({
  start,
  endOrig,
  endEdit,
}: {
  start: string;
  endOrig: string;
  endEdit: string;
}) {
  const s = parseHhMm(start);
  let e0 = parseHhMm(endOrig);
  let e1 = parseHhMm(endEdit);
  if (e0 <= s) e0 += 24 * 60;
  if (e1 <= s) e1 += 24 * 60;
  const endMax = Math.max(e0, e1);
  const span = Math.max(endMax - s, 1);
  const basePct = Math.min(100, ((e0 - s) / span) * 100);
  const extPct = Math.min(100, ((e1 - s) / span) * 100);
  const extended = e1 > e0;

  return (
    <div className="mt-4">
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand/35"
          style={{ width: `${basePct}%` }}
        />
        {extended ? (
          <div
            className="absolute inset-y-0 rounded-full bg-brand"
            style={{ left: `${basePct}%`, width: `${Math.max(0, extPct - basePct)}%` }}
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
        <span>{start}</span>
        <span className={extended ? "font-medium text-brand" : ""}>
          {endEdit}
          {extended ? ` (+${e1 - e0} min)` : ""}
        </span>
      </div>
    </div>
  );
}

function CajaAdicionalesPicker({
  adicionales,
  sel,
  onChange,
  duracionHoras,
}: {
  adicionales: AdicionalDto[];
  sel: AdicSel;
  onChange: (next: AdicSel) => void;
  duracionHoras: number;
}) {
  const activos = adicionales.filter((a) => a.active);
  const seleccionados = activos.filter((a) => (sel[a.id] ?? 0) > 0);
  const qtyTotal = seleccionados.reduce((acc, a) => acc + (sel[a.id] ?? 0), 0);
  const extra = adicionalesTotal(adicionales, sel, duracionHoras);

  const porGrupo = (() => {
    const map = new Map<string, AdicionalDto[]>();
    for (const a of activos) {
      const key = a.grupo || "Otros";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return [...map.entries()];
  })();

  if (activos.length === 0) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-line bg-paper px-4 text-center text-sm text-muted">
        No hay adicionales cargados.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Adicionales</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {qtyTotal > 0
              ? `${qtyTotal} seleccionado${qtyTotal === 1 ? "" : "s"} · ${formatPrecio(extra)}`
              : "Ninguno seleccionado"}
          </p>
        </div>
        {qtyTotal > 0 ? (
          <span className="shrink-0 rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
            {qtyTotal}
          </span>
        ) : null}
      </div>

      <div className="max-h-[22rem] space-y-4 overflow-y-auto overscroll-contain px-3 py-3 lg:max-h-[28rem]">
        {porGrupo.map(([grupo, items]) => (
          <div key={grupo}>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              {grupo}
            </p>
            <ul className="space-y-2">
              {items.map((a) => {
                const qty = sel[a.id] ?? 0;
                const unit =
                  a.modalidad === "por_hora"
                    ? a.precio * duracionHoras
                    : a.precio;
                const line = unit * Math.max(qty, 1);
                return (
                  <li
                    key={a.id}
                    className={`flex items-center gap-3 rounded-xl border px-2.5 py-2.5 transition-colors ${
                      qty > 0
                        ? "border-brand/40 bg-brand/5"
                        : "border-line bg-surface"
                    }`}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
                      {a.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.photoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                          Sin foto
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {a.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatPrecio(a.precio)}
                        {a.modalidad === "por_hora" ? "/h" : ""}
                        {qty > 0 ? ` · ${formatPrecio(line)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Quitar ${a.name}`}
                        disabled={qty <= 0}
                        onClick={() =>
                          onChange({ ...sel, [a.id]: Math.max(0, qty - 1) })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Sumar ${a.name}`}
                        onClick={() => onChange({ ...sel, [a.id]: qty + 1 })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedioChip({ medio }: { medio: string }) {
  const styles: Record<string, string> = {
    efectivo: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    transferencia: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    mercadopago: "border-cyan-400/45 bg-cyan-400/10 text-cyan-200",
    tarjeta: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        styles[medio] ?? "border-line bg-surface-2 text-muted"
      }`}
    >
      {medioLabel(medio)}
    </span>
  );
}

function MovimientoRow({ m }: { m: MovimientoDto }) {
  const salida = esSalida(m.tipo);
  const inicio = esInicio(m.tipo);
  const cierre = esCierre(m.tipo);
  const ocultarMedio = inicio || cierre || m.tipo === "egreso";
  const turnoLabel =
    m.turnoStartsAt && m.turnoEndsAt
      ? `${m.turnoStartsAt}–${m.turnoEndsAt}`
      : null;

  return (
    <li
      className={`rounded-2xl border px-4 py-3 ${
        inicio
          ? "border-brand/35 bg-brand/5"
          : cierre
            ? "border-line bg-surface-2"
            : salida
              ? "border-red-500/25 bg-red-500/5"
              : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-muted">
              {formatHoraMov(m.occurredAt)}
            </span>
            <PanelBadge
              tone={
                inicio ? "brand" : cierre ? "neutral" : salida ? "danger" : "brand"
              }
            >
              {conceptoLabel(m.tipo)}
            </PanelBadge>
            {!ocultarMedio ? <MedioChip medio={m.medioPago} /> : null}
          </div>

          {m.reservaId ? (
            <p className="mt-2 text-sm font-medium text-ink">
              {m.clienteNombre}
              {m.salaName ? (
                <span className="font-normal text-muted">
                  {" "}
                  · {m.salaName}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink">
              {inicio
                ? "Apertura del día"
                : cierre
                  ? "Fin de la sesión de caja"
                  : m.descripcion || "Movimiento sin turno"}
            </p>
          )}

          {turnoLabel ? (
            <p className="mt-0.5 text-xs text-muted">
              Turno {turnoLabel}
              {m.descripcion ? ` · ${m.descripcion}` : ""}
            </p>
          ) : m.reservaId && m.descripcion ? (
            <p className="mt-0.5 text-xs text-muted">{m.descripcion}</p>
          ) : null}
        </div>

        <p
          className={`shrink-0 text-lg font-semibold tabular-nums ${
            salida
              ? "text-red-400"
              : inicio || cierre
                ? "text-brand"
                : "text-ink"
          }`}
        >
          {cierre ? "" : salida ? "−" : "+"}
          {formatPrecio(m.monto)}
        </p>
      </div>
    </li>
  );
}

function MiniStat({
  label,
  value,
  negative,
  emphasis,
}: {
  label: string;
  value: number;
  negative?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        emphasis ? "border-brand/40 bg-brand/5" : "border-line bg-surface"
      }`}
    >
      <p
        className={`text-[11px] font-medium uppercase tracking-wide ${
          emphasis ? "text-brand/90" : "text-muted"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 text-base font-semibold tabular-nums sm:text-lg ${
          negative && value > 0
            ? "text-red-400"
            : emphasis
              ? "text-brand"
              : "text-ink"
        }`}
      >
        {formatPrecio(value)}
      </p>
    </div>
  );
}

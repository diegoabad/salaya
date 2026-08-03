"use client";

import {
  cargarCreditoClienteAction,
  createClienteAction,
  fetchClienteDetalle,
  updateClienteAction,
  type ClienteDetalleDto,
  type ClienteDto,
} from "@/app/actions/clientes";
import {
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import { fechaHoyIso, formatFechaYmd } from "@/lib/fechas";
import { useFilasPorAltura } from "@/lib/use-filas-por-altura";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

type MedioPago = "efectivo" | "transferencia" | "mercadopago" | "tarjeta";

const MEDIOS: { value: MedioPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "tarjeta", label: "Tarjeta" },
];

const ESTADO_LABEL: Record<string, string> = {
  confirmada: "Confirmada",
  senada: "Señada",
  pendiente_aprobacion: "Pendiente",
  completada: "Asistió",
  ausente: "No vino",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

type Props = { clientes: ClienteDto[]; isDemo?: boolean };

function demoDetalle(c: ClienteDto): ClienteDetalleDto {
  const now = Date.now();
  const day = 86_400_000;
  const reservas = [
    {
      id: `${c.id}-r1`,
      salaId: "s1",
      salaName: "Sala A",
      startsAt: new Date(now - 14 * day).toISOString(),
      endsAt: new Date(now - 14 * day + 3_600_000).toISOString(),
      estado: "completada",
      origen: "publico",
      precioTotal: 12_000,
      senaMonto: 3_000,
      senaPagada: true,
    },
    {
      id: `${c.id}-r2`,
      salaId: "s1",
      salaName: "Sala A",
      startsAt: new Date(now - 7 * day).toISOString(),
      endsAt: new Date(now - 7 * day + 3_600_000).toISOString(),
      estado: "ausente",
      origen: "panel",
      precioTotal: 12_000,
      senaMonto: 3_000,
      senaPagada: true,
    },
    {
      id: `${c.id}-r3`,
      salaId: "s2",
      salaName: "Sala B",
      startsAt: new Date(now + 2 * day).toISOString(),
      endsAt: new Date(now + 2 * day + 3_600_000).toISOString(),
      estado: "senada",
      origen: "publico",
      precioTotal: 14_000,
      senaMonto: 4_000,
      senaPagada: true,
    },
  ];
  const hoy = fechaHoyIso();
  const abonos =
    c.creditoFavor > 0 || c.reservasCount > 2
      ? [
          {
            id: `${c.id}-ab1`,
            planId: "p1",
            planName: "Abono 16 h",
            estado: "activa",
            vigenteDesde: hoy.slice(0, 8) + "01",
            vigenteHasta: hoy,
            precioMensual: 60_000,
            creditoMensual: 0,
            horasMensuales: 16,
            horasMinSemanales: 4,
            diasPreferidos: [1, 2, 3, 4, 5],
          },
        ]
      : [];
  return {
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    email: c.email,
    banda: c.banda,
    noShowCount: c.noShowCount,
    creditoFavor: c.creditoFavor,
    notasInternas: c.notasInternas,
    stats: {
      totalReservas: reservas.length,
      asistio: 1,
      noVino: 1,
      canceladas: 0,
      proximas: 1,
      noShowCount: c.noShowCount,
    },
    abonos,
    abonosActivos: abonos.filter((a) => a.estado === "activa"),
    reservas,
  };
}

function formatReservaWhen(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PanelClientesView({ clientes, isDemo = false }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClienteDto | null>(null);
  const [detalle, setDetalle] = useState<ClienteDetalleDto | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [localClientes, setLocalClientes] = useState(clientes);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creditoMonto, setCreditoMonto] = useState("");
  const [creditoMedio, setCreditoMedio] = useState<MedioPago>("efectivo");
  const [creditoFecha, setCreditoFecha] = useState(fechaHoyIso());
  const [notasEdit, setNotasEdit] = useState("");
  const [bandaEdit, setBandaEdit] = useState("");
  const [emailEdit, setEmailEdit] = useState("");
  const tableAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalClientes(clientes);
  }, [clientes]);

  const lista = isDemo ? localClientes : clientes;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return lista;
    return lista.filter(
      (c) =>
        c.nombre.toLowerCase().includes(needle) ||
        (c.email?.toLowerCase().includes(needle) ?? false) ||
        (c.banda?.toLowerCase().includes(needle) ?? false) ||
        (c.salaHabitual?.toLowerCase().includes(needle) ?? false) ||
        (c.abonoNombre?.toLowerCase().includes(needle) ?? false) ||
        c.telefono.replace(/\s/g, "").includes(needle.replace(/\s/g, "")),
    );
  }, [lista, q]);

  const { pageSize } = useFilasPorAltura(tableAreaRef, {
    fallback: 15,
    min: 5,
    max: 60,
    filaEstimadaPx: 52,
    cabeceraEstimadaPx: 42,
    cantidadFilas: filtered.length,
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!selected) return;
    const fresh = lista.find((c) => c.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo refrescar ficha al cambiar la lista
  }, [lista, selected?.id]);

  const from = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filtered.length);

  const openDetalle = (c: ClienteDto) => {
    setSelected(c);
    setDetalle(null);
    setCreditoMonto("");
    setCreditoMedio("efectivo");
    setCreditoFecha(fechaHoyIso());
    setNotasEdit(c.notasInternas ?? "");
    setBandaEdit(c.banda ?? "");
    setEmailEdit(c.email ?? "");
    setError(null);
    setDetalleLoading(true);
    start(async () => {
      if (isDemo) {
        setDetalle(demoDetalle(c));
        setDetalleLoading(false);
        return;
      }
      const data = await fetchClienteDetalle(c.id);
      setDetalle(data);
      if (data) {
        setNotasEdit(data.notasInternas ?? "");
        setBandaEdit(data.banda ?? "");
        setEmailEdit(data.email ?? "");
      }
      setDetalleLoading(false);
    });
  };

  const closeDetalle = () => {
    setSelected(null);
    setDetalle(null);
    setDetalleLoading(false);
  };

  const patchLocal = (id: string, patch: Partial<ClienteDto>) => {
    setLocalClientes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const cargarCredito = () => {
    if (!selected) return;
    const add = Number(creditoMonto.replace(",", "."));
    if (!(add > 0)) {
      setError("Ingresá un monto válido mayor a 0.");
      return;
    }
    const montoStr = add.toFixed(2);
    const next = Math.round((selected.creditoFavor + add) * 100) / 100;
    setError(null);
    start(async () => {
      if (isDemo) {
        patchLocal(selected.id, { creditoFavor: next });
        setDetalle((d) => (d ? { ...d, creditoFavor: next } : d));
        setCreditoMonto("");
        return;
      }
      const res = await cargarCreditoClienteAction({
        clienteId: selected.id,
        monto: montoStr,
        medioPago: creditoMedio,
        fecha: creditoFecha,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCreditoMonto("");
      setDetalle((d) =>
        d ? { ...d, creditoFavor: Number(res.creditoFavor) } : d,
      );
      router.refresh();
    });
  };

  const guardarFicha = () => {
    if (!selected) return;
    setError(null);
    start(async () => {
      if (isDemo) {
        patchLocal(selected.id, {
          notasInternas: notasEdit.trim() || null,
          banda: bandaEdit.trim() || null,
          email: emailEdit.trim() || null,
        });
        setDetalle((d) =>
          d
            ? {
                ...d,
                notasInternas: notasEdit.trim() || null,
                banda: bandaEdit.trim() || null,
                email: emailEdit.trim() || null,
              }
            : d,
        );
        return;
      }
      const res = await updateClienteAction({
        clienteId: selected.id,
        notasInternas: notasEdit.trim() || null,
        banda: bandaEdit.trim() || null,
        email: emailEdit.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const abonoLabel = (c: ClienteDto) => c.abonoNombre?.trim() || null;

  return (
    <PanelPage
      fill
      title="Clientes"
      description="Ficha por teléfono. Misma identidad que usa el músico al reservar."
      actions={
        <PanelButton onClick={() => setOpen(true)}>+ Nuevo cliente</PanelButton>
      }
    >
      <div className="shrink-0">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email, banda, sala o teléfono…"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand/50"
        />
      </div>

      {lista.length === 0 ? (
        <PanelEmpty>
          Todavía no hay clientes. Se crean al registrar una reserva o desde
          acá.
        </PanelEmpty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <div
            ref={tableAreaRef}
            className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
          >
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Ningún cliente coincide con la búsqueda.
              </p>
            ) : (
              <table className="w-full min-w-[560px] table-fixed text-left text-sm">
                <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="w-[34%] px-4 py-3 font-medium">Cliente</th>
                    <th className="w-[22%] px-4 py-3 font-medium">Teléfono</th>
                    <th className="w-[28%] px-4 py-3 font-medium">Email</th>
                    <th className="w-[16%] px-4 py-3 font-medium">Abono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pageItems.map((c) => {
                    const abono = abonoLabel(c);
                    return (
                      <tr
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDetalle(c)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetalle(c);
                          }
                        }}
                        className="h-[3.25rem] cursor-pointer hover:bg-surface-2/60"
                      >
                        <td className="px-4 py-2">
                          <p className="truncate font-medium text-ink">
                            {c.nombre}
                          </p>
                          {c.banda ? (
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {c.banda}
                            </p>
                          ) : c.notasInternas ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                              {c.notasInternas}
                            </p>
                          ) : null}
                        </td>
                        <td className="truncate px-4 py-2 text-muted">
                          {c.telefono}
                        </td>
                        <td className="truncate px-4 py-2 text-muted">
                          {c.email ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          {abono ? (
                            <span className="truncate text-ink">{abono}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span>
              Mostrando {from} a {to} de {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-line bg-paper px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              <span className="tabular-nums text-ink">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-line bg-paper px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
            <span className="hidden sm:inline tabular-nums">
              {pageSize} por página
            </span>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={closeDetalle}
        title={selected?.nombre ?? "Cliente"}
        placement="center"
        className="sm:max-w-2xl!"
      >
        {selected ? (
          <div className="flex max-h-[min(78vh,720px)] flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info label="Teléfono" value={selected.telefono} />
              <Info
                label="Email"
                value={
                  (detalle?.email ?? selected.email)?.trim()
                    ? (detalle?.email ?? selected.email)!
                    : "—"
                }
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Saldo abono
                </p>
                <p className="mt-1 font-semibold tabular-nums text-brand">
                  {formatPrecio(detalle?.creditoFavor ?? selected.creditoFavor)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  No-shows
                </p>
                <p className="mt-1 font-semibold tabular-nums text-ink">
                  {detalle?.stats.noShowCount ?? selected.noShowCount}
                </p>
              </div>
            </div>

            {detalleLoading ? (
              <p className="text-sm text-muted">Cargando historial…</p>
            ) : detalle ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="Reservas" value={detalle.stats.totalReservas} />
                  <StatChip label="Asistió" value={detalle.stats.asistio} tone="ok" />
                  <StatChip label="No vino" value={detalle.stats.noVino} tone="warn" />
                  <StatChip label="Próximas" value={detalle.stats.proximas} />
                </div>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Abonos
                  </h3>
                  {detalle.abonosActivos.length === 0 &&
                  detalle.creditoFavor <= 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      Sin abonos activos ni saldo a favor.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {detalle.creditoFavor > 0 ? (
                        <li className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-ink">
                              Saldo a favor
                            </span>
                            <span className="font-semibold tabular-nums text-brand">
                              {formatPrecio(detalle.creditoFavor)}
                            </span>
                          </div>
                        </li>
                      ) : null}
                      {detalle.abonos.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-ink">{a.planName}</p>
                              <p className="mt-0.5 text-xs text-muted">
                                {a.horasMensuales > 0
                                  ? `${a.horasMensuales} h/mes`
                                  : null}
                                {a.horasMinSemanales > 0
                                  ? ` · mín. ${a.horasMinSemanales} h/sem`
                                  : ""}
                                {" · "}
                                {formatFechaYmd(a.vigenteDesde)} →{" "}
                                {formatFechaYmd(a.vigenteHasta)}
                              </p>
                            </div>
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                a.estado === "activa"
                                  ? "bg-brand/10 text-brand"
                                  : "bg-surface-2 text-muted"
                              }`}
                            >
                              {a.estado === "activa" ? "Activo" : a.estado}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Historial de reservas
                  </h3>
                  {detalle.reservas.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      Todavía no tiene reservas.
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                      {detalle.reservas.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-ink">{r.salaName}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {formatReservaWhen(r.startsAt)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <EstadoBadge estado={r.estado} />
                            <span className="tabular-nums text-xs text-muted">
                              {formatPrecio(r.precioTotal)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : (
              <p className="text-sm text-muted">
                No se pudo cargar el detalle del cliente.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Email</span>
                <input
                  value={emailEdit}
                  onChange={(e) => setEmailEdit(e.target.value)}
                  type="email"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Banda</span>
                <input
                  value={bandaEdit}
                  onChange={(e) => setBandaEdit(e.target.value)}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Notas internas</span>
              <textarea
                value={notasEdit}
                onChange={(e) => setNotasEdit(e.target.value)}
                rows={3}
                className="resize-none rounded-xl border border-line bg-paper px-3 py-2.5"
                placeholder="Preferencias, observaciones…"
              />
            </label>

            <div className="rounded-2xl border border-line bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Cargar abono
              </p>
              <p className="mt-1 text-xs text-muted">
                Suma saldo a favor y registra el cobro en caja.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">Monto</span>
                  <input
                    value={creditoMonto}
                    onChange={(e) => setCreditoMonto(e.target.value)}
                    inputMode="decimal"
                    placeholder="1000"
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">¿Cuándo pagó?</span>
                  <DatePicker value={creditoFecha} onChange={setCreditoFecha} />
                </label>
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-sm font-medium text-muted">
                  ¿Cómo pagó?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MEDIOS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setCreditoMedio(m.value)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        creditoMedio === m.value
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-line bg-paper text-muted hover:border-brand/40 hover:text-ink"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <PanelButton
                  disabled={pending || !creditoMonto.trim()}
                  onClick={cargarCredito}
                >
                  {pending ? "…" : "Cargar y registrar en caja"}
                </PanelButton>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
              <PanelButton
                variant="ghost"
                disabled={pending}
                onClick={closeDetalle}
              >
                Cerrar
              </PanelButton>
              <PanelButton disabled={pending} onClick={guardarFicha}>
                {pending ? "Guardando…" : "Guardar ficha"}
              </PanelButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo cliente">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              if (isDemo) {
                const id = `demo-c-${Date.now()}`;
                setLocalClientes((prev) => [
                  {
                    id,
                    nombre: String(fd.get("nombre") ?? ""),
                    telefono: String(fd.get("telefono") ?? ""),
                    email: String(fd.get("email") ?? "") || null,
                    banda: String(fd.get("banda") ?? "") || null,
                    notasInternas: String(fd.get("notas") ?? "") || null,
                    noShowCount: 0,
                    creditoFavor: 0,
                    reservasCount: 0,
                    ultimaReserva: null,
                    salaHabitual: null,
                    abonoNombre: null,
                  },
                  ...prev,
                ]);
                setOpen(false);
                return;
              }
              const res = await createClienteAction({
                nombre: String(fd.get("nombre") ?? ""),
                telefono: String(fd.get("telefono") ?? ""),
                email: String(fd.get("email") ?? "") || null,
                banda: String(fd.get("banda") ?? "") || null,
                notasInternas: String(fd.get("notas") ?? "") || null,
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
          <Field name="nombre" label="Nombre" required />
          <Field name="telefono" label="Teléfono" required />
          <Field name="email" label="Email" type="email" />
          <Field name="banda" label="Banda" />
          <Field name="notas" label="Notas internas" />
          {error && !selected ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
          <PanelButton type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Crear cliente"}
          </PanelButton>
        </form>
      </Modal>
    </PanelPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 truncate text-ink">{value}</p>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  const valueClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const label = ESTADO_LABEL[estado] ?? estado;
  let cls = "bg-surface-2 text-muted";
  if (estado === "completada") cls = "bg-emerald-50 text-emerald-800";
  else if (estado === "ausente") cls = "bg-amber-50 text-amber-800";
  else if (estado === "cancelada" || estado === "vencida")
    cls = "bg-red-50 text-red-700";
  else if (estado === "confirmada" || estado === "senada")
    cls = "bg-brand/10 text-brand";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none focus:border-brand/50"
      />
    </label>
  );
}

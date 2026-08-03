"use client";

import {
  cancelarReservaAction,
  cobrarSaldoAction,
  createReservaPanelAction,
  marcarAsistenciaAction,
  reprogramarReservaAction,
  updateReservaAdicionalesAction,
  type AgendaReservaDto,
} from "@/app/actions/reservas";
import type { AdicionalDto } from "@/app/actions/adicionales";
import type { ClienteDto } from "@/app/actions/clientes";
import {
  createBloqueoAction,
  deleteBloqueoAction,
  type BloqueoDto,
} from "@/app/actions/bloqueos";
import type { ReglaPrecioDto } from "@/app/actions/precios";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { ActionTooltip } from "@/components/ui/app-tooltip";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { FilterSelect } from "@/components/ui/filter-select";
import { cotizarPrecioSala } from "@/lib/cotizar-precio";
import { formatPrecio } from "@/lib/directorio-data";
import { fechaHoyIso } from "@/lib/fechas";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

function estadoTone(estado: string) {
  switch (estado) {
    case "confirmada":
    case "senada":
      return "brand" as const;
    case "hold":
      return "warn" as const;
    case "completada":
      return "ok" as const;
    case "ausente":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function estadoLabel(estado: string) {
  switch (estado) {
    case "confirmada":
      return "Confirmada";
    case "hold":
      return "Hold";
    case "senada":
      return "Señada";
    case "completada":
      return "Completada";
    case "ausente":
      return "Ausente";
    case "cancelada":
      return "Cancelada";
    case "pendiente_aprobacion":
      return "Pendiente";
    default:
      return estado;
  }
}

function shiftYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function todayYmdAr(): string {
  return fechaHoyIso();
}

function parseHhMm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatFechaLarga(fecha: string) {
  const label = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${fecha}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "1 hora", "2 horas", "1,5 horas" */
function formatDuracionHoras(horas: number) {
  const h = Math.round(horas * 100) / 100;
  if (h === 1) return "1 hora";
  const label = Number.isInteger(h) ? String(h) : String(h).replace(".", ",");
  return `${label} horas`;
}

const HOUR_PX = 72;

type Rango = { startMin: number; endMin: number };

const RANGO_FALLBACK: Rango = { startMin: 8 * 60, endMin: 24 * 60 };

/**
 * Franja visible: horario de atención del día, extendido para que ninguna
 * reserva fuera de ese rango (heredada, especial) quede oculta.
 */
function rangoAgenda(
  apertura: string | null | undefined,
  cierre: string | null | undefined,
  reservas: AgendaReservaDto[],
): Rango {
  let startMin = apertura ? parseHhMm(apertura) : RANGO_FALLBACK.startMin;
  let endMin = cierre ? parseHhMm(cierre) : RANGO_FALLBACK.endMin;
  // Cierre después de medianoche: mostramos hasta las 24:00
  if (endMin <= startMin) endMin = 24 * 60;

  for (const r of reservas) {
    startMin = Math.min(startMin, parseHhMm(r.startsAt));
    endMin = Math.max(endMin, parseHhMm(r.endsAt));
  }

  startMin = Math.max(0, Math.floor(startMin / 60) * 60);
  endMin = Math.min(24 * 60, Math.ceil(endMin / 60) * 60);
  if (endMin - startMin < 60) endMin = Math.min(24 * 60, startMin + 60);
  return { startMin, endMin };
}

function horasDelRango({ startMin, endMin }: Rango): number[] {
  const total = Math.max(1, (endMin - startMin) / 60);
  return Array.from({ length: total }, (_, i) => startMin / 60 + i);
}

function eventStyle(startsAt: string, endsAt: string, rango: Rango) {
  const start = Math.max(
    rango.startMin,
    Math.min(parseHhMm(startsAt), rango.endMin - 15),
  );
  const end = Math.max(start + 15, Math.min(parseHhMm(endsAt), rango.endMin));
  const top = ((start - rango.startMin) / 60) * HOUR_PX;
  const height = Math.max(((end - start) / 60) * HOUR_PX, 22);
  return { top, height };
}

function hhmm(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Opciones HH:MM entre startMin y endMin inclusive, cada `step` minutos. */
function opcionesHorario(
  startMin: number,
  endMin: number,
  step: number,
): string[] {
  const s = Math.max(15, step || 60);
  if (endMin < startMin) return [hhmm(startMin)];
  const out: string[] = [];
  for (let m = startMin; m <= endMin; m += s) {
    out.push(hhmm(m));
  }
  // Asegurar incluir el fin exacto si no cae en el step
  const last = hhmm(endMin);
  if (!out.includes(last)) out.push(last);
  if (out.length === 0) out.push(hhmm(startMin));
  return out;
}

function estadoBlockClass(estado: string) {
  switch (estado) {
    case "hold":
      return "border-amber-400/50 bg-amber-400/20 text-amber-100";
    case "completada":
      return "border-teal-400/40 bg-teal-400/15 text-teal-100";
    case "ausente":
    case "cancelada":
      return "border-red-400/40 bg-red-400/15 text-red-100";
    default:
      return "border-brand/50 bg-brand/20 text-ink";
  }
}

function resumenAdicionales(r: AgendaReservaDto) {
  return r.adicionales
    .map((a) => `${a.cantidad > 1 ? `${a.cantidad}× ` : ""}${a.name}`)
    .join(" · ");
}

/** Texto corto para la card: un ítem detallado, varios → resumen */
function labelAdicionalesCard(r: AgendaReservaDto) {
  if (r.adicionales.length === 0) return null;
  if (r.adicionales.length > 1) return "Adicionales varios";
  const a = r.adicionales[0]!;
  return a.cantidad > 1 ? `${a.cantidad}x ${a.name}` : a.name;
}

function totalAdicionalesReserva(r: AgendaReservaDto) {
  const horas = Math.max(
    1,
    (parseHhMm(r.endsAt) - parseHhMm(r.startsAt)) / 60,
  );
  return r.adicionales.reduce(
    (total, a) =>
      total +
      a.precioUnitario *
        a.cantidad *
        (a.modalidad === "por_hora" ? horas : 1),
    0,
  );
}

function puedeCerrarEstado(estado: string) {
  return ["confirmada", "senada", "pendiente_aprobacion"].includes(estado);
}

function puedeCancelar(estado: string) {
  return ["hold", "pendiente_aprobacion", "confirmada", "senada"].includes(
    estado,
  );
}

/** Fin del turno en hora AR (misma convención que el panel). */
function turnoYaTermino(fechaYmd: string, endsAtHhmm: string, now = new Date()) {
  const hhmm = endsAtHhmm.slice(0, 5);
  const end = new Date(`${fechaYmd}T${hhmm}:00-03:00`);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() <= now.getTime();
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M5.5 12.5 10 17l8.5-9.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.75"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M4.5 7h15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2A1.4 1.4 0 0 1 14.5 5.4V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.3 7.2 16.55 18.1a1.8 1.8 0 0 1-1.79 1.6H9.24a1.8 1.8 0 0 1-1.79-1.6L6.7 7.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10.25 11v5.2M13.75 11v5.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AgendaDayGrid({
  salas,
  reservas,
  bloqueos,
  rango,
  fecha,
  onSelect,
  onEmptyClick,
  onAsistio,
  onNoAsistio,
  onCancelar,
  onBloqueoClick,
  actionPendingId,
}: {
  salas: SalaOption[];
  reservas: AgendaReservaDto[];
  bloqueos: BloqueoDto[];
  rango: Rango;
  /** Día de la agenda (YYYY-MM-DD) para saber si el turno ya terminó */
  fecha: string;
  onSelect: (r: AgendaReservaDto) => void;
  onEmptyClick?: (salaId: string, hora: string) => void;
  onAsistio?: (r: AgendaReservaDto) => void;
  onNoAsistio?: (r: AgendaReservaDto) => void;
  onCancelar?: (r: AgendaReservaDto) => void;
  onBloqueoClick?: (b: BloqueoDto) => void;
  actionPendingId?: string | null;
}) {
  const horas = horasDelRango(rango);
  const gridHeight = horas.length * HOUR_PX;
  const cols = Math.max(salas.length, 1);
  const topDeHora = (h: number) => (h - rango.startMin / 60) * HOUR_PX;

  return (
    <div className="max-h-full w-full overflow-auto rounded-2xl border border-line bg-surface">
      <div className="min-w-0 w-full">
        {/* Header salas */}
        <div
          className="sticky top-0 z-10 grid items-stretch border-b border-line bg-surface"
          style={{
            gridTemplateColumns: `4.5rem repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
            <div className="flex items-center justify-center border-r border-line px-1.5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Hora
            </div>
            {salas.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-center truncate border-r border-line px-2 py-3 text-center text-base font-semibold text-ink last:border-r-0"
                title={s.name}
              >
                {s.name}
              </div>
            ))}
            {salas.length === 0 ? (
              <div className="flex items-center justify-center px-3 py-3 text-center text-sm text-muted">
                Sin salas
              </div>
            ) : null}
          </div>

          <div
            className="relative grid w-full"
            style={{
              gridTemplateColumns: `4.5rem repeat(${cols}, minmax(0, 1fr))`,
              height: gridHeight,
            }}
          >
            {/* Columna horas + líneas */}
            <div className="relative border-r border-line">
              {horas.map((h) => (
                <div
                  key={h}
                  className="absolute right-0 left-0 flex items-center justify-center border-t border-line/70"
                  style={{ top: topDeHora(h), height: HOUR_PX }}
                >
                  <span className="text-xs tabular-nums text-muted">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Columnas por sala */}
            {salas.map((sala) => {
              const salaReservas = reservas.filter((r) => r.salaId === sala.id);
              const salaBloqueos = bloqueos.filter(
                (b) => b.scope === "sede" || b.salaId === sala.id,
              );
              return (
                <div
                  key={sala.id}
                  className="relative border-r border-line last:border-r-0"
                >
                  {horas.map((h) => {
                    const horaMin = h * 60;
                    const horaFin = horaMin + 60;
                    const bloqueado = salaBloqueos.some((b) => {
                      const bs = parseHhMm(b.startTime);
                      const be = parseHhMm(b.endTime);
                      return bs < horaFin && be > horaMin;
                    });
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={bloqueado}
                        aria-label={
                          bloqueado
                            ? `Bloqueado ${sala.name} ${String(h).padStart(2, "0")}:00`
                            : `Nuevo turno ${sala.name} ${String(h).padStart(2, "0")}:00`
                        }
                        className={
                          bloqueado
                            ? "absolute right-0 left-0 cursor-default border-t border-line/60 bg-zinc-500/10"
                            : "absolute right-0 left-0 border-t border-line/60 transition hover:bg-brand/5"
                        }
                        style={{
                          top: topDeHora(h),
                          height: HOUR_PX,
                        }}
                        onClick={() => {
                          if (bloqueado) return;
                          onEmptyClick?.(
                            sala.id,
                            `${String(h).padStart(2, "0")}:00`,
                          );
                        }}
                      />
                    );
                  })}

                  {salaBloqueos.map((b) => {
                    const { top, height } = eventStyle(
                      b.startTime,
                      b.endTime,
                      rango,
                    );
                    return (
                      <button
                        key={b.id}
                        type="button"
                        title={
                          b.motivo
                            ? `Bloqueado · ${b.motivo}`
                            : "Horario bloqueado"
                        }
                        onClick={() => onBloqueoClick?.(b)}
                        className="absolute right-1 left-1 z-[1] overflow-hidden rounded-lg border border-zinc-500/35 bg-zinc-500/25 px-2 py-1.5 text-left shadow-sm backdrop-blur-[1px] transition hover:bg-zinc-500/35"
                        style={{ top, height }}
                      >
                        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
                          Bloqueado
                        </p>
                        <p className="truncate text-xs text-zinc-300">
                          {b.startTime}–{b.endTime}
                          {b.motivo ? ` · ${b.motivo}` : ""}
                        </p>
                        {b.scope === "sede" ? (
                          <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                            Toda la sede
                          </p>
                        ) : null}
                      </button>
                    );
                  })}

                  {salaReservas.map((r) => {
                    const { top, height } = eventStyle(
                      r.startsAt,
                      r.endsAt,
                      rango,
                    );
                    const terminado = turnoYaTermino(fecha, r.endsAt);
                    const canCerrar =
                      puedeCerrarEstado(r.estado) && terminado;
                    const canCancel = puedeCancelar(r.estado);
                    const busy = actionPendingId === r.id;
                    const adicLabel = labelAdicionalesCard(r);
                    const hintCierre =
                      puedeCerrarEstado(r.estado) && !terminado
                        ? "Cuando termine el turno"
                        : undefined;
                    return (
                      <div
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(r);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect(r);
                          }
                        }}
                        className={`group/turno absolute right-1 left-1 z-[2] overflow-hidden rounded-lg border text-left shadow-sm transition hover:brightness-110 ${
                          height < 56 ? "px-2 py-1" : "px-2.5 py-2"
                        } ${estadoBlockClass(r.estado)}`}
                        style={{ top, height }}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate font-semibold tracking-tight ${
                                height < 48
                                  ? "text-[12px] leading-tight"
                                  : "text-[13px] leading-snug"
                              }`}
                            >
                              {r.clienteNombre}
                            </p>
                            {height >= 42 ? (
                              <p className="mt-0.5 truncate text-[11px] tabular-nums leading-none opacity-75">
                                {r.startsAt}–{r.endsAt}
                              </p>
                            ) : null}
                          </div>
                          <div
                            className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover/turno:opacity-100 group-focus-within/turno:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <ActionTooltip
                              label="Asistió"
                              hint={hintCierre}
                            >
                              <button
                                type="button"
                                disabled={busy || !canCerrar}
                                aria-label="Marcar asistió"
                                onClick={() => onAsistio?.(r)}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <IconCheck />
                              </button>
                            </ActionTooltip>
                            <ActionTooltip
                              label="No asistió"
                              hint={hintCierre}
                            >
                              <button
                                type="button"
                                disabled={busy || !canCerrar}
                                aria-label="Marcar no asistió"
                                onClick={() => onNoAsistio?.(r)}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-600 text-white shadow-sm transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <IconX />
                              </button>
                            </ActionTooltip>
                            <ActionTooltip label="Ver">
                              <button
                                type="button"
                                aria-label="Ver detalle del turno"
                                onClick={() => onSelect(r)}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-white shadow-sm transition hover:bg-amber-400"
                              >
                                <IconEye />
                              </button>
                            </ActionTooltip>
                            <ActionTooltip label="Cancelar">
                              <button
                                type="button"
                                disabled={busy || !canCancel}
                                aria-label="Cancelar reserva"
                                onClick={() => onCancelar?.(r)}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-white shadow-sm transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <IconTrash />
                              </button>
                            </ActionTooltip>
                          </div>
                        </div>

                        {height >= 62 ? (
                          <p className="mt-1.5 truncate text-[11px] leading-snug opacity-85">
                            <span className="font-medium">Seña</span>{" "}
                            {formatPrecio(r.senaPagada)}
                            <span className="mx-1 opacity-50">·</span>
                            <span className="font-medium">Saldo</span>{" "}
                            {formatPrecio(r.saldo)}
                            {height < 88 && adicLabel
                              ? ` · +${adicLabel}`
                              : ""}
                          </p>
                        ) : null}

                        {height >= 88 ? (
                          <p className="mt-2 truncate border-t border-white/20 pt-1.5 text-[11px] font-medium leading-snug opacity-90">
                            {adicLabel ? `+ ${adicLabel}` : "Sin adicionales"}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
  );
}

type SalaOption = {
  id: string;
  name: string;
  precioHora: string | null;
  duracionMinMinutos?: number | null;
  duracionMaxMinutos?: number | null;
  granularidadMinutos?: number | null;
};

type Props = {
  fecha: string;
  reservas: AgendaReservaDto[];
  salas: SalaOption[];
  adicionales?: AdicionalDto[];
  /** Reglas de precio (promos) para cotizar en el alta */
  reglasPrecio?: ReglaPrecioDto[];
  /** Bloqueos del día (sede o sala) */
  bloqueos?: BloqueoDto[];
  /** Clientes del estudio (selector en nueva reserva) */
  clientes?: ClienteDto[];
  /** Política sede: duración mínima por defecto (sala puede override) */
  duracionMinMinutos?: number;
  duracionMaxMinutos?: number;
  granularidadMinutos?: number;
  /** Horario de atención del día (sede o especial), en HH:MM */
  horaApertura?: string | null;
  horaCierre?: string | null;
  /** La sede no atiende ese día (horario semanal o especial) */
  diaCerrado?: boolean;
  /** Base path for date navigation (/panel or /panel-demo) */
  basePath?: string;
  /** Sala filtrada inicial (query) */
  salaIdInicial?: string | null;
};

type AdicSel = Record<string, number>;

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

type MedioPagoUi = "efectivo" | "transferencia" | "mercadopago" | "tarjeta";

const MEDIOS_COBRO: { value: MedioPagoUi; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "tarjeta", label: "Tarjeta" },
];

function CobrarSaldoModal({
  open,
  onClose,
  saldo,
  pending,
  title = "Cobrar saldo",
  intro,
  cancelLabel = "Cancelar",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  saldo: number;
  pending?: boolean;
  title?: string;
  intro?: ReactNode;
  cancelLabel?: string;
  onConfirm: (medio: MedioPagoUi) => void;
}) {
  const [medio, setMedio] = useState<MedioPagoUi>("efectivo");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      placement="center"
      className="sm:max-w-md!"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <PanelButton variant="ghost" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </PanelButton>
          <PanelButton
            disabled={pending}
            onClick={() => onConfirm(medio)}
          >
            {pending ? "Cobrando…" : `Cobrar ${formatPrecio(saldo)}`}
          </PanelButton>
        </div>
      }
    >
      {intro ?? (
        <p className="text-sm text-muted">
          ¿Con qué medio de pago cobrás{" "}
          <span className="font-semibold text-ink">{formatPrecio(saldo)}</span>?
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {MEDIOS_COBRO.map((m) => {
          const active = medio === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMedio(m.value)}
              className={
                active
                  ? "rounded-xl border border-brand/50 bg-brand/15 px-3 py-2.5 text-sm font-semibold text-brand"
                  : "rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-ink hover:border-brand/30"
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function ReservaActions({
  r,
  saldo,
  onReprogramar,
  onDone,
  onGuardar,
  guardarPending,
  showGuardar,
  isDemo,
  onDemoCobrado,
}: {
  r: AgendaReservaDto;
  /** Saldo a cobrar (se actualiza si cambian adicionales) */
  saldo: number;
  onReprogramar: (r: AgendaReservaDto) => void;
  onDone?: () => void;
  onGuardar?: () => void;
  guardarPending?: boolean;
  showGuardar?: boolean;
  isDemo?: boolean;
  onDemoCobrado?: (medio: MedioPagoUi) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cobrarOpen, setCobrarOpen] = useState(false);

  const cobrable =
    saldo > 0 &&
    ["completada", "senada", "confirmada"].includes(r.estado);
  const reprogramable = [
    "hold",
    "pendiente_aprobacion",
    "confirmada",
    "senada",
  ].includes(r.estado);

  const busy = pending || Boolean(guardarPending);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {reprogramable ? (
          <PanelButton
            variant="ghost"
            disabled={busy}
            onClick={() => onReprogramar(r)}
          >
            Reprogramar
          </PanelButton>
        ) : null}

        {cobrable ? (
          showGuardar ? (
            <ActionTooltip
              label={`Cobrar ${formatPrecio(saldo)}`}
              hint="Guardá los adicionales primero"
            >
              <span className="inline-flex">
                <PanelButton disabled>{`Cobrar ${formatPrecio(saldo)}`}</PanelButton>
              </span>
            </ActionTooltip>
          ) : (
            <PanelButton disabled={busy} onClick={() => setCobrarOpen(true)}>
              Cobrar {formatPrecio(saldo)}
            </PanelButton>
          )
        ) : null}

        {showGuardar ? (
          <PanelButton disabled={busy} onClick={onGuardar}>
            {guardarPending ? "Guardando…" : "Guardar"}
          </PanelButton>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <CobrarSaldoModal
        open={cobrarOpen}
        onClose={() => setCobrarOpen(false)}
        saldo={saldo}
        pending={pending}
        onConfirm={(medio) => {
          setError(null);
          if (isDemo) {
            onDemoCobrado?.(medio);
            setCobrarOpen(false);
            return;
          }
          startTransition(async () => {
            const res = await cobrarSaldoAction(r.id, medio);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setCobrarOpen(false);
            onDone?.();
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function AdicionalesPicker({
  adicionales,
  sel,
  onChange,
  duracionHoras,
  title = "Adicionales",
}: {
  adicionales: AdicionalDto[];
  sel: AdicSel;
  onChange: (next: AdicSel) => void;
  duracionHoras: number;
  title?: string;
}) {
  const activos = adicionales.filter((a) => a.active);
  const seleccionados = activos.filter((a) => (sel[a.id] ?? 0) > 0);
  const qtyTotal = seleccionados.reduce((acc, a) => acc + (sel[a.id] ?? 0), 0);
  const extra = adicionalesTotal(adicionales, sel, duracionHoras);

  if (activos.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-muted">
        No hay adicionales cargados. Creá algunos en Adicionales.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper">
      <div className="flex w-full shrink-0 items-center gap-3 px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {qtyTotal > 0
              ? `${qtyTotal} seleccionado${qtyTotal === 1 ? "" : "s"} · ${formatPrecio(extra)}`
              : "Ninguno seleccionado"}
          </p>
        </div>
        {qtyTotal > 0 ? (
          <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
            {qtyTotal}
          </span>
        ) : null}
      </div>

      <ul className="h-[17.75rem] space-y-2 overflow-y-auto border-t border-line px-3 pt-3 pb-5">
        {activos.map((a) => {
          const qty = sel[a.id] ?? 0;
          return (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-2.5 py-2.5"
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
                <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {a.grupo} · {formatPrecio(a.precio)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
  );
}

export function PanelHoyView({
  fecha,
  reservas,
  salas,
  adicionales = [],
  reglasPrecio = [],
  bloqueos = [],
  clientes = [],
  duracionMinMinutos = 60,
  duracionMaxMinutos = 240,
  granularidadMinutos = 60,
  horaApertura = null,
  horaCierre = null,
  diaCerrado = false,
  basePath = "/panel",
  salaIdInicial = null,
}: Props) {
  const router = useRouter();
  const [salaFilter, setSalaFilter] = useState<string | null>(salaIdInicial);
  const [openCreate, setOpenCreate] = useState(false);
  const [openBloqueo, setOpenBloqueo] = useState(false);
  const [bloqueoAlcance, setBloqueoAlcance] = useState<"sede" | string>("sede");
  const [bloqueoFecha, setBloqueoFecha] = useState(fecha);
  const [bloqueoModo, setBloqueoModo] = useState<"dia" | "franja">("franja");
  const [bloqueoStart, setBloqueoStart] = useState("14:00");
  const [bloqueoEnd, setBloqueoEnd] = useState("16:00");
  const [bloqueoMotivo, setBloqueoMotivo] = useState("");
  const [bloqueoQuitar, setBloqueoQuitar] = useState<BloqueoDto | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{
    salaId?: string;
    horaInicio?: string;
    horaFin?: string;
    fecha?: string;
  }>({});
  const [reprogFecha, setReprogFecha] = useState(fecha);
  const [selected, setSelected] = useState<AgendaReservaDto | null>(null);
  const [reprog, setReprog] = useState<AgendaReservaDto | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AgendaReservaDto | null>(
    null,
  );
  const [asistenciaTarget, setAsistenciaTarget] = useState<{
    reserva: AgendaReservaDto;
    asistio: boolean;
  } | null>(null);
  const [cobroTrasAsistio, setCobroTrasAsistio] =
    useState<AgendaReservaDto | null>(null);
  const [gridActionId, setGridActionId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createAdicSel, setCreateAdicSel] = useState<AdicSel>({});
  const [editAdicSel, setEditAdicSel] = useState<AdicSel>({});
  const [createDescTipo, setCreateDescTipo] = useState<
    "none" | "porcentaje" | "fijo"
  >("none");
  const [createDescValor, setCreateDescValor] = useState("");
  /** `__nuevo__` = alta libre; si no, id de cliente existente */
  const [createClienteModo, setCreateClienteModo] = useState("__nuevo__");
  const [createClienteNombre, setCreateClienteNombre] = useState("");
  const [createClienteTelefono, setCreateClienteTelefono] = useState("");
  const [createClienteEmail, setCreateClienteEmail] = useState("");

  const isDemo = basePath.startsWith("/panel-demo");
  const [reservasLocal, setReservasLocal] = useState(reservas);
  const [bloqueosLocal, setBloqueosLocal] = useState(bloqueos);
  useEffect(() => {
    setReservasLocal(reservas);
  }, [reservas]);
  useEffect(() => {
    setBloqueosLocal(bloqueos);
  }, [bloqueos]);
  useEffect(() => {
    setBloqueoFecha(fecha);
  }, [fecha]);

  const reservasActivas = isDemo ? reservasLocal : reservas;
  const bloqueosActivos = isDemo ? bloqueosLocal : bloqueos;

  const patchReservaLocal = (
    id: string,
    patch: Partial<AgendaReservaDto>,
  ) => {
    setReservasLocal((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    setSelected((cur) =>
      cur?.id === id ? { ...cur, ...patch } : cur,
    );
  };

  const removeReservaLocal = (id: string) => {
    setReservasLocal((prev) => prev.filter((r) => r.id !== id));
    setSelected((cur) => (cur?.id === id ? null : cur));
  };

  const filtered = useMemo(() => {
    const list = salaFilter
      ? reservasActivas.filter((r) => r.salaId === salaFilter)
      : reservasActivas;
    return [...list].sort(
      (a, b) => parseHhMm(a.startsAt) - parseHhMm(b.startsAt),
    );
  }, [reservasActivas, salaFilter]);

  const bloqueosFiltrados = useMemo(() => {
    if (!salaFilter) return bloqueosActivos;
    return bloqueosActivos.filter(
      (b) => b.scope === "sede" || b.salaId === salaFilter,
    );
  }, [bloqueosActivos, salaFilter]);

  const abrirBloqueo = () => {
    setBloqueoFecha(fecha);
    setBloqueoAlcance(salaFilter ?? "sede");
    setBloqueoModo("franja");
    setBloqueoStart("14:00");
    setBloqueoEnd("16:00");
    setBloqueoMotivo("");
    setError(null);
    setOpenBloqueo(true);
  };

  const guardarBloqueo = () => {
    const horaIni =
      bloqueoModo === "dia"
        ? (horaApertura ?? "10:00").slice(0, 5)
        : bloqueoStart.slice(0, 5);
    const horaFin =
      bloqueoModo === "dia"
        ? (horaCierre ?? "22:00").slice(0, 5)
        : bloqueoEnd.slice(0, 5);
    if (parseHhMm(horaFin) <= parseHhMm(horaIni)) {
      setError("La hora de fin debe ser posterior al inicio.");
      return;
    }
    const salaId =
      bloqueoAlcance === "sede" ? null : bloqueoAlcance;
    const salaName =
      salaId ? (salas.find((s) => s.id === salaId)?.name ?? null) : null;
    const motivo = bloqueoMotivo.trim();
    if (!motivo) {
      setError("El motivo es obligatorio.");
      return;
    }

    setError(null);
    start(async () => {
      if (isDemo) {
        const id = `demo-bl-${Date.now()}`;
        setBloqueosLocal((prev) => [
          {
            id,
            sedeId: "demo-sede",
            salaId,
            salaName,
            fecha: bloqueoFecha,
            startTime: horaIni,
            endTime: horaFin,
            startsAt: `${bloqueoFecha}T${horaIni}:00.000-03:00`,
            endsAt: `${bloqueoFecha}T${horaFin}:00.000-03:00`,
            motivo,
            scope: salaId ? "sala" : "sede",
          },
          ...prev,
        ]);
        setOpenBloqueo(false);
        if (bloqueoFecha !== fecha) goFecha(bloqueoFecha);
        return;
      }
      const res = await createBloqueoAction({
        salaId,
        fecha: bloqueoFecha,
        startTime: horaIni,
        endTime: horaFin,
        motivo,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpenBloqueo(false);
      if (bloqueoFecha !== fecha) {
        goFecha(bloqueoFecha);
      } else {
        router.refresh();
      }
    });
  };

  const salaOptions = useMemo(
    () => [
      { value: "", label: "Todas las salas" },
      ...salas.map((s) => ({ value: s.id, label: s.name })),
    ],
    [salas],
  );

  const rango = useMemo(
    () => rangoAgenda(horaApertura, horaCierre, filtered),
    [horaApertura, horaCierre, filtered],
  );

  const esHoy = fecha === todayYmdAr();
  const salaActiva = salas.find((s) => s.id === salaFilter) ?? null;

  const goFecha = (next: string) => {
    const q = new URLSearchParams();
    q.set("fecha", next);
    if (salaFilter) q.set("sala", salaFilter);
    router.push(`${basePath}?${q.toString()}`);
  };

  const setSala = (id: string | null) => {
    setSalaFilter(id);
    const q = new URLSearchParams();
    q.set("fecha", fecha);
    if (id) q.set("sala", id);
    router.replace(`${basePath}?${q.toString()}`, { scroll: false });
  };

  const openTurno = (r: AgendaReservaDto) => {
    const sel: AdicSel = {};
    for (const a of r.adicionales) sel[a.id] = a.cantidad;
    setEditAdicSel(sel);
    setSelected(r);
    setError(null);
  };

  const duracionHoras = (r: AgendaReservaDto) => {
    const mins = Math.max(60, parseHhMm(r.endsAt) - parseHhMm(r.startsAt));
    return mins / 60;
  };

  const duracionMinSala = (salaId?: string | null) => {
    const sala = salas.find((s) => s.id === salaId);
    return sala?.duracionMinMinutos ?? duracionMinMinutos ?? 60;
  };

  const granularidadSala = (salaId?: string | null) => {
    const sala = salas.find((s) => s.id === salaId);
    return sala?.granularidadMinutos ?? granularidadMinutos ?? 60;
  };

  const openCreateAt = (salaId?: string, horaInicio?: string) => {
    const sid = salaId ?? salaFilter ?? salas[0]?.id;
    const minDur = duracionMinSala(sid);
    let startMin = horaInicio ? parseHhMm(horaInicio) : rango.startMin;
    // Dejar espacio para la duración mínima dentro del horario
    if (startMin + minDur > rango.endMin) {
      startMin = Math.max(rango.startMin, rango.endMin - minDur);
    }
    const finMin = Math.min(startMin + minDur, rango.endMin);
    setCreateDefaults({
      salaId: sid ?? undefined,
      horaInicio: hhmm(startMin),
      horaFin: hhmm(finMin),
      fecha,
    });
    setCreateAdicSel({});
    setCreateDescTipo("none");
    setCreateDescValor("");
    setCreateClienteModo("__nuevo__");
    setCreateClienteNombre("");
    setCreateClienteTelefono("");
    setCreateClienteEmail("");
    setError(null);
    setOpenCreate(true);
  };

  const calendarSalas = salaFilter
    ? salas.filter((s) => s.id === salaFilter)
    : salas;

  const createSalaId =
    createDefaults.salaId ?? salaFilter ?? salas[0]?.id ?? "";
  const createSala = salas.find((s) => s.id === createSalaId) ?? null;
  const createFecha = createDefaults.fecha ?? fecha;
  const createMinDur = duracionMinSala(createSalaId);
  const createStep = granularidadSala(createSalaId);
  const createHoraInicioRaw =
    createDefaults.horaInicio ?? hhmm(rango.startMin);
  const createOpcionesInicio = opcionesHorario(
    rango.startMin,
    Math.max(rango.startMin, rango.endMin - createMinDur),
    createStep,
  );
  /** Mismo valor que muestra el select (evita cotizar con un horario inválido). */
  const createHoraInicio = createOpcionesInicio.includes(createHoraInicioRaw)
    ? createHoraInicioRaw
    : (createOpcionesInicio[0] ?? createHoraInicioRaw);
  const createOpcionesFin = opcionesHorario(
    parseHhMm(createHoraInicio) + createMinDur,
    rango.endMin,
    createStep,
  );
  const createHoraFinRaw =
    createDefaults.horaFin ??
    hhmm(Math.min(parseHhMm(createHoraInicio) + createMinDur, rango.endMin));
  const createHoraFin = createOpcionesFin.includes(createHoraFinRaw)
    ? createHoraFinRaw
    : (createOpcionesFin[0] ?? createHoraFinRaw);
  const createDuracionHoras = Math.max(
    createMinDur / 60,
    (parseHhMm(createHoraFin) - parseHhMm(createHoraInicio)) / 60,
  );
  /** Precio según tabla de la sala (reglas por día/franja) + horario elegido. */
  const createPrecioSala = cotizarPrecioSala({
    precioHoraBase: createSala?.precioHora,
    reglas: reglasPrecio,
    salaId: createSalaId,
    fecha: createFecha,
    horaInicio: createHoraInicio,
    horaFin: createHoraFin,
    granularityMinutes: createStep,
  });
  const createAdicExtra = adicionalesTotal(
    adicionales,
    createAdicSel,
    createDuracionHoras,
  );
  const createSubtotal = createPrecioSala + createAdicExtra;
  const createDescValorNum = Number(createDescValor.replace(",", ".")) || 0;
  const createDescuento =
    createDescTipo === "none" || createDescValorNum <= 0
      ? 0
      : createDescTipo === "porcentaje"
        ? Math.min(createSubtotal, (createSubtotal * createDescValorNum) / 100)
        : Math.min(createSubtotal, createDescValorNum);
  const createTotal = Math.max(0, createSubtotal - createDescuento);

  const editHoras = selected
    ? Math.max(0.25, duracionHoras(selected))
    : 1;
  const editAdicExtra = selected
    ? adicionalesTotal(adicionales, editAdicSel, editHoras)
    : 0;
  const editPrecioSala = selected
    ? (selected.precioSala ??
      Math.max(0, selected.precioTotal - totalAdicionalesReserva(selected)))
    : 0;
  const editTotal = editPrecioSala + editAdicExtra;
  const editSaldo = selected
    ? Math.max(0, editTotal - selected.senaPagada)
    : 0;
  const editAdicDirty = selected
    ? (() => {
        const ids = new Set([
          ...Object.keys(editAdicSel),
          ...selected.adicionales.map((a) => a.id),
        ]);
        for (const id of ids) {
          const cur = editAdicSel[id] ?? 0;
          const orig =
            selected.adicionales.find((a) => a.id === id)?.cantidad ?? 0;
          if (cur !== orig) return true;
        }
        return false;
      })()
    : false;

  return (
    <PanelPage
      fill
      title="Agenda"
      description={
        salaActiva
          ? `${formatFechaLarga(fecha)} · ${salaActiva.name}`
          : `${formatFechaLarga(fecha)} · todas las salas`
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <PanelButton variant="ghost" onClick={abrirBloqueo}>
            Bloquear
          </PanelButton>
          <PanelButton
            onClick={() => openCreateAt()}
            disabled={salas.length === 0}
          >
            + Nueva reserva
          </PanelButton>
        </div>
      }
    >
      {/* Fecha + sala + resumen (fijos; scrollea solo la grilla) */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => goFecha(shiftYmd(fecha, -1))}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-brand/40"
          >
            ←
          </button>
          <div className="w-[11.5rem] sm:w-[13rem]">
            <DatePicker
              compact
              value={fecha}
              onChange={(v) => {
                if (v) goFecha(v);
              }}
              aria-label="Fecha de la agenda"
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
          <div className="w-full min-w-[12rem] sm:w-auto sm:min-w-[14rem] sm:max-w-[18rem] sm:flex-none">
            <FilterSelect
              value={salaFilter ?? ""}
              onChange={(v) => setSala(v || null)}
              options={salaOptions}
              placeholder="Sala"
              aria-label="Filtrar por sala"
              className="sm:min-w-[14rem] sm:max-w-[18rem] sm:flex-none"
            />
          </div>
          {!esHoy ? (
            <button
              type="button"
              onClick={() => goFecha(todayYmdAr())}
              className="rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-sm font-medium text-brand"
            >
              Ir a hoy
            </button>
          ) : (
            <span className="rounded-xl bg-brand/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand">
              Hoy
            </span>
          )}
          {diaCerrado ? (
            <span className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
              Sede cerrada
            </span>
          ) : null}
        </div>
      </div>

      {calendarSalas.length === 0 ? (
        <PanelEmpty>
          Todavía no hay salas. Creá una en Salas para ver la agenda.
        </PanelEmpty>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <AgendaDayGrid
            salas={calendarSalas}
            reservas={filtered}
            bloqueos={bloqueosFiltrados}
            rango={rango}
            fecha={fecha}
            onSelect={openTurno}
            onEmptyClick={(salaId, hora) => openCreateAt(salaId, hora)}
            onBloqueoClick={(b) => setBloqueoQuitar(b)}
            actionPendingId={gridActionId}
            onAsistio={(r) => setAsistenciaTarget({ reserva: r, asistio: true })}
            onNoAsistio={(r) =>
              setAsistenciaTarget({ reserva: r, asistio: false })
            }
            onCancelar={(r) => setCancelTarget(r)}
          />
          {error ? (
            <p className="mt-2 text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {filtered.length === 0 ? (
            <p className="mt-2 text-center text-sm text-muted">
              Sin turnos este día. Tocá un horario vacío para crear una reserva.
            </p>
          ) : null}
        </div>
      )}

      <CobrarSaldoModal
        open={Boolean(cobroTrasAsistio)}
        onClose={() => setCobroTrasAsistio(null)}
        saldo={cobroTrasAsistio?.saldo ?? 0}
        pending={pending && gridActionId === cobroTrasAsistio?.id}
        title="Registrar pago"
        cancelLabel="Ahora no"
        intro={
          cobroTrasAsistio ? (
            <p className="text-sm text-muted">
              Marcaste asistencia de{" "}
              <span className="font-semibold text-ink">
                {cobroTrasAsistio.clienteNombre}
              </span>
              . Hay un saldo de{" "}
              <span className="font-semibold text-ink">
                {formatPrecio(cobroTrasAsistio.saldo)}
              </span>
              . ¿Querés cobrarlo ahora?
            </p>
          ) : null
        }
        onConfirm={(medio) => {
          const r = cobroTrasAsistio;
          if (!r) return;
          if (isDemo) {
            patchReservaLocal(r.id, {
              estado: "completada",
              senaPagada: r.senaPagada + r.saldo,
              saldo: 0,
            });
            setCobroTrasAsistio(null);
            return;
          }
          setGridActionId(r.id);
          start(async () => {
            const res = await cobrarSaldoAction(r.id, medio);
            setGridActionId(null);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setCobroTrasAsistio(null);
            if (selected?.id === r.id) setSelected(null);
            router.refresh();
          });
        }}
      />

      <Modal
        open={openBloqueo}
        onClose={() => setOpenBloqueo(false)}
        title="Bloquear horario"
        placement="center"
        className="sm:max-w-2xl!"
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">¿Qué bloqueás?</span>
            <select
              value={bloqueoAlcance}
              onChange={(e) => setBloqueoAlcance(e.target.value)}
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            >
              <option value="sede">Todas las salas</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  Solo {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Día</span>
            <DatePicker
              tone="paper"
              value={bloqueoFecha}
              onChange={setBloqueoFecha}
              aria-label="Fecha del bloqueo"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBloqueoModo("dia")}
              className={
                bloqueoModo === "dia"
                  ? "rounded-xl border border-brand/50 bg-brand/15 px-3 py-2.5 text-sm font-semibold text-brand"
                  : "rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-ink hover:border-brand/30"
              }
            >
              Día entero
            </button>
            <button
              type="button"
              onClick={() => setBloqueoModo("franja")}
              className={
                bloqueoModo === "franja"
                  ? "rounded-xl border border-brand/50 bg-brand/15 px-3 py-2.5 text-sm font-semibold text-brand"
                  : "rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-ink hover:border-brand/30"
              }
            >
              Parte del horario
            </button>
          </div>

          {bloqueoModo === "dia" ? (
            <p className="text-xs text-muted">
              Se bloquea de{" "}
              <span className="font-medium text-ink">
                {(horaApertura ?? "10:00").slice(0, 5)}
              </span>{" "}
              a{" "}
              <span className="font-medium text-ink">
                {(horaCierre ?? "22:00").slice(0, 5)}
              </span>
              {diaCerrado ? " (horario por defecto: sede cerrada ese día)" : ""}.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Desde</span>
                <input
                  type="time"
                  value={bloqueoStart}
                  onChange={(e) => setBloqueoStart(e.target.value)}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Hasta</span>
                <input
                  type="time"
                  value={bloqueoEnd}
                  onChange={(e) => setBloqueoEnd(e.target.value)}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Motivo</span>
            <input
              value={bloqueoMotivo}
              onChange={(e) => setBloqueoMotivo(e.target.value)}
              required
              placeholder="Feriado, mantenimiento, evento…"
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <PanelButton
              variant="ghost"
              disabled={pending}
              onClick={() => setOpenBloqueo(false)}
            >
              Cancelar
            </PanelButton>
            <PanelButton disabled={pending} onClick={guardarBloqueo}>
              {pending ? "Guardando…" : "Bloquear"}
            </PanelButton>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(bloqueoQuitar)}
        onClose={() => setBloqueoQuitar(null)}
        title="Quitar bloqueo"
        description={
          bloqueoQuitar
            ? `¿Quitás el bloqueo ${bloqueoQuitar.startTime}–${bloqueoQuitar.endTime}${
                bloqueoQuitar.motivo ? ` (${bloqueoQuitar.motivo})` : ""
              }?`
            : undefined
        }
        confirmLabel="Quitar"
        cancelLabel="Volver"
        danger
        pending={pending}
        onConfirm={() => {
          if (!bloqueoQuitar) return;
          const id = bloqueoQuitar.id;
          start(async () => {
            if (isDemo) {
              setBloqueosLocal((prev) => prev.filter((b) => b.id !== id));
              setBloqueoQuitar(null);
              return;
            }
            const res = await deleteBloqueoAction(id);
            setBloqueoQuitar(null);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            router.refresh();
          });
        }}
      />

      <ConfirmModal
        open={Boolean(asistenciaTarget)}
        onClose={() => setAsistenciaTarget(null)}
        title={
          asistenciaTarget?.asistio ? "Marcar asistencia" : "Marcar ausente"
        }
        description={
          asistenciaTarget
            ? asistenciaTarget.asistio
              ? `¿Confirmás que ${asistenciaTarget.reserva.clienteNombre || "el cliente"} asistió al turno ${asistenciaTarget.reserva.startsAt}–${asistenciaTarget.reserva.endsAt}?`
              : `¿Confirmás que ${asistenciaTarget.reserva.clienteNombre || "el cliente"} no asistió al turno ${asistenciaTarget.reserva.startsAt}–${asistenciaTarget.reserva.endsAt}? Se registrará como ausente.`
            : undefined
        }
        confirmLabel={
          asistenciaTarget?.asistio ? "Sí, asistió" : "Sí, no asistió"
        }
        cancelLabel="Volver"
        danger={!asistenciaTarget?.asistio}
        pending={
          pending && gridActionId === asistenciaTarget?.reserva.id
        }
        onConfirm={() => {
          if (!asistenciaTarget) return;
          const r = asistenciaTarget.reserva;
          const asistio = asistenciaTarget.asistio;
          const ofrecerCobro = (reserva: AgendaReservaDto) => {
            if (reserva.saldo > 0) setCobroTrasAsistio(reserva);
          };

          if (isDemo) {
            setError(null);
            if (asistio) {
              const next = { ...r, estado: "completada" };
              patchReservaLocal(r.id, { estado: "completada" });
              setAsistenciaTarget(null);
              ofrecerCobro(next);
            } else {
              patchReservaLocal(r.id, { estado: "ausente" });
              setAsistenciaTarget(null);
            }
            return;
          }

          setGridActionId(r.id);
          start(async () => {
            const res = await marcarAsistenciaAction(r.id, asistio);
            setGridActionId(null);
            setAsistenciaTarget(null);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            if (asistio) ofrecerCobro({ ...r, estado: res.estado });
            router.refresh();
          });
        }}
      />

      <ConfirmModal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancelar reserva"
        description={
          cancelTarget
            ? `Se va a cancelar la reserva de ${cancelTarget.clienteNombre || "el cliente"}. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Cancelar reserva"
        cancelLabel="Volver"
        danger
        pending={pending && gridActionId === cancelTarget?.id}
        onConfirm={() => {
          if (!cancelTarget) return;
          if (isDemo) {
            removeReservaLocal(cancelTarget.id);
            setCancelTarget(null);
            return;
          }
          const id = cancelTarget.id;
          setGridActionId(id);
          start(async () => {
            const res = await cancelarReservaAction(id);
            setGridActionId(null);
            setCancelTarget(null);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            if (selected?.id === id) setSelected(null);
            router.refresh();
          });
        }}
      />

      {/* Modal turno */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detalle del turno"
        placement="center"
        className="max-h-[min(92vh,900px)]! sm:max-w-6xl!"
        bodyClassName="flex flex-col py-3 sm:py-3.5"
        headerClassName="px-5 py-4 sm:px-6 sm:py-5"
        footer={
          selected &&
          (editAdicDirty ||
            (editSaldo > 0 &&
              ["completada", "senada", "confirmada"].includes(
                selected.estado,
              )) ||
            ["hold", "pendiente_aprobacion", "confirmada", "senada"].includes(
              selected.estado,
            )) ? (
            <ReservaActions
              r={selected}
              saldo={editSaldo}
              isDemo={isDemo}
              onDemoCobrado={() => {
                patchReservaLocal(selected.id, {
                  senaPagada: selected.senaPagada + editSaldo,
                  saldo: 0,
                  precioTotal: editTotal,
                  precioSala: editPrecioSala,
                });
              }}
              showGuardar={editAdicDirty}
              guardarPending={pending}
              onGuardar={() => {
                const pedidos = Object.entries(editAdicSel)
                  .filter(([, qty]) => qty > 0)
                  .map(([id, cantidad]) => ({ id, cantidad }));
                const nextAdicionales = adicionales
                  .filter((a) => (editAdicSel[a.id] ?? 0) > 0)
                  .map((a) => ({
                    id: a.id,
                    name: a.name,
                    cantidad: editAdicSel[a.id]!,
                    precioUnitario: a.precio,
                    modalidad: a.modalidad as "por_hora" | "por_reserva",
                  }));
                setError(null);

                if (isDemo) {
                  patchReservaLocal(selected.id, {
                    precioTotal: editTotal,
                    precioSala: editPrecioSala,
                    saldo: editSaldo,
                    adicionales: nextAdicionales,
                  });
                  return;
                }

                start(async () => {
                  const res = await updateReservaAdicionalesAction({
                    reservaId: selected.id,
                    adicionales: pedidos,
                  });
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  setSelected({
                    ...selected,
                    precioTotal: res.precioTotal,
                    precioSala: editPrecioSala,
                    senaPagada: res.senaPagada,
                    saldo: res.saldo,
                    adicionales: nextAdicionales,
                  });
                  router.refresh();
                });
              }}
              onDone={() => setSelected(null)}
              onReprogramar={(r) => {
                setSelected(null);
                setReprogFecha(fecha);
                setReprog(r);
              }}
            />
          ) : null
        }
      >
        {selected ? (
          <div className="flex min-h-0 flex-col gap-5">
            {/* Bloque datos */}
            <div className="shrink-0 rounded-xl border border-line bg-surface p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">Sala</span>
                  <div className="truncate rounded-lg border border-line bg-paper px-2.5 py-2 text-ink">
                    {selected.salaName}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">
                    Fecha del turno
                  </span>
                  <div className="truncate rounded-lg border border-line bg-paper px-2.5 py-2 text-ink">
                    {formatFechaLarga(fecha)}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">Desde</span>
                  <div className="rounded-lg border border-line bg-paper px-2.5 py-2 tabular-nums text-ink">
                    {selected.startsAt}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">Hasta</span>
                  <div className="rounded-lg border border-line bg-paper px-2.5 py-2 tabular-nums text-ink">
                    {selected.endsAt}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">Cliente</span>
                  <div className="truncate rounded-lg border border-line bg-paper px-2.5 py-2 text-ink">
                    {selected.clienteNombre}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">Teléfono</span>
                  <div className="truncate rounded-lg border border-line bg-paper px-2.5 py-2 text-ink">
                    {selected.clienteTelefono}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">Email</span>
                  <div className="truncate rounded-lg border border-line bg-paper px-2.5 py-2 text-ink">
                    {selected.clienteEmail || "—"}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted">Origen</span>
                  <div className="truncate rounded-lg border border-line bg-paper px-2.5 py-2 capitalize text-ink">
                    {selected.origen || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Bloque adicionales */}
            <div className="shrink-0">
              <AdicionalesPicker
                key={selected.id}
                title="Adicionales"
                adicionales={adicionales}
                sel={editAdicSel}
                onChange={setEditAdicSel}
                duracionHoras={editHoras}
              />
            </div>

            {/* Bloque totales */}
            <div className="mt-2 shrink-0 rounded-xl border border-line bg-paper px-3.5 py-3 text-ink">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand/80">
                Totales
              </p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-baseline justify-between gap-3">
                  <span>
                    Sala
                    <span className="font-normal">
                      {" "}
                      · {formatDuracionHoras(editHoras)}
                    </span>
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatPrecio(editPrecioSala)}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span>Adicionales</span>
                  <span className="tabular-nums font-medium">
                    {formatPrecio(editAdicExtra)}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
                  <span className="font-semibold">
                    {editAdicDirty ? "Total (nuevo)" : "Total"}
                  </span>
                  <span className="tabular-nums text-base font-bold">
                    {formatPrecio(editTotal)}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span>Seña</span>
                  <span className="tabular-nums font-medium">
                    {formatPrecio(selected.senaPagada)}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                  <span className="text-base font-semibold">Saldo</span>
                  <span className="tabular-nums text-xl font-bold">
                    {formatPrecio(editSaldo)}
                  </span>
                </li>
              </ul>
            </div>

            {selected.estado === "hold" && selected.holdExpiresAt ? (
              <p className="shrink-0 text-xs text-amber-700">
                Hold vence:{" "}
                {new Date(selected.holdExpiresAt).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                })}
              </p>
            ) : null}

            {error ? (
              <p className="shrink-0 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(reprog)}
        onClose={() => setReprog(null)}
        title="Reprogramar reserva"
      >
        {reprog ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              start(async () => {
                const res = await reprogramarReservaAction({
                  reservaId: reprog.id,
                  fecha: reprogFecha,
                  horaInicio: String(fd.get("horaInicio") ?? ""),
                  horaFin: String(fd.get("horaFin") ?? ""),
                });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setReprog(null);
                router.refresh();
              });
            }}
          >
            <p className="text-sm text-muted">
              {reprog.clienteNombre} · {reprog.salaName}. La seña se mantiene
              en la misma reserva.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Nueva fecha</span>
              <DatePicker
                tone="paper"
                value={reprogFecha}
                onChange={setReprogFecha}
                aria-label="Nueva fecha"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Desde</span>
                <input
                  name="horaInicio"
                  required
                  pattern="\d{2}:\d{2}"
                  defaultValue={reprog.startsAt}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Hasta</span>
                <input
                  name="horaFin"
                  required
                  pattern="\d{2}:\d{2}"
                  defaultValue={reprog.endsAt}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <PanelButton type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Confirmar nuevo horario"}
            </PanelButton>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Nueva reserva"
        placement="center"
        className="max-h-[min(96vh,980px)]! sm:max-w-6xl!"
        bodyClassName="flex flex-col py-3 sm:py-3.5"
        headerClassName="px-5 py-4 sm:px-6 sm:py-5"
        footer={
          <div className="flex flex-col gap-2">
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <PanelButton
                type="submit"
                form="panel-create-reserva-form"
                disabled={pending}
              >
                {pending ? "Creando…" : "Crear reserva"}
              </PanelButton>
            </div>
          </div>
        }
      >
        <form
          id="panel-create-reserva-form"
          key={`${createDefaults.salaId ?? "s"}-${createDefaults.horaInicio ?? "h"}-${openCreate}`}
          className="flex min-h-0 flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const horaInicio = String(fd.get("horaInicio") ?? "");
            const horaFin = String(fd.get("horaFin") ?? "");
            if (parseHhMm(horaFin) <= parseHhMm(horaInicio)) {
              setError("El fin debe ser después del inicio");
              return;
            }
            const pedidos = Object.entries(createAdicSel)
              .filter(([, qty]) => qty > 0)
              .map(([id, cantidad]) => ({ id, cantidad }));
            setError(null);
            start(async () => {
              const res = await createReservaPanelAction({
                salaId: String(fd.get("salaId")),
                fecha: createDefaults.fecha ?? fecha,
                horaInicio,
                horaFin,
                clienteNombre: String(fd.get("clienteNombre") ?? ""),
                clienteTelefono: String(fd.get("clienteTelefono") ?? ""),
                clienteEmail: createClienteEmail.trim() || null,
                adicionales: pedidos,
                descuentoTipo:
                  createDescTipo === "none" || createDescValorNum <= 0
                    ? undefined
                    : createDescTipo,
                descuentoValor:
                  createDescTipo === "none" || createDescValorNum <= 0
                    ? undefined
                    : createDescValorNum.toFixed(2),
                senaMonto: "0",
                senaPagada: false,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpenCreate(false);
              router.refresh();
            });
          }}
        >
          {/* Bloque datos */}
          <div className="shrink-0 rounded-xl border border-line bg-surface p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">Sala</span>
                <select
                  name="salaId"
                  required
                  value={createSalaId}
                  onChange={(e) => {
                    const salaId = e.target.value;
                    const minDur =
                      salas.find((s) => s.id === salaId)?.duracionMinMinutos ??
                      duracionMinMinutos ??
                      60;
                    setCreateDefaults((d) => {
                      const inicio = d.horaInicio ?? createHoraInicio;
                      const minFin = parseHhMm(inicio) + minDur;
                      const fin = parseHhMm(d.horaFin ?? createHoraFin);
                      return {
                        ...d,
                        salaId,
                        horaFin:
                          fin < minFin
                            ? hhmm(Math.min(minFin, rango.endMin))
                            : d.horaFin,
                      };
                    });
                  }}
                  className="h-10 rounded-lg border border-line bg-paper px-2.5 text-sm text-ink"
                >
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">
                  Fecha del turno
                </span>
                <DatePicker
                  tone="paper"
                  compact
                  value={createDefaults.fecha ?? fecha}
                  onChange={(v) =>
                    setCreateDefaults((d) => ({ ...d, fecha: v || fecha }))
                  }
                  aria-label="Fecha de la reserva"
                />
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">Desde</span>
                <select
                  name="horaInicio"
                  required
                  value={createHoraInicio}
                  onChange={(e) => {
                    const inicio = e.target.value;
                    const minFin = parseHhMm(inicio) + createMinDur;
                    const finActual = parseHhMm(
                      createDefaults.horaFin ?? createHoraFin,
                    );
                    setCreateDefaults((d) => ({
                      ...d,
                      horaInicio: inicio,
                      horaFin:
                        finActual < minFin
                          ? hhmm(Math.min(minFin, rango.endMin))
                          : d.horaFin ?? createHoraFin,
                    }));
                  }}
                  className="h-10 rounded-lg border border-line bg-paper px-2.5 text-sm tabular-nums text-ink"
                >
                  {createOpcionesInicio.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">Hasta</span>
                <select
                  name="horaFin"
                  required
                  value={createHoraFin}
                  onChange={(e) =>
                    setCreateDefaults((d) => ({
                      ...d,
                      horaFin: e.target.value,
                    }))
                  }
                  className="h-10 rounded-lg border border-line bg-paper px-2.5 text-sm tabular-nums text-ink"
                >
                  {createOpcionesFin.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">Cliente</span>
                <FilterSelect
                  value={createClienteModo}
                  searchable
                  compact
                  tone="paper"
                  placeholder="Buscar cliente…"
                  aria-label="Buscar cliente"
                  className="min-w-0"
                  options={[
                    {
                      value: "__nuevo__",
                      label: "+ Nuevo cliente",
                      searchText: "nuevo",
                    },
                    ...clientes
                      .slice()
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                      .map((c) => ({
                        value: c.id,
                        label: c.nombre,
                        searchText: [c.nombre, c.banda, c.telefono, c.email]
                          .filter(Boolean)
                          .join(" "),
                      })),
                  ]}
                  onChange={(v) => {
                    setCreateClienteModo(v);
                    if (v === "__nuevo__") {
                      setCreateClienteNombre("");
                      setCreateClienteTelefono("");
                      setCreateClienteEmail("");
                      return;
                    }
                    const c = clientes.find((x) => x.id === v);
                    if (c) {
                      setCreateClienteNombre(c.nombre);
                      setCreateClienteTelefono(c.telefono);
                      setCreateClienteEmail(c.email ?? "");
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">Nombre</span>
                <input
                  name="clienteNombre"
                  required
                  value={createClienteNombre}
                  onChange={(e) => setCreateClienteNombre(e.target.value)}
                  readOnly={createClienteModo !== "__nuevo__"}
                  className={`h-10 rounded-lg border border-line px-2.5 text-sm text-ink ${
                    createClienteModo !== "__nuevo__"
                      ? "bg-surface-2 text-muted"
                      : "bg-paper"
                  }`}
                />
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">Teléfono</span>
                <input
                  name="clienteTelefono"
                  required
                  placeholder="11 5555-1234"
                  value={createClienteTelefono}
                  onChange={(e) => setCreateClienteTelefono(e.target.value)}
                  readOnly={createClienteModo !== "__nuevo__"}
                  className={`h-10 rounded-lg border border-line px-2.5 text-sm text-ink ${
                    createClienteModo !== "__nuevo__"
                      ? "bg-surface-2 text-muted"
                      : "bg-paper"
                  }`}
                />
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium text-muted">Email</span>
                <input
                  name="clienteEmail"
                  type="email"
                  required={createClienteModo === "__nuevo__"}
                  placeholder="cliente@email.com"
                  value={createClienteEmail}
                  onChange={(e) => setCreateClienteEmail(e.target.value)}
                  readOnly={createClienteModo !== "__nuevo__"}
                  className={`h-10 rounded-lg border border-line px-2.5 text-sm text-ink ${
                    createClienteModo !== "__nuevo__"
                      ? "bg-surface-2 text-muted"
                      : "bg-paper"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Bloque adicionales */}
          <div className="shrink-0">
            <AdicionalesPicker
              title="Adicionales"
              adicionales={adicionales}
              sel={createAdicSel}
              onChange={setCreateAdicSel}
              duracionHoras={Math.max(1, createDuracionHoras)}
            />
          </div>

          {/* Bloque descuentos */}
          <div className="shrink-0 rounded-xl border border-line bg-paper px-3.5 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand/80">
              Promociones / descuentos
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-line">
                {(
                  [
                    ["none", "Sin desc."],
                    ["porcentaje", "%"],
                    ["fijo", "$"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCreateDescTipo(val)}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      createDescTipo === val
                        ? "bg-brand text-paper"
                        : "bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {createDescTipo !== "none" ? (
                <div className="flex items-center gap-1">
                  <input
                    inputMode="decimal"
                    placeholder={
                      createDescTipo === "porcentaje" ? "10" : "1000"
                    }
                    value={createDescValor}
                    onChange={(e) => setCreateDescValor(e.target.value)}
                    className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm tabular-nums outline-none focus:border-brand/50"
                  />
                  <span className="text-sm text-muted">
                    {createDescTipo === "porcentaje" ? "%" : "$"}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Bloque totales */}
          <div className="shrink-0 rounded-xl border border-line bg-paper px-3.5 py-3 text-ink">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand/80">
              Totales
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-baseline justify-between gap-3">
                <span>
                  Sala
                  <span className="font-normal">
                    {" "}
                    · {formatDuracionHoras(createDuracionHoras)}
                  </span>
                </span>
                <span className="tabular-nums font-medium">
                  {formatPrecio(createPrecioSala)}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span>Adicionales</span>
                <span className="tabular-nums font-medium">
                  {formatPrecio(createAdicExtra)}
                </span>
              </li>
              {createDescuento > 0 ? (
                <li className="flex items-baseline justify-between gap-3">
                  <span>Descuento</span>
                  <span className="tabular-nums font-medium">
                    − {formatPrecio(createDescuento)}
                  </span>
                </li>
              ) : null}
              <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
                <span className="font-semibold">Total</span>
                <span className="tabular-nums text-base font-bold">
                  {formatPrecio(createTotal)}
                </span>
              </li>
            </ul>
          </div>
        </form>
      </Modal>
    </PanelPage>
  );
}

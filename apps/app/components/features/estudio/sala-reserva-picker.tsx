"use client";

import {
  ReservaCheckoutModal,
  type DemoPoliticaSena,
} from "@/components/features/estudio/reserva-checkout-modal";
import { formatPrecio } from "@/lib/directorio-data";
import type { EstudioSala } from "@/lib/estudio-detalle-data";
import { deleteHold, fetchOcupacion, type ReglaPublica } from "@/lib/holds-api";
import { useSalaHolds } from "@/lib/use-sala-holds";
import { POLITICA_DEFAULTS } from "@repo/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Slot = {
  hora: string;
  precio: number;
  precioOriginal: number;
  ocupado: boolean;
  pasado: boolean;
  descuento?: {
    tipo: "continuo" | "puntual";
    label: string;
    porcentaje: number;
  };
};

type Props = {
  sala: EstudioSala;
};

type DescMatch = {
  tipo: "continuo" | "puntual";
  label: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  fechaDesde?: string;
  fechaHasta?: string;
  porcentaje: number;
  precioPorHora: number;
};

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const HORAS_FALLBACK = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

function dateKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function horaToMinutes(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function buildHorasBase(inicio?: string | null, fin?: string | null): string[] {
  const start =
    inicio && /^\d{2}:\d{2}$/.test(inicio) ? horaToMinutes(inicio) : 10 * 60;
  const end =
    fin && /^\d{2}:\d{2}$/.test(fin)
      ? fin === "24:00"
        ? 24 * 60
        : horaToMinutes(fin)
      : 24 * 60;
  const out: string[] = [];
  for (let m = start; m < end; m += 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out.length > 0 ? out : [...HORAS_FALLBACK];
}

function buildHorasFromFranjas(
  franjas: Array<{ startTime: string; endTime: string }>,
): string[] {
  const set = new Set<string>();
  for (const f of franjas) {
    for (const h of buildHorasBase(f.startTime.slice(0, 5), f.endTime.slice(0, 5))) {
      set.add(h);
    }
  }
  return [...set].sort();
}

function reglasToDesc(reglas: ReglaPublica[], precioBase: number): DescMatch[] {
  return reglas.map((r) => {
    const pct =
      r.descuentoPorcentaje != null
        ? Math.round(r.descuentoPorcentaje)
        : precioBase > 0
          ? Math.max(
              0,
              Math.round((1 - r.precioPorHora / precioBase) * 100),
            )
          : 0;
    return {
      tipo: r.tipo,
      label: r.nombre ?? (r.tipo === "puntual" ? "Promo" : "Promo"),
      daysOfWeek: r.daysOfWeek,
      startTime: r.startTime ?? "00:00",
      endTime: r.endTime ?? "24:00",
      fechaDesde: r.fechaDesde ?? undefined,
      fechaHasta: r.fechaHasta ?? undefined,
      porcentaje: pct,
      precioPorHora: r.precioPorHora,
    };
  });
}

function matchDescuento(desc: DescMatch, date: Date, hora: string): boolean {
  const key = dateKeyLocal(date);
  if (desc.fechaDesde && key < desc.fechaDesde) return false;
  if (desc.fechaHasta && key > desc.fechaHasta) return false;
  if (desc.tipo === "puntual" && (!desc.fechaDesde || !desc.fechaHasta)) {
    return false;
  }
  if (
    desc.daysOfWeek.length > 0 &&
    !desc.daysOfWeek.includes(date.getDay())
  ) {
    return false;
  }
  const min = horaToMinutes(hora);
  const from = horaToMinutes(desc.startTime);
  const to =
    desc.endTime === "24:00" ? 24 * 60 : horaToMinutes(desc.endTime);
  return min >= from && min < to;
}

function mejorDescuento(
  descuentos: DescMatch[],
  date: Date,
  hora: string,
): DescMatch | null {
  const hits = descuentos.filter((d) => matchDescuento(d, date, hora));
  if (hits.length === 0) return null;
  hits.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "puntual" ? -1 : 1;
    return b.porcentaje - a.porcentaje;
  });
  return hits[0] ?? null;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function hayHuecosEntreHoras(horas: string[]): boolean {
  if (horas.length < 2) return false;
  const sorted = [...horas].sort(
    (a, b) => horaToMinutes(a) - horaToMinutes(b),
  );
  for (let i = 1; i < sorted.length; i++) {
    if (horaToMinutes(sorted[i]!) - horaToMinutes(sorted[i - 1]!) !== 60) {
      return true;
    }
  }
  return false;
}

function minutesToHora(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Completa huecos de 60 min entre la primera y la última hora. */
function expandirHorasContiguas(horas: string[]): string[] {
  const sorted = [...new Set(horas)].sort(
    (a, b) => horaToMinutes(a) - horaToMinutes(b),
  );
  if (sorted.length <= 1) return sorted;
  const out: string[] = [];
  const from = horaToMinutes(sorted[0]!);
  const to = horaToMinutes(sorted[sorted.length - 1]!);
  for (let m = from; m <= to; m += 60) {
    out.push(minutesToHora(m));
  }
  return out;
}

function rangosHoras(horas: string[]): string[] {
  if (horas.length === 0) return [];
  const sorted = [...horas].sort(
    (a, b) => horaToMinutes(a) - horaToMinutes(b),
  );
  const rangos: string[] = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (horaToMinutes(cur) - horaToMinutes(prev) === 60) {
      prev = cur;
      continue;
    }
    rangos.push(start === prev ? start : `${start}–${prev}`);
    start = cur;
    prev = cur;
  }
  rangos.push(start === prev ? start : `${start}–${prev}`);
  return rangos;
}

function buildSlots(
  precioBase: number,
  selectedDate: Date,
  now: Date,
  ocupadosExtra: Set<string>,
  horasBase: string[],
  reglas: ReglaPublica[],
): Slot[] {
  const isToday = sameDay(selectedDate, now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const descuentos = reglasToDesc(reglas, precioBase);

  return horasBase.map((hora) => {
    const pasado = isToday && horaToMinutes(hora) <= nowMin;
    const desc = mejorDescuento(descuentos, selectedDate, hora);
    const precioOriginal = precioBase;
    const precio = desc ? Math.round(desc.precioPorHora) : precioBase;
    return {
      hora,
      precio,
      precioOriginal,
      ocupado: !pasado && ocupadosExtra.has(hora),
      pasado,
      descuento:
        desc && desc.porcentaje > 0
          ? {
              tipo: desc.tipo,
              label: desc.label,
              porcentaje: desc.porcentaje,
            }
          : undefined,
    };
  });
}

export function SalaReservaPicker({ sala }: Props) {
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => startOfDay(now), [now]);
  const realSala = isUuid(sala.id);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedHoras, setSelectedHoras] = useState<string[]>([]);
  const [holdTick, setHoldTick] = useState(() => Date.now());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [holdExpiredMsg, setHoldExpiredMsg] = useState(false);
  const [ocupadosApi, setOcupadosApi] = useState<Set<string>>(new Set());

  const selectedDate = useMemo(
    () => new Date(year, month, selectedDay),
    [year, month, selectedDay],
  );
  const fechaKey = useMemo(
    () => dateKeyLocal(selectedDate),
    [selectedDate],
  );

  const liberarHold = useCallback(() => {
    setSelectedHoras((prev) => {
      if (prev.length > 0) setHoldExpiredMsg(true);
      return [];
    });
    setCheckoutOpen(false);
    void deleteHold(sala.id);
  }, [sala.id]);

  const onConflict = useCallback((horas: string[]) => {
    setSelectedHoras((prev) => prev.filter((h) => !horas.includes(h)));
  }, []);

  const { connected, syncError, ownHold, foreignByHora, politica } =
    useSalaHolds({
      salaId: sala.id,
      fecha: fechaKey,
      selectedHoras: realSala ? selectedHoras : [],
      onOwnHoldExpired: liberarHold,
      onConflict,
    });

  const precioBase =
    (politica.precioHora > 0 ? politica.precioHora : sala.precioHora) ||
    sala.precioHora;

  const horasBase = useMemo(() => {
    if (realSala && politica.horarios.length > 0) {
      const dow = selectedDate.getDay();
      const delDia = politica.horarios.filter((x) => x.dayOfWeek === dow);
      if (delDia.length === 0) return [];
      return buildHorasFromFranjas(delDia);
    }
    return buildHorasBase(sala.horarioInicio, sala.horarioFin);
  }, [
    realSala,
    politica.horarios,
    selectedDate,
    sala.horarioInicio,
    sala.horarioFin,
  ]);

  const reglas = realSala ? politica.reglas : [];

  const politicaCheckout: DemoPoliticaSena = useMemo(
    () => ({
      senaModo: politica.senaModo,
      senaTipo: politica.senaTipo,
      senaValor: politica.senaValor,
      holdMinutos: politica.holdMinutos || POLITICA_DEFAULTS.holdMinutos,
      cancelacionVentanaHoras: politica.cancelacionVentanaHoras,
      senaDestinoCancelacion: politica.senaDestinoCancelacion,
    }),
    [politica],
  );

  useEffect(() => {
    if (!realSala) {
      setOcupadosApi(new Set());
      return;
    }
    let cancelled = false;
    void fetchOcupacion(sala.id, fechaKey)
      .then((data) => {
        if (!cancelled) setOcupadosApi(new Set(data.horas));
      })
      .catch(() => {
        if (!cancelled) setOcupadosApi(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [sala.id, fechaKey, ownHold?.id, selectedHoras.length, realSala]);

  const holdExpiresAt = ownHold
    ? new Date(ownHold.expiresAt).getTime()
    : null;

  useEffect(() => {
    if (!holdExpiresAt) return;
    const id = window.setInterval(() => setHoldTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [holdExpiresAt]);

  useEffect(() => {
    if (selectedHoras.length > 0) setHoldExpiredMsg(false);
  }, [selectedHoras.length]);

  const holdLeftMs = holdExpiresAt ? holdExpiresAt - holdTick : 0;

  /** Ocupación real (reservas/bloqueos), sin contar el hold de esta sesión. */
  const ocupadosSinPropios = useMemo(() => {
    const set = new Set(ocupadosApi);
    if (ownHold?.fecha === fechaKey) {
      for (const h of ownHold.horas) set.delete(h);
    }
    for (const h of selectedHoras) set.delete(h);
    return set;
  }, [ocupadosApi, ownHold, fechaKey, selectedHoras]);

  const cells = useMemo(() => buildMonth(year, month), [year, month]);
  const slots = useMemo(
    () =>
      buildSlots(
        precioBase,
        selectedDate,
        now,
        ocupadosSinPropios,
        horasBase,
        reglas,
      ),
    [precioBase, selectedDate, now, ocupadosSinPropios, horasBase, reglas],
  );

  const labelDia = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(selectedDate);
  }, [selectedDate]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        month: "long",
        year: "numeric",
      }).format(new Date(year, month, 1)),
    [year, month],
  );

  const noContinuos = useMemo(
    () => hayHuecosEntreHoras(selectedHoras),
    [selectedHoras],
  );

  const horasEfectivas = useMemo(
    () => expandirHorasContiguas(selectedHoras),
    [selectedHoras],
  );

  const rangosSeleccion = useMemo(
    () => rangosHoras(horasEfectivas),
    [horasEfectivas],
  );

  const total = useMemo(() => {
    if (
      ownHold?.precioTotal != null &&
      ownHold.fecha === fechaKey &&
      ownHold.horas.length === horasEfectivas.length &&
      [...ownHold.horas].sort().join() === [...horasEfectivas].sort().join()
    ) {
      return Math.round(ownHold.precioTotal);
    }
    return horasEfectivas.reduce((sum, h) => {
      const slot = slots.find((s) => s.hora === h);
      return sum + (slot?.precio ?? 0);
    }, 0);
  }, [horasEfectivas, slots, ownHold, fechaKey]);

  const ahorro = useMemo(() => {
    return horasEfectivas.reduce((sum, h) => {
      const slot = slots.find((s) => s.hora === h);
      if (!slot?.descuento) return sum;
      return sum + Math.max(0, slot.precioOriginal - slot.precio);
    }, 0);
  }, [horasEfectivas, slots]);

  const canPrevMonth =
    year > today.getFullYear() ||
    (year === today.getFullYear() && month > today.getMonth());

  const selectDay = (day: number) => {
    const d = new Date(year, month, day);
    if (startOfDay(d) < today) return;
    setSelectedDay(day);
    setSelectedHoras([]);
    setCheckoutOpen(false);
  };

  const buscarDescuentos = () => {
    const currentHasPromo = slots.some(
      (s) =>
        s.descuento &&
        !s.pasado &&
        !s.ocupado &&
        !foreignByHora.has(s.hora),
    );
    const base = new Date(currentHasPromo ? selectedDate : today);
    if (currentHasPromo) base.setDate(base.getDate() + 1);
    if (startOfDay(base) < today) {
      base.setTime(today.getTime());
    }

    for (let i = 0; i < 60; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const daySlots = buildSlots(
        precioBase,
        d,
        now,
        new Set(),
        horasBase,
        reglas,
      );
      const hayPromo = daySlots.some(
        (s) => s.descuento && !s.pasado && !s.ocupado,
      );
      if (!hayPromo) continue;
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDay(d.getDate());
      setSelectedHoras([]);
      return;
    }
  };

  const toggleHora = (hora: string) => {
    if (foreignByHora.has(hora)) return;
    setSelectedHoras((prev) =>
      prev.includes(hora) ? prev.filter((h) => h !== hora) : [...prev, hora].sort(),
    );
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    if (
      d.getFullYear() < today.getFullYear() ||
      (d.getFullYear() === today.getFullYear() && d.getMonth() < today.getMonth())
    ) {
      return;
    }
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    const daysIn = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    let nextDay = Math.min(selectedDay, daysIn);
    const candidate = startOfDay(new Date(d.getFullYear(), d.getMonth(), nextDay));
    if (candidate < today) {
      nextDay =
        d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
          ? today.getDate()
          : 1;
    }
    setSelectedDay(nextDay);
    setSelectedHoras([]);
  };

  const canContinuar =
    selectedHoras.length > 0 && (realSala ? Boolean(ownHold) : true);

  return (
    <section className="relative rounded-2xl border border-line bg-surface p-4 md:p-6">
      {holdExpiresAt && selectedHoras.length > 0 && (
        <div
          className="absolute right-3 top-3 z-10 rounded-xl border border-brand/50 bg-brand/20 px-3 py-2 text-center sm:right-4 sm:top-4"
          role="status"
          aria-live="polite"
          title="Estos horarios quedan reservados para vos hasta que completes el pago o venza el tiempo"
        >
          <p className="text-xs font-medium text-white">
            {connected ? "Tenés para terminar tu reserva" : "Reconectando…"}
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums leading-none text-brand sm:text-2xl">
            {formatCountdown(holdLeftMs)}
          </p>
        </div>
      )}

      <div className={holdExpiresAt && selectedHoras.length > 0 ? "pr-[12.5rem]" : undefined}>
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight md:text-2xl">
          Elegí día y horario
        </h2>
        <p className="mt-1 text-sm text-muted">
          Podés sumar varias horas: tocá para seleccionar o sacar.
        </p>
      </div>

      {syncError && (
        <p
          className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200"
          role="status"
        >
          {syncError}
        </p>
      )}

      {holdExpiredMsg && (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200"
          role="status"
        >
          <p className="min-w-0 flex-1">
            Se liberaron los horarios: el tiempo de reserva temporal venció.
            Volvé a elegir.
          </p>
          <button
            type="button"
            onClick={() => setHoldExpiredMsg(false)}
            className="shrink-0 rounded-lg px-1.5 py-0.5 text-amber-200/80 hover:bg-amber-500/20 hover:text-amber-100"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canPrevMonth}
              className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
              aria-label="Mes anterior"
            >
              ←
            </button>
            <p className="text-sm font-medium capitalize text-ink">{monthLabel}</p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Mes siguiente"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
            {cells.map((day, i) => {
              if (day == null) return <span key={`e-${i}`} />;
              const date = new Date(year, month, day);
              const past = startOfDay(date) < today;
              const selected = day === selectedDay;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={past}
                  onClick={() => selectDay(day)}
                  className={`aspect-square rounded-full text-sm font-medium transition ${
                    past
                      ? "cursor-not-allowed text-muted/35"
                      : selected
                        ? "bg-brand text-paper"
                        : "text-ink hover:bg-surface-2"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium capitalize text-ink">{labelDia}</p>
            {reglas.length > 0 && (
              <button
                type="button"
                onClick={buscarDescuentos}
                className="rounded-lg border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs font-semibold leading-[1.4] text-brand transition hover:bg-brand/20 sm:text-sm"
              >
                Buscar descuentos
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {slots.map((s) => {
              const active = selectedHoras.includes(s.hora);
              const espera = !active ? foreignByHora.get(s.hora) : undefined;
              if (s.pasado) {
                return (
                  <div
                    key={s.hora}
                    className="rounded-xl border border-line bg-paper/40 px-3 py-3 text-center opacity-40"
                  >
                    <p className="text-sm font-medium text-muted">{s.hora}</p>
                    <p className="text-xs text-muted">Finalizado</p>
                  </div>
                );
              }
              if (s.ocupado && !active) {
                return (
                  <div
                    key={s.hora}
                    className="rounded-xl border border-line bg-paper/40 px-3 py-3 text-center opacity-50"
                  >
                    <p className="text-sm font-medium text-muted">{s.hora}</p>
                    <p className="text-xs text-muted">Ocupado</p>
                  </div>
                );
              }
              if (espera) {
                return (
                  <div
                    key={s.hora}
                    className="relative rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-center"
                  >
                    <span className="group absolute -top-1.5 right-1.5 z-10">
                      <button
                        type="button"
                        tabIndex={0}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold leading-none text-paper"
                        aria-label="Otro usuario está en proceso de reservar la sala para este horario"
                      >
                        !
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 w-48 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-left text-[11px] leading-snug text-ink opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        Otro usuario está en proceso de reservar la sala para este
                        horario.
                      </span>
                    </span>
                    <p className="text-sm font-medium text-ink">{s.hora}</p>
                    <p className="text-xs font-semibold text-amber-200">
                      En espera
                    </p>
                  </div>
                );
              }
              return (
                <button
                  key={s.hora}
                  type="button"
                  onClick={() => toggleHora(s.hora)}
                  aria-pressed={active}
                  className={`relative rounded-xl border px-3 py-3 text-center transition ${
                    active
                      ? "border-brand bg-brand/15 ring-1 ring-brand/40"
                      : "border-line bg-paper hover:border-brand/50"
                  }`}
                >
                  {s.descuento && (
                    <span className="absolute -top-1.5 right-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-paper">
                      -{s.descuento.porcentaje}%
                    </span>
                  )}
                  <p className="text-sm font-semibold text-ink">{s.hora}</p>
                  {s.descuento ? (
                    <p className="text-xs">
                      <span className="text-muted line-through">
                        {formatPrecio(s.precioOriginal)}
                      </span>{" "}
                      <span className="font-medium text-brand">
                        {formatPrecio(s.precio)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted">{formatPrecio(s.precio)}</p>
                  )}
                </button>
              );
            })}
          </div>

          {noContinuos && (
            <p
              className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200"
              role="status"
            >
              Hay un hueco entre tus horarios. Para que el turno sea continuo,
              incluimos las horas del medio ({rangosSeleccion.join(", ")} ·{" "}
              {formatPrecio(total)}).
            </p>
          )}

          <button
            type="button"
            disabled={!canContinuar}
            onClick={() => {
              if (noContinuos) setSelectedHoras(horasEfectivas);
              setCheckoutOpen(true);
            }}
            className="mt-4 overflow-visible rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold leading-[1.4] text-paper transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {selectedHoras.length === 0
              ? "Elegí al menos un horario"
              : realSala && !ownHold
                ? "Bloqueando horario…"
                : `Continuar · ${rangosSeleccion.join(", ")} · ${formatPrecio(total)}`}
          </button>
          {selectedHoras.length > 0 && ahorro > 0 ? (
            <p className="mt-2">
              <span className="inline-flex items-center rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
                Ahorro {formatPrecio(ahorro)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <ReservaCheckoutModal
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
        }}
        onConfirmed={() => {
          setSelectedHoras([]);
          setCheckoutOpen(false);
          if (realSala) {
            void fetchOcupacion(sala.id, fechaKey).then((data) =>
              setOcupadosApi(new Set(data.horas)),
            );
          }
        }}
        sala={sala}
        fecha={fechaKey}
        fechaLabel={labelDia}
        horas={horasEfectivas}
        rangos={rangosSeleccion}
        totalSala={total}
        holdExpiresAt={holdExpiresAt}
        politica={politicaCheckout}
        onHoldExpired={liberarHold}
      />
    </section>
  );
}

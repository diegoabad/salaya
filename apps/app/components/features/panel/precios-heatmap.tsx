"use client";

import { formatPrecio } from "@/lib/directorio-data";
import { cotizarPrecioSala } from "@/lib/cotizar-precio";
import {
  fechaHoyIso,
  parseYmd,
  ymdFromDate,
} from "@/lib/fechas";
import type { ReglaPrecioDto } from "@/app/actions/precios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DIAS = [
  { day: 1, label: "Lunes", short: "Lu" },
  { day: 2, label: "Martes", short: "Ma" },
  { day: 3, label: "Miércoles", short: "Mi" },
  { day: 4, label: "Jueves", short: "Ju" },
  { day: 5, label: "Viernes", short: "Vi" },
  { day: 6, label: "Sábado", short: "Sá" },
  { day: 0, label: "Domingo", short: "Do" },
] as const;

/** Filas: 10:00 … 23:00 */
const HOURS = Array.from({ length: 14 }, (_, i) => 10 + i);

export type HeatSelection = {
  days: number[];
  hourFrom: number;
  hourTo: number;
};

type Props = {
  salaId: string;
  salaName: string;
  precioBase: number;
  reglas: ReglaPrecioDto[];
  /** Permite seleccionar celdas */
  editable?: boolean;
  onSelectionReady: (sel: HeatSelection) => void;
};

function fechaParaDiaSemana(targetDow: number): string {
  const hoy = fechaHoyIso();
  const d = parseYmd(hoy);
  if (!d) return hoy;
  const current = d.getDay();
  let delta = targetDow - current;
  if (delta < 0) delta += 7;
  d.setDate(d.getDate() + delta);
  return ymdFromDate(d);
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function hourEndTime(hourStart: number): string {
  if (hourStart >= 23) return "23:59";
  return `${String(hourStart + 1).padStart(2, "0")}:00`;
}

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`;
}

function priceToRgb(price: number, min: number, max: number): string {
  const t =
    max <= min ? 0.35 : Math.min(1, Math.max(0, (price - min) / (max - min)));
  const r = Math.round(42 + (204 - 42) * t);
  const g = Math.round(58 + (255 - 58) * t);
  const b = Math.round(18 + (0 - 18) * t);
  return `rgb(${r},${g},${b})`;
}

function textForBg(price: number, min: number, max: number): string {
  const t = max <= min ? 0.35 : (price - min) / (max - min);
  return t > 0.55 ? "#1a1a1a" : "#f5f5f0";
}

export function PreciosHeatmap({
  salaId,
  salaName,
  precioBase,
  reglas,
  editable = false,
  onSelectionReady,
}: Props) {
  const onReadyRef = useRef(onSelectionReady);
  onReadyRef.current = onSelectionReady;

  const fechas = useMemo(() => {
    const map = new Map<number, string>();
    for (const { day } of DIAS) map.set(day, fechaParaDiaSemana(day));
    return map;
  }, []);

  const precios = useMemo(() => {
    const grid = new Map<string, number>();
    for (const { day } of DIAS) {
      const fecha = fechas.get(day)!;
      for (const h of HOURS) {
        const total = cotizarPrecioSala({
          precioHoraBase: precioBase,
          reglas,
          salaId,
          fecha,
          horaInicio: hourLabel(h),
          horaFin: hourEndTime(h),
        });
        const hours = h >= 23 ? 59 / 60 : 1;
        grid.set(cellKey(day, h), Math.round(total / hours));
      }
    }
    return grid;
  }, [fechas, precioBase, reglas, salaId]);

  const { minP, maxP } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const v of precios.values()) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) min = precioBase;
    if (!Number.isFinite(max)) max = precioBase;
    return { minP: min, maxP: max };
  }, [precios, precioBase]);

  const dragging = useRef(false);
  const anchor = useRef<{ dayIdx: number; hourIdx: number } | null>(null);
  const selRef = useRef<{
    dayIdx0: number;
    dayIdx1: number;
    hourIdx0: number;
    hourIdx1: number;
  } | null>(null);
  const [sel, setSel] = useState<typeof selRef.current>(null);

  const updateSel = useCallback(
    (next: NonNullable<typeof selRef.current>) => {
      selRef.current = next;
      setSel(next);
    },
    [],
  );

  const clearSel = useCallback(() => {
    selRef.current = null;
    setSel(null);
  }, []);

  useEffect(() => {
    if (!editable) clearSel();
  }, [editable, clearSel]);

  useEffect(() => {
    if (!editable) return;

    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !anchor.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest("[data-heat-cell]") as HTMLElement | null;
      if (!cell) return;
      const dayIdx = Number(cell.dataset.dayIdx);
      const hourIdx = Number(cell.dataset.hourIdx);
      if (!Number.isFinite(dayIdx) || !Number.isFinite(hourIdx)) return;
      updateSel({
        dayIdx0: anchor.current.dayIdx,
        dayIdx1: dayIdx,
        hourIdx0: anchor.current.hourIdx,
        hourIdx1: hourIdx,
      });
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const current = selRef.current;
      if (!current) return;
      const d0 = Math.min(current.dayIdx0, current.dayIdx1);
      const d1 = Math.max(current.dayIdx0, current.dayIdx1);
      const h0 = Math.min(current.hourIdx0, current.hourIdx1);
      const h1 = Math.max(current.hourIdx0, current.hourIdx1);
      onReadyRef.current({
        days: DIAS.slice(d0, d1 + 1).map((x) => x.day),
        hourFrom: HOURS[h0]!,
        hourTo: HOURS[h1]!,
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [editable, updateSel]);

  const startDrag = (dayIdx: number, hourIdx: number) => {
    if (!editable) return;
    dragging.current = true;
    anchor.current = { dayIdx, hourIdx };
    updateSel({
      dayIdx0: dayIdx,
      dayIdx1: dayIdx,
      hourIdx0: hourIdx,
      hourIdx1: hourIdx,
    });
  };

  const isSelected = (dayIdx: number, hourIdx: number) => {
    if (!sel) return false;
    const d0 = Math.min(sel.dayIdx0, sel.dayIdx1);
    const d1 = Math.max(sel.dayIdx0, sel.dayIdx1);
    const h0 = Math.min(sel.hourIdx0, sel.hourIdx1);
    const h1 = Math.max(sel.hourIdx0, sel.hourIdx1);
    return dayIdx >= d0 && dayIdx <= d1 && hourIdx >= h0 && hourIdx <= h1;
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-surface ${
        editable ? "border-brand/50" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2.5 md:px-4">
        <p className="text-sm font-medium text-ink">
          Precios por hora — {salaName}
          {editable ? (
            <span className="ml-2 rounded-md bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              Editando
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted">
          <span>{formatPrecio(minP)}</span>
          <span
            className="h-2.5 w-28 rounded-full md:w-36"
            style={{
              background: `linear-gradient(90deg, ${priceToRgb(minP, minP, maxP)}, ${priceToRgb(maxP, minP, maxP)})`,
            }}
            aria-hidden
          />
          <span>{formatPrecio(maxP)}</span>
        </div>
      </div>

      <div className="overflow-x-auto p-2 md:p-3">
        <div
          className="inline-grid min-w-full gap-1.5"
          style={{
            gridTemplateColumns: `minmax(3.25rem,auto) repeat(${DIAS.length}, minmax(4.5rem,1fr))`,
          }}
        >
          <div />
          {DIAS.map(({ day, label, short }) => (
            <div
              key={day}
              className="px-0.5 pb-1 text-center text-[11px] font-semibold text-ink"
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </div>
          ))}

          {HOURS.map((h, hourIdx) => (
            <div key={h} className="contents">
              <div className="flex items-center pr-1 text-[11px] font-medium tabular-nums text-muted">
                {hourLabel(h)}
              </div>
              {DIAS.map(({ day, label }, dayIdx) => {
                const price = precios.get(cellKey(day, h)) ?? precioBase;
                const selected = isSelected(dayIdx, hourIdx);
                const bg = priceToRgb(price, minP, maxP);
                const fg = textForBg(price, minP, maxP);
                return (
                  <button
                    key={cellKey(day, h)}
                    type="button"
                    data-heat-cell
                    data-day-idx={dayIdx}
                    data-hour-idx={hourIdx}
                    onPointerDown={(e) => {
                      if (!editable) return;
                      e.preventDefault();
                      startDrag(dayIdx, hourIdx);
                    }}
                    className={`relative z-0 select-none touch-none rounded-md px-0.5 py-2 text-center text-[10px] font-semibold tabular-nums leading-tight transition sm:text-[11px] md:py-2.5 ${
                      editable ? "cursor-crosshair" : "cursor-default"
                    } ${
                      selected
                        ? "z-10 scale-[0.92] shadow-[0_0_0_2px_#fff,0_0_0_4px_#0284c7]"
                        : ""
                    }`}
                    style={{ backgroundColor: bg, color: fg }}
                    aria-label={`${label} ${hourLabel(h)} ${formatPrecio(price)}`}
                  >
                    {formatPrecio(price)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="border-t border-line px-3 py-2 text-xs text-muted md:px-4">
        {editable
          ? "Tocá o arrastrá celdas → se abre el modal para poner el precio."
          : "Tocá Editar para modificar precios en la grilla."}
      </p>
    </div>
  );
}

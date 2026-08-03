"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  celdasMesCalendario,
  compareYmd,
  fechaHoyIso,
  formatFechaInputLive,
  formatFechaYmd,
  parseFechaDdMmAaaa,
  parseYmd,
  rangoAniosCalendario,
} from "@/lib/fechas";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const MESES_ABREV = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 340;
const VIEWPORT_PAD = 8;

export type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  clearable?: boolean;
  compact?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Fondo del campo: `surface` sobre la página, `paper` dentro de tarjetas/modales */
  tone?: "surface" | "paper";
  "aria-label"?: string;
  /** Espeja el valor en un input hidden para formularios */
  name?: string;
};

type PopoverCoords = {
  top: number;
  left: number;
  width: number;
};

function IconCalendar({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function mesInicial(value: string, min?: string) {
  const parsed = value ? parseYmd(value) : null;
  if (parsed) return { year: parsed.getFullYear(), month: parsed.getMonth() };
  if (min) {
    const m = parseYmd(min);
    if (m) return { year: m.getFullYear(), month: m.getMonth() };
  }
  const hoy = parseYmd(fechaHoyIso())!;
  return { year: hoy.getFullYear(), month: hoy.getMonth() };
}

function calcularPosicion(trigger: HTMLElement): PopoverCoords {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(POPOVER_WIDTH, Math.max(rect.width, 280));
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
  const spaceAbove = rect.top - VIEWPORT_PAD;
  const above = spaceBelow < POPOVER_HEIGHT && spaceAbove > spaceBelow;

  let top = above ? rect.top - POPOVER_HEIGHT - 6 : rect.bottom + 6;
  let left = rect.left;

  if (left + width > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - width - VIEWPORT_PAD;
  }
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

  top = Math.max(
    VIEWPORT_PAD,
    Math.min(top, window.innerHeight - POPOVER_HEIGHT - VIEWPORT_PAD),
  );

  return { top, left, width };
}

function textoDesdeValor(value: string): string {
  return value ? formatFechaYmd(value) : "";
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  clearable = false,
  compact = false,
  disabled = false,
  placeholder = "dd/mm/aaaa",
  className = "",
  tone = "surface",
  "aria-label": ariaLabel,
  name,
}: DatePickerProps) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editandoRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const [{ year, month }, setView] = useState(() => mesInicial(value, min));
  const [inputText, setInputText] = useState(() => textoDesdeValor(value));
  const [invalido, setInvalido] = useState(false);

  const hoy = fechaHoyIso();

  const { minYear, maxYear } = useMemo(
    () => rangoAniosCalendario(min, max),
    [min, max],
  );

  const opcionesAnio = useMemo(() => {
    const años: number[] = [];
    for (let y = maxYear; y >= minYear; y--) años.push(y);
    return años;
  }, [minYear, maxYear]);

  const celdas = useMemo(() => celdasMesCalendario(year, month), [year, month]);

  useEffect(() => {
    if (!editandoRef.current) {
      setInputText(textoDesdeValor(value));
      setInvalido(false);
    }
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    setCoords(calcularPosicion(triggerRef.current));
  }, []);

  useEffect(() => {
    if (!open) return;
    setView(mesInicial(value, min));
  }, [open, value, min]);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Evita que el Escape también cierre el modal que contiene el picker
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  function fueraDeRango(iso: string): boolean {
    if (min && compareYmd(iso, min) < 0) return true;
    if (max && compareYmd(iso, max) > 0) return true;
    return false;
  }

  function seleccionar(iso: string) {
    if (fueraDeRango(iso)) return;
    onChange(iso);
    setInputText(textoDesdeValor(iso));
    setInvalido(false);
    editandoRef.current = false;
    setOpen(false);
  }

  function limpiar(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onChange("");
    setInputText("");
    setInvalido(false);
    editandoRef.current = false;
    setOpen(false);
  }

  function confirmarTexto(): boolean {
    const raw = inputText.trim();
    if (!raw) {
      if (clearable) {
        onChange("");
        setInvalido(false);
        return true;
      }
      setInputText(textoDesdeValor(value));
      setInvalido(false);
      return true;
    }

    const iso = parseFechaDdMmAaaa(raw);
    if (!iso || fueraDeRango(iso)) {
      setInvalido(true);
      return false;
    }

    onChange(iso);
    setInputText(textoDesdeValor(iso));
    setInvalido(false);
    const parsed = parseYmd(iso);
    if (parsed) setView({ year: parsed.getFullYear(), month: parsed.getMonth() });
    return true;
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    setInvalido(false);
    setInputText(formatFechaInputLive(e.target.value));
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (confirmarTexto()) inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setInputText(textoDesdeValor(value));
      setInvalido(false);
      editandoRef.current = false;
      inputRef.current?.blur();
    }
  }

  const puedeLimpiar = clearable && Boolean(value) && !disabled;
  const navPrevOff = year < minYear || (year === minYear && month === 0);
  const navNextOff = year > maxYear || (year === maxYear && month === 11);

  const fieldPad = compact ? "py-2 pl-2.5" : "py-2.5 pl-3.5";
  const iconBtn = compact ? "h-7 w-7" : "h-8 w-8";
  const fieldRound = compact ? "rounded-lg" : "rounded-xl";

  const popover =
    open && !disabled && coords ? (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={ariaLabel ?? "Calendario"}
        style={{ top: coords.top, left: coords.left, width: coords.width }}
        className="fixed z-1200 rounded-2xl border border-line bg-surface p-3 text-ink shadow-2xl shadow-black/50"
      >
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="Mes anterior"
            disabled={navPrevOff}
            onClick={() =>
              setView((v) =>
                v.month === 0
                  ? { year: v.year - 1, month: 11 }
                  : { year: v.year, month: v.month - 1 },
              )
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink transition hover:bg-brand/15 hover:text-brand disabled:opacity-35"
          >
            ‹
          </button>
          <div className="flex min-w-0 flex-1 gap-1.5">
            <select
              aria-label="Mes"
              value={month}
              onChange={(e) =>
                setView((v) => ({ ...v, month: Number(e.target.value) }))
              }
              className="min-w-0 flex-[1.35] rounded-lg border border-line bg-surface-2 px-1.5 py-1.5 text-sm font-semibold text-ink capitalize outline-none focus:border-brand/50"
            >
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i} title={nombre}>
                  {MESES_ABREV[i]}
                </option>
              ))}
            </select>
            <select
              aria-label="Año"
              value={year}
              onChange={(e) =>
                setView((v) => ({ ...v, year: Number(e.target.value) }))
              }
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-1.5 py-1.5 text-sm font-semibold text-ink outline-none focus:border-brand/50"
            >
              {opcionesAnio.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={navNextOff}
            onClick={() =>
              setView((v) =>
                v.month === 11
                  ? { year: v.year + 1, month: 0 }
                  : { year: v.year, month: v.month + 1 },
              )
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink transition hover:bg-brand/15 hover:text-brand disabled:opacity-35"
          >
            ›
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d) => (
            <span
              key={d}
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {celdas.map((celda, i) => {
            if (!celda.iso || celda.day == null) return null;
            const iso = celda.iso;
            const selected = value === iso;
            const esHoy = iso === hoy;
            const off = fueraDeRango(iso);
            return (
              <button
                key={`${iso}-${i}`}
                type="button"
                disabled={off}
                onClick={() => seleccionar(iso)}
                className={[
                  "aspect-square rounded-lg text-sm font-medium transition",
                  selected
                    ? "bg-brand text-paper hover:bg-brand-deep"
                    : "text-ink hover:bg-surface-2",
                  celda.fueraMes && !selected ? "text-muted opacity-55" : "",
                  esHoy && !selected ? "ring-1 ring-brand ring-inset" : "",
                  off ? "cursor-default opacity-30" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {celda.day}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={`w-full ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div
        ref={triggerRef}
        className={[
          "flex items-stretch border transition",
          fieldRound,
          compact ? "h-10" : "",
          tone === "paper" ? "bg-paper" : "bg-surface",
          invalido ? "border-red-500/60" : "border-line",
          disabled ? "opacity-55" : "focus-within:border-brand/50",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          aria-invalid={invalido}
          value={inputText}
          onChange={onInputChange}
          onFocus={() => {
            editandoRef.current = true;
            setInvalido(false);
          }}
          onBlur={() => {
            editandoRef.current = false;
            confirmarTexto();
          }}
          onKeyDown={onInputKeyDown}
          className={`min-w-0 flex-1 bg-transparent pr-1 text-sm text-ink tabular-nums outline-none placeholder:text-muted ${fieldPad}`}
        />
        <div className="flex shrink-0 items-center gap-0.5 pr-1">
          {puedeLimpiar ? (
            <button
              type="button"
              aria-label="Quitar fecha"
              onClick={limpiar}
              className={`flex items-center justify-center rounded-lg text-muted transition hover:bg-brand/15 hover:text-brand ${iconBtn}`}
            >
              ×
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Abrir calendario"
            disabled={disabled}
            onClick={() => !disabled && setOpen((o) => !o)}
            className={`flex items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-45 ${iconBtn}`}
          >
            <IconCalendar size={compact ? 14 : 16} />
          </button>
        </div>
      </div>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

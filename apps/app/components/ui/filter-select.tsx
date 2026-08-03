"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FilterSelectOption = {
  value: string;
  label: string;
  /** Texto extra para filtrar (teléfono, email, etc.) sin mostrarlo en el label */
  searchText?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder: string;
  className?: string;
  "aria-label"?: string;
  /** Permite escribir para filtrar opciones (case-insensitive) */
  searchable?: boolean;
  /** Misma altura/radio que inputs del formulario */
  compact?: boolean;
  tone?: "surface" | "paper";
};

function foldText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function foldDigits(s: string) {
  return s.replace(/\D/g, "");
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  "aria-label": ariaLabel,
  searchable = false,
  compact = false,
  tone = "surface",
}: Props) {
  const triggerRound = compact ? "rounded-lg" : "rounded-xl";
  const triggerPad = compact ? "py-2 pl-2.5 pr-8" : "py-2.5 pl-3 pr-9";
  const triggerBg = tone === "paper" ? "bg-paper" : "bg-surface";
  const triggerH = compact ? "h-10" : "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = foldText(query.trim());
    const qDigits = foldDigits(query);
    return options.filter((o) => {
      const hay = foldText(`${o.label} ${o.searchText ?? ""} ${o.value}`);
      if (hay.includes(q)) return true;
      if (qDigits.length >= 3) {
        const digits = foldDigits(`${o.searchText ?? ""} ${o.label}`);
        if (digits.includes(qDigits)) return true;
      }
      return false;
    });
  }, [options, query, searchable]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({
        top: r.bottom + 6,
        left: r.left,
        width: r.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) {
      queueMicrotask(() => inputRef.current?.focus());
    }
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.(`[data-filter-select-list="${listId}"]`)) return;
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, searchable, listId]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  const list =
    open && menuPos && mounted
      ? createPortal(
          <ul
            id={listId}
            data-filter-select-list={listId}
            role="listbox"
            aria-label={ariaLabel ?? placeholder}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className="z-[300] max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface-2 p-1 shadow-xl shadow-black/40"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-center text-sm text-muted">
                Sin resultados
              </li>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <li
                    key={opt.value || "__all"}
                    role="option"
                    aria-selected={active}
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(opt.value)}
                      className={`relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? "bg-brand font-semibold text-paper"
                          : "text-ink hover:bg-brand/20 hover:text-brand"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {active ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="none"
                          aria-hidden
                          className="shrink-0"
                        >
                          <path
                            d="M4.5 10.5L8 14L15.5 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={
        className
          ? `relative w-full ${className}`
          : "relative w-full sm:min-w-[12rem] sm:max-w-xs sm:flex-1"
      }
    >
      {searchable ? (
        <div
          className={`relative flex w-full items-center border transition ${triggerRound} ${triggerBg} ${triggerH} ${
            open ? "border-brand" : "border-line hover:border-brand/40"
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            value={open ? query : selected ? displayLabel : ""}
            placeholder={placeholder}
            aria-label={ariaLabel ?? placeholder}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            autoComplete="off"
            spellCheck={false}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setOpen(true);
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const first = filtered[0];
                if (first) pick(first.value);
              }
            }}
            className={`w-full bg-transparent text-left text-sm text-ink outline-none placeholder:text-muted ${triggerRound} ${triggerPad} ${
              open ? "cursor-text" : "cursor-pointer"
            } ${!selected && !open ? "text-muted" : ""}`}
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className={`pointer-events-none absolute top-1/2 shrink-0 -translate-y-1/2 text-muted transition ${compact ? "right-2.5" : "right-3"} ${open ? "rotate-180 text-brand" : ""}`}
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel ?? placeholder}
          onClick={() => setOpen((v) => !v)}
          className={`relative flex w-full cursor-pointer items-center justify-center rounded-xl border bg-surface py-2.5 pl-3 pr-9 text-center text-sm transition sm:justify-between sm:pr-3 sm:text-left ${
            open
              ? "border-brand text-ink"
              : "border-line text-ink hover:border-brand/40"
          }`}
        >
          <span className={`truncate ${selected ? "" : "text-muted"}`}>
            {displayLabel}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className={`pointer-events-none absolute right-3 top-1/2 shrink-0 -translate-y-1/2 text-muted transition sm:static sm:translate-y-0 ${open ? "rotate-180 text-brand" : ""}`}
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {list}
    </div>
  );
}

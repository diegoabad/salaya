"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Contenido a la derecha del título (ej. estrellas) */
  titleExtra?: React.ReactNode;
  /**
   * Contenido fuera del panel, sobre el fondo oscuro
   * (ej. contador arriba a la derecha).
   */
  overlay?: React.ReactNode;
  children: React.ReactNode;
  /** Pie fijo fuera del scroll (acciones) */
  footer?: React.ReactNode;
  /** Clase extra del panel */
  className?: string;
  /** Clase extra del cuerpo scrolleable */
  bodyClassName?: string;
  /** Clase extra de la cabecera */
  headerClassName?: string;
  /**
   * Mobile: `bottom` = sheet inferior (default), `center` = centrado.
   * Desde `sm` siempre centrado.
   */
  placement?: "bottom" | "center";
};

export function Modal({
  open,
  onClose,
  title,
  titleExtra,
  overlay,
  children,
  footer,
  className = "",
  bodyClassName = "",
  headerClassName = "",
  placement = "bottom",
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const centered = placement === "center";
  const [mounted, setMounted] = useState(false);
  /** Evita que el mismo tap que abrió el modal cierre el backdrop en mobile */
  const [backdropReady, setBackdropReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setBackdropReady(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    // Solo enfocar el panel al abrir (no en cada re-render)
    panelRef.current?.focus();

    const t = window.setTimeout(() => setBackdropReady(true), 280);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={
        centered
          ? "fixed inset-0 z-[200] flex items-center justify-center p-4"
          : "fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      }
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (backdropReady) onClose();
        }}
      />
      {overlay ? (
        <div className="pointer-events-none absolute right-4 top-4 z-20 sm:right-6 sm:top-5">
          {overlay}
        </div>
      ) : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 flex max-h-[min(92vh,720px)] w-full flex-col overflow-hidden border border-line bg-surface shadow-2xl outline-none sm:max-w-2xl ${
          centered ? "rounded-2xl" : "rounded-t-2xl sm:rounded-2xl"
        } ${className}`}
      >
        <div
          className={`flex shrink-0 items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-5 ${headerClassName}`}
        >
          <h2
            id={titleId}
            className="min-w-0 flex-1 truncate font-[family-name:var(--font-display)] text-lg leading-none tracking-tight text-ink sm:text-xl"
            title={title}
          >
            {title}
          </h2>
          {titleExtra ? (
            <div className="flex shrink-0 items-center">{titleExtra}</div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm leading-none text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3.5 sm:px-5 sm:py-4 ${bodyClassName}`}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-line bg-surface px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

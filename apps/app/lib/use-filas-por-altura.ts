"use client";

import {
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

type Options = {
  /** Filas por página si aún no se pudo medir. */
  fallback?: number;
  min?: number;
  max?: number;
  filaEstimadaPx?: number;
  cabeceraEstimadaPx?: number;
  /** Re-dispara la medición cuando aparecen filas reales. */
  cantidadFilas?: number;
};

const PASO = 5;

function redondear(caben: number): number {
  if (caben <= 0) return PASO;
  return Math.ceil(caben / PASO) * PASO;
}

/**
 * Calcula filas/página según el alto del contenedor (como Wally).
 * Pasar el ref al área de tabla que hace flex:1 (altura disponible).
 */
export function useFilasPorAltura(
  containerRef: RefObject<HTMLElement | null>,
  {
    fallback = 15,
    min = 8,
    max = 50,
    filaEstimadaPx = 52,
    cabeceraEstimadaPx = 42,
    cantidadFilas = 0,
  }: Options = {},
) {
  const [pageSize, setPageSize] = useState(fallback);
  const [medido, setMedido] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const medir = () => {
      const alto = el.clientHeight;
      if (alto <= 0) return;

      const thead = el.querySelector("thead");
      const cabecera =
        thead instanceof HTMLElement && thead.offsetHeight > 0
          ? thead.offsetHeight
          : cabeceraEstimadaPx;

      const altoFilas = alto - cabecera;
      if (altoFilas <= 0) return;

      const tr = el.querySelector("tbody tr");
      const altoFila =
        tr instanceof HTMLElement &&
        tr.offsetHeight > 0 &&
        tr.children.length > 1
          ? tr.offsetHeight
          : filaEstimadaPx;

      if (altoFila <= 0) return;

      const caben = Math.floor(altoFilas / altoFila);
      const next = Math.max(min, Math.min(max, redondear(caben)));
      setPageSize((prev) => (prev === next ? prev : next));
      setMedido(true);
    };

    // Doble rAF: espera a que el flex asigne altura real
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(medir);
    });

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(medir);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
    };
  }, [
    containerRef,
    cabeceraEstimadaPx,
    filaEstimadaPx,
    min,
    max,
    cantidadFilas,
  ]);

  return { pageSize, medido };
}

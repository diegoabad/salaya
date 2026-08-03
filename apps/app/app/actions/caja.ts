"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type MovimientoDto = {
  id: string;
  tipo: string;
  estado: string;
  medioPago: string;
  monto: number;
  descripcion: string | null;
  occurredAt: string;
  reservaId: string | null;
  clienteNombre: string;
  salaName: string | null;
  /** Hora inicio del turno ligado (HH:mm), si hay reserva */
  turnoStartsAt: string | null;
  turnoEndsAt: string | null;
};

export type CajaDiaDto = {
  fecha: string;
  /** Sesión sin cierre_caja (puede cruzar medianoche). */
  abierta: boolean;
  cerradaAt: string | null;
  inicioCaja: number;
  ingresos: number;
  egresos: number;
  total: number;
  porMedio: Record<string, number>;
  movimientos: MovimientoDto[];
};

export type MovimientoTipoUi =
  | "sena"
  | "saldo"
  | "reembolso"
  | "ajuste"
  | "egreso"
  | "inicio_caja"
  | "cierre_caja";

function revalidateCaja() {
  revalidatePath("/panel/caja");
  revalidatePath("/panel-demo/caja");
}

export async function fetchCajaHoy(fecha?: string) {
  const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  const res = await panelApiFetch<CajaDiaDto>(`/caja${q}`);
  return res.ok ? res.data : null;
}

export async function createMovimientoAction(input: {
  tipo: MovimientoTipoUi;
  medioPago: "efectivo" | "transferencia" | "mercadopago" | "tarjeta";
  monto: string;
  reservaId?: string | null;
  descripcion?: string | null;
  fecha?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/caja", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateCaja();
  return { ok: true, id: res.data.id };
}

export async function cerrarCajaAction(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  return createMovimientoAction({
    tipo: "cierre_caja",
    medioPago: "efectivo",
    monto: "0",
    descripcion: "Cierre de caja",
  });
}

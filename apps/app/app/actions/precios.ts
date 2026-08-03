"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type PrecioSalaDto = {
  id: string;
  name: string;
  precioHora: number;
  active: boolean;
};

export type ReglaPrecioDto = {
  id: string;
  scope: string;
  scopeId: string;
  scopeLabel: string;
  tipo: "continuo" | "puntual";
  nombre: string;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  precioPorHora: number;
  descuentoPorcentaje: number | null;
  active: boolean;
};

export type PreciosBundleDto = {
  salas: PrecioSalaDto[];
  reglas: ReglaPrecioDto[];
};

export async function fetchPrecios() {
  const res = await panelApiFetch<PreciosBundleDto>("/precios");
  return res.ok ? res.data : null;
}

export async function createReglaAction(input: {
  scope: "sala" | "adicional";
  scopeId: string;
  tipo: "continuo" | "puntual";
  nombre: string;
  daysOfWeek?: number[];
  startTime?: string | null;
  endTime?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  precioPorHora: string;
  descuentoPorcentaje?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/precios/reglas", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/precios");
  revalidatePath("/panel/promociones");
  return { ok: true, id: res.data.id };
}

export async function updateReglaAction(
  id: string,
  input: {
    nombre?: string | null;
    tipo?: "continuo" | "puntual";
    daysOfWeek?: number[];
    startTime?: string | null;
    endTime?: string | null;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    precioPorHora?: string;
    descuentoPorcentaje?: string | null;
    active?: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/precios/reglas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/precios");
  revalidatePath("/panel/promociones");
  return { ok: true };
}

export async function deleteReglaAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/precios/reglas/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/precios");
  revalidatePath("/panel/promociones");
  return { ok: true };
}

export async function updatePrecioBaseSalaAction(
  salaId: string,
  precioHora: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/salas/${salaId}`, {
    method: "PATCH",
    body: JSON.stringify({ precioHora }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/precios");
  revalidatePath("/panel/salas");
  return { ok: true };
}

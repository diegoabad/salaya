"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type MembresiaPlanDto = {
  id: string;
  name: string;
  descripcion: string | null;
  precioMensual: number;
  creditoMensual: number;
  diasPeriodo: number;
  active: boolean;
};

export type ClienteMembresiaDto = {
  id: string;
  clienteId: string;
  planId: string;
  estado: "activa" | "pausada" | "cancelada";
  vigenteDesde: string;
  vigenteHasta: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string | null;
  creditoFavor: number;
  planName: string;
  precioMensual: number;
  creditoMensual: number;
  diasPeriodo: number;
};

export type MembresiasBundleDto = {
  planes: MembresiaPlanDto[];
  membresias: ClienteMembresiaDto[];
};

function revalidate() {
  revalidatePath("/panel/membresias");
  revalidatePath("/panel-demo/membresias");
  revalidatePath("/panel/clientes");
  revalidatePath("/panel/caja");
}

export async function fetchMembresias() {
  const res = await panelApiFetch<MembresiasBundleDto>("/membresias");
  return res.ok ? res.data : null;
}

export async function createMembresiaPlanAction(input: {
  name: string;
  descripcion?: string | null;
  precioMensual: string;
  creditoMensual: string;
  diasPeriodo?: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/membresias/planes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true, id: res.data.id };
}

export async function updateMembresiaPlanAction(
  planId: string,
  input: {
    name?: string;
    descripcion?: string | null;
    precioMensual?: string;
    creditoMensual?: string;
    diasPeriodo?: number;
    active?: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/membresias/planes/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true };
}

export async function asignarMembresiaAction(input: {
  clienteId: string;
  planId: string;
  medioPago: "efectivo" | "transferencia" | "mercadopago" | "tarjeta";
  cobrarAhora?: boolean;
  nota?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/membresias/asignar", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true, id: res.data.id };
}

export async function renovarMembresiaAction(input: {
  membresiaId: string;
  medioPago: "efectivo" | "transferencia" | "mercadopago" | "tarjeta";
  nota?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { membresiaId, ...body } = input;
  const res = await panelApiFetch(`/membresias/${membresiaId}/renovar`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true };
}

export async function setMembresiaEstadoAction(input: {
  membresiaId: string;
  estado: "activa" | "pausada" | "cancelada";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(
    `/membresias/${input.membresiaId}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({ estado: input.estado }),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true };
}

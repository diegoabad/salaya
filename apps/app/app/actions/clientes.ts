"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type ClienteDto = {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  banda: string | null;
  noShowCount: number;
  creditoFavor: number;
  notasInternas: string | null;
  reservasCount: number;
  ultimaReserva: string | null;
  /** Sala con más reservas (no canceladas), si hay */
  salaHabitual: string | null;
  /** Nombre del abono activo, si tiene */
  abonoNombre: string | null;
};

export type ClienteReservaDto = {
  id: string;
  salaId: string;
  salaName: string;
  startsAt: string;
  endsAt: string;
  estado: string;
  origen: string;
  precioTotal: number;
  senaMonto: number;
  senaPagada: boolean;
};

export type ClienteAbonoDto = {
  id: string;
  planId: string;
  planName: string;
  estado: string;
  vigenteDesde: string;
  vigenteHasta: string;
  precioMensual: number;
  creditoMensual: number;
  horasMensuales: number;
  horasMinSemanales: number;
  diasPreferidos: number[];
};

export type ClienteDetalleDto = {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  banda: string | null;
  noShowCount: number;
  creditoFavor: number;
  notasInternas: string | null;
  stats: {
    totalReservas: number;
    asistio: number;
    noVino: number;
    canceladas: number;
    proximas: number;
    noShowCount: number;
  };
  abonos: ClienteAbonoDto[];
  abonosActivos: ClienteAbonoDto[];
  reservas: ClienteReservaDto[];
};

function revalidateClientes() {
  revalidatePath("/panel/clientes");
  revalidatePath("/panel-demo/clientes");
}

export async function fetchClientes() {
  const res = await panelApiFetch<{ clientes: ClienteDto[] }>("/clientes");
  return res.ok ? res.data.clientes : null;
}

export async function fetchClienteDetalle(
  clienteId: string,
): Promise<ClienteDetalleDto | null> {
  const res = await panelApiFetch<ClienteDetalleDto>(`/clientes/${clienteId}`);
  return res.ok ? res.data : null;
}

export async function createClienteAction(input: {
  nombre: string;
  telefono: string;
  email?: string | null;
  banda?: string | null;
  notasInternas?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/clientes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateClientes();
  return { ok: true, id: res.data.id };
}

export async function updateClienteAction(input: {
  clienteId: string;
  nombre?: string;
  telefono?: string;
  email?: string | null;
  banda?: string | null;
  notasInternas?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { clienteId, ...body } = input;
  const res = await panelApiFetch(`/clientes/${clienteId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateClientes();
  return { ok: true };
}

/** Carga abono (saldo a favor) + ingreso en caja (medio + día del cobro). */
export async function cargarCreditoClienteAction(input: {
  clienteId: string;
  monto: string;
  medioPago: "efectivo" | "transferencia" | "mercadopago" | "tarjeta";
  fecha?: string;
  nota?: string | null;
}): Promise<
  | { ok: true; creditoFavor: number }
  | { ok: false; error: string }
> {
  const { clienteId, ...body } = input;
  const res = await panelApiFetch<{ creditoFavor: number }>(
    `/clientes/${clienteId}/credito`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidateClientes();
  revalidatePath("/panel/caja");
  revalidatePath("/panel-demo/caja");
  return { ok: true, creditoFavor: Number(res.data.creditoFavor ?? 0) };
}

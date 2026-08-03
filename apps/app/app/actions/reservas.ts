"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type AgendaReservaDto = {
  id: string;
  salaId: string;
  salaName: string;
  startsAt: string;
  endsAt: string;
  clienteNombre: string;
  clienteTelefono: string;
  /** Email del cliente (si tiene) */
  clienteEmail: string | null;
  precioTotal: number;
  precioSala: number;
  senaPagada: number;
  saldo: number;
  estado: string;
  origen: string;
  holdExpiresAt: string | null;
  /** Cuándo se cargó/creó la reserva (ISO) */
  createdAt: string | null;
  adicionales: Array<{
    id: string;
    name: string;
    cantidad: number;
    precioUnitario: number;
    modalidad: "por_hora" | "por_reserva";
  }>;
};

export async function fetchAgendaHoy(fecha?: string) {
  const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  const res = await panelApiFetch<{ fecha: string; reservas: AgendaReservaDto[] }>(
    `/reservas/hoy${q}`,
  );
  return res.ok ? res.data : null;
}

export async function createReservaPanelAction(input: {
  salaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail?: string | null;
  adicionales?: Array<{ id: string; cantidad: number }>;
  descuentoTipo?: "porcentaje" | "fijo";
  descuentoValor?: string;
  senaMonto?: string;
  senaPagada?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/reservas", {
    method: "POST",
    body: JSON.stringify({
      salaId: input.salaId,
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      clienteNombre: input.clienteNombre,
      clienteTelefono: input.clienteTelefono,
      clienteEmail: input.clienteEmail?.trim() || null,
      adicionales: input.adicionales ?? [],
      descuentoTipo: input.descuentoTipo,
      descuentoValor: input.descuentoValor,
      senaMonto: input.senaMonto ?? "0",
      senaPagada: input.senaPagada ?? false,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  return { ok: true, id: res.data.id };
}

export async function marcarAsistenciaAction(
  reservaId: string,
  asistio: boolean,
): Promise<{ ok: true; estado: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ estado: string }>(
    `/reservas/${reservaId}/asistencia`,
    {
      method: "POST",
      body: JSON.stringify({ asistio }),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  revalidatePath("/panel/clientes");
  return { ok: true, estado: res.data.estado };
}

export async function cobrarSaldoAction(
  reservaId: string,
  medioPago: "efectivo" | "transferencia" | "mercadopago" | "tarjeta" = "efectivo",
): Promise<{ ok: true; saldoPendiente: number } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ saldoPendiente: number }>(
    `/reservas/${reservaId}/cobrar`,
    {
      method: "POST",
      body: JSON.stringify({ medioPago }),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  revalidatePath("/panel/caja");
  return { ok: true, saldoPendiente: res.data.saldoPendiente };
}

export async function cancelarReservaAction(
  reservaId: string,
  motivo?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/reservas/${reservaId}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo: motivo ?? null }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  return { ok: true };
}

export async function reprogramarReservaAction(input: {
  reservaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}): Promise<
  | {
      ok: true;
      precioTotal: number;
      saldo: number;
    }
  | { ok: false; error: string }
> {
  const res = await panelApiFetch<{
    precioTotal?: number;
    saldo?: number;
  }>(`/reservas/${input.reservaId}/reprogramar`, {
    method: "POST",
    body: JSON.stringify({
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  revalidatePath("/panel/caja");
  return {
    ok: true,
    precioTotal: res.data.precioTotal ?? 0,
    saldo: res.data.saldo ?? 0,
  };
}

export async function updateReservaAdicionalesAction(input: {
  reservaId: string;
  adicionales: Array<{ id: string; cantidad: number }>;
}): Promise<
  | {
      ok: true;
      precioTotal: number;
      precioAdicionales: number;
      senaPagada: number;
      saldo: number;
    }
  | { ok: false; error: string }
> {
  const res = await panelApiFetch<{
    precioTotal: number;
    precioAdicionales: number;
    senaPagada: number;
    saldo: number;
  }>(`/reservas/${input.reservaId}/adicionales`, {
    method: "POST",
    body: JSON.stringify({ adicionales: input.adicionales }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  revalidatePath("/panel/caja");
  return {
    ok: true,
    precioTotal: res.data.precioTotal,
    precioAdicionales: res.data.precioAdicionales,
    senaPagada: res.data.senaPagada,
    saldo: res.data.saldo,
  };
}

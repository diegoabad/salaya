"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type BloqueoDto = {
  id: string;
  sedeId: string;
  salaId: string | null;
  salaName: string | null;
  fecha: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  motivo: string | null;
  scope: "sala" | "sede";
};

export async function fetchBloqueos() {
  const res = await panelApiFetch<{ bloqueos: BloqueoDto[] }>("/bloqueos");
  return res.ok ? res.data.bloqueos : null;
}

export async function createBloqueoAction(input: {
  salaId?: string | null;
  fecha: string;
  startTime: string;
  endTime: string;
  motivo?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const norm = (t: string) => t.slice(0, 5);
  const res = await panelApiFetch<{ id: string }>("/bloqueos", {
    method: "POST",
    body: JSON.stringify({
      salaId: input.salaId || null,
      fecha: input.fecha,
      startTime: norm(input.startTime),
      endTime: norm(input.endTime),
      motivo: input.motivo?.trim() || null,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  revalidatePath("/panel-demo");
  revalidatePath("/panel/bloqueos");
  return { ok: true, id: res.data.id };
}

export async function deleteBloqueoAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch<unknown>(`/bloqueos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel");
  revalidatePath("/panel-demo");
  revalidatePath("/panel/bloqueos");
  return { ok: true };
}

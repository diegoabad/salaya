"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type AdicionalDto = {
  id: string;
  grupoId: string;
  grupo: string;
  name: string;
  precio: number;
  modalidad: string;
  stock: number | null;
  active: boolean;
  caracteristicas: string[];
  photoUrl: string | null;
};

export type AdicionalGrupoDto = {
  id: string;
  name: string;
  sortOrder: number;
};

export type AdicionalesBundleDto = {
  adicionales: AdicionalDto[];
  grupos: AdicionalGrupoDto[];
};

export async function fetchAdicionales(): Promise<AdicionalesBundleDto | null> {
  const res = await panelApiFetch<AdicionalesBundleDto>("/adicionales");
  if (!res.ok) return null;
  return {
    adicionales: (res.data.adicionales ?? []).map((a) => ({
      ...a,
      caracteristicas: a.caracteristicas ?? [],
      photoUrl: a.photoUrl ?? null,
    })),
    grupos: res.data.grupos ?? [],
  };
}

export async function createGrupoAction(input: {
  name: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/adicionales/grupos", {
    method: "POST",
    body: JSON.stringify({ name: input.name.trim() }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/adicionales");
  return { ok: true, id: res.data.id };
}

export async function createAdicionalAction(input: {
  name: string;
  grupoId?: string;
  grupoName?: string;
  precioBase: string;
  modalidad: "por_hora" | "por_reserva";
  stock?: number | null;
  caracteristicas?: string[];
  photoUrl?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await panelApiFetch<{ id: string }>("/adicionales", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      grupoId: input.grupoId,
      grupoName: input.grupoName?.trim() || undefined,
      precioBase: input.precioBase,
      modalidad: input.modalidad,
      stock: input.stock ?? null,
      active: true,
      caracteristicas: input.caracteristicas ?? [],
      photoUrl: input.photoUrl ?? null,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/adicionales");
  return { ok: true, id: res.data.id };
}

export async function updateAdicionalAction(
  id: string,
  input: {
    name?: string;
    grupoId?: string;
    grupoName?: string;
    precioBase?: string;
    modalidad?: "por_hora" | "por_reserva";
    stock?: number | null;
    active?: boolean;
    caracteristicas?: string[];
    photoUrl?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/adicionales/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/adicionales");
  return { ok: true };
}

export async function deleteAdicionalAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/adicionales/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/adicionales");
  return { ok: true };
}

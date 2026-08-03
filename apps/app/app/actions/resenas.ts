"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type ResenaDto = {
  id: string;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  published: boolean;
  publishedAt: string;
  salaId: string | null;
};

export type ResenasBundleDto = {
  ratingAvg: number | null;
  ratingCount: number;
  resenas: ResenaDto[];
};

export async function fetchResenas() {
  const res = await panelApiFetch<ResenasBundleDto>("/resenas");
  return res.ok ? res.data : null;
}

export async function invitarResenaAction(input: {
  clienteId: string;
  email?: string;
}): Promise<
  | { ok: true; email: string; clienteNombre: string }
  | { ok: false; error: string }
> {
  const res = await panelApiFetch<{
    email: string;
    clienteNombre: string;
  }>("/resenas/invitar", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/resenas");
  revalidatePath("/panel/clientes");
  return {
    ok: true,
    email: res.data.email,
    clienteNombre: res.data.clienteNombre,
  };
}

export async function toggleResenaAction(
  id: string,
  published: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await panelApiFetch(`/resenas/${id}/published`, {
    method: "PATCH",
    body: JSON.stringify({ published }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/resenas");
  return { ok: true };
}

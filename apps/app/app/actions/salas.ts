"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { createSalaSchema, updateSalaSchema } from "@repo/shared";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SalaDto = {
  id: string;
  sedeId: string;
  name: string;
  slug: string | null;
  description: string | null;
  categoria: string;
  tags: string[];
  capacity: number | null;
  anchoMetros: string | null;
  largoMetros: string | null;
  precioHora: string | null;
  acustica: string | null;
  equipamiento: string[];
  noIncluido: string[];
  caracteristicas: string[];
  photos: string[];
  popular: boolean;
  nueva: boolean;
  active: boolean;
  sortOrder: number;
  ratingAvg: string | null;
  ratingCount: number;
  duracionMinMinutos: number | null;
  duracionMaxMinutos: number | null;
  granularidadMinutos: number | null;
};

function csvToList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionalInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function salaPayloadFromForm(
  formData: FormData,
): { error: string } | { payload: Record<string, unknown> } {
  return {
    payload: {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      categoria: String(formData.get("categoria") ?? "").trim() || "Música",
      tags: csvToList(String(formData.get("tags") ?? "")),
      capacity: optionalInt(formData, "capacity"),
      anchoMetros: optionalInt(formData, "anchoMetros"),
      largoMetros: optionalInt(formData, "largoMetros"),
      acustica: String(formData.get("acustica") ?? "") || null,
      equipamiento: csvToList(String(formData.get("equipamiento") ?? "")),
      noIncluido: csvToList(String(formData.get("noIncluido") ?? "")),
      caracteristicas: csvToList(String(formData.get("caracteristicas") ?? "")),
      photos: csvToList(String(formData.get("photos") ?? "")).filter(
        (u) => /^https?:\/\//.test(u) || u.startsWith("/media/"),
      ),
      popular: formData.get("popular") === "on",
      nueva: formData.get("nueva") === "on",
      sortOrder: optionalInt(formData, "sortOrder") ?? 0,
      active: true,
    },
  };
}

export async function fetchSalas(): Promise<{
  sedeId: string;
  salas: SalaDto[];
} | null> {
  const res = await panelApiFetch<{ sedeId: string; salas: SalaDto[] }>("/salas");
  return res.ok ? res.data : null;
}

export async function createSalaAction(
  _prev: CreateSalaResult | null,
  formData: FormData,
): Promise<CreateSalaResult> {
  const built = salaPayloadFromForm(formData);
  if ("error" in built) return { ok: false, error: built.error };

  const parsed = createSalaSchema.safeParse(built.payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá los datos de la sala",
    };
  }

  const res = await panelApiFetch<SalaDto>("/salas", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: res.error };

  let sala = res.data;
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 12);

  if (files.length > 0) {
    const body = new FormData();
    for (const f of files) body.append("files", f);
    const up = await panelApiFetch<{ photos: string[] }>(
      `/uploads/salas/${sala.id}`,
      { method: "POST", body },
    );
    if (up.ok) {
      sala = { ...sala, photos: up.data.photos };
    }
  }

  revalidatePath("/panel/salas");
  revalidatePath("/panel/mi-estudio");
  revalidatePath("/panel");
  return { ok: true, sala };
}

export type CreateSalaResult =
  | { ok: true; sala: SalaDto }
  | { ok: false; error: string };

export async function updateSalaAction(
  salaId: string,
  formData: FormData,
): Promise<ActionResult> {
  const built = salaPayloadFromForm(formData);
  if ("error" in built) return { ok: false, error: built.error };

  const parsed = updateSalaSchema.safeParse(built.payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá los datos",
    };
  }

  const res = await panelApiFetch<SalaDto>(`/salas/${salaId}`, {
    method: "PATCH",
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/panel/salas");
  revalidatePath("/panel/mi-estudio");
  return { ok: true };
}

export async function toggleSalaAction(
  salaId: string,
  active: boolean,
): Promise<ActionResult> {
  const res = await panelApiFetch(`/salas/${salaId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/salas");
  return { ok: true };
}

export async function deleteSalaAction(salaId: string): Promise<ActionResult> {
  const res = await panelApiFetch(`/salas/${salaId}`, { method: "DELETE" });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/salas");
  return { ok: true };
}

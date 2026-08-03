"use server";

import { unstable_update } from "@/auth";
import { panelApiFetch } from "@/lib/panel-api";
import { updateNegocioSchema } from "@repo/shared";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type LinkExtraDto = { label: string; url: string };

export type NegocioDto = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    instagramUrl: string | null;
    websiteUrl: string | null;
    whatsapp: string | null;
    youtubeUrl: string | null;
    tiktokUrl: string | null;
    linksExtra: LinkExtraDto[];
  };
  sede: {
    id: string;
    name: string;
    zona: string | null;
    address: string | null;
    description: string | null;
    photoUrl: string | null;
    photos: string[];
    amenidades: string[];
    lat: number | null;
    lng: number | null;
  };
  politica: {
    holdMinutos: number;
    cancelacionVentanaHoras: number;
    duracionMinMinutos: number;
    duracionMaxMinutos: number | null;
    senaModo: string;
    senaTipo: string;
    senaValor: string;
    senaDestinoCancelacion: string;
    permiteReprogramar: boolean;
  } | null;
  horarios: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  directorio: {
    tagsDestacados: string[];
    telefono: string | null;
    plan: string;
  };
  salasCount: number;
};

export async function fetchNegocio(): Promise<NegocioDto | null> {
  const res = await panelApiFetch<NegocioDto>("/negocio");
  return res.ok ? res.data : null;
}

function csvToList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function updateNegocioAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    tenantName: String(formData.get("tenantName") ?? ""),
    sedeName: String(formData.get("sedeName") ?? ""),
    zona: String(formData.get("zona") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    photoUrl: String(formData.get("photoUrl") ?? "") || null,
    ...(formData.has("photos")
      ? {
          photos: csvToList(String(formData.get("photos") ?? "")).filter(
            (u) => /^https?:\/\//.test(u) || u.startsWith("/media/"),
          ),
        }
      : {}),
    amenidades: csvToList(String(formData.get("amenidades") ?? "")),
    tagsDestacados: csvToList(String(formData.get("tagsDestacados") ?? "")),
    instagramUrl: String(formData.get("instagramUrl") ?? "") || null,
    websiteUrl: String(formData.get("websiteUrl") ?? "") || null,
    whatsapp: String(formData.get("whatsapp") ?? "") || null,
    youtubeUrl: String(formData.get("youtubeUrl") ?? "") || null,
    tiktokUrl: String(formData.get("tiktokUrl") ?? "") || null,
    linksExtra: (() => {
      const raw = String(formData.get("linksExtra") ?? "").trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const label = String((item as { label?: unknown }).label ?? "").trim();
            const url = String((item as { url?: unknown }).url ?? "").trim();
            if (!label || !url) return null;
            return { label, url };
          })
          .filter((x): x is { label: string; url: string } => Boolean(x));
      } catch {
        return [];
      }
    })(),
    telefono: String(formData.get("telefono") ?? "") || null,
    lat: formData.get("lat") ? Number(formData.get("lat")) : null,
    lng: formData.get("lng") ? Number(formData.get("lng")) : null,
    holdMinutos: Number(formData.get("holdMinutos") || 5),
    cancelacionVentanaHoras: Number(
      formData.get("cancelacionVentanaHoras") || 24,
    ),
    duracionMinMinutos: Number(formData.get("duracionMinMinutos") || 60),
    duracionMaxMinutos: (() => {
      const raw = String(formData.get("duracionMaxMinutos") ?? "").trim();
      if (!raw) return null;
      return Number(raw);
    })(),
    senaModo: String(formData.get("senaModo") || "siempre"),
    senaTipo: String(formData.get("senaTipo") || "porcentaje"),
    senaValor: String(formData.get("senaValor") || "30"),
    senaDestinoCancelacion: String(
      formData.get("senaDestinoCancelacion") || "perder",
    ),
    permiteReprogramar: formData.get("permiteReprogramar") === "on",
  };

  const parsed = updateNegocioSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisá los datos",
    };
  }

  const res = await panelApiFetch<NegocioDto>("/negocio", {
    method: "PATCH",
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) return { ok: false, error: res.error };

  await unstable_update({
    user: { tenantName: res.data.tenant.name },
  });
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/mi-estudio");
  revalidatePath("/panel/salas");
  return { ok: true };
}

export async function updateHorariosAction(input: {
  horarios: Array<{
    dayOfWeek: number;
    closed?: boolean;
    startTime?: string | null;
    endTime?: string | null;
  }>;
}): Promise<ActionResult> {
  const res = await panelApiFetch<NegocioDto>("/negocio/horarios", {
    method: "PUT",
    body: JSON.stringify({
      horarios: input.horarios.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        closed: Boolean(h.closed),
        startTime: h.closed ? null : (h.startTime?.slice(0, 5) ?? null),
        endTime: h.closed ? null : (h.endTime?.slice(0, 5) ?? null),
      })),
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/mi-estudio");
  return { ok: true };
}

export type HorarioEspecialDto = {
  fecha: string;
  closed: boolean;
  startTime: string | null;
  endTime: string | null;
};

export async function fetchHorariosEspeciales(): Promise<HorarioEspecialDto[]> {
  const res = await panelApiFetch<{ especiales: HorarioEspecialDto[] }>(
    "/negocio/horarios-especiales",
  );
  return res.ok ? res.data.especiales : [];
}

export async function upsertHorarioEspecialAction(input: {
  fecha: string;
  closed: boolean;
  startTime?: string | null;
  endTime?: string | null;
  nota?: string | null;
}): Promise<ActionResult> {
  const res = await panelApiFetch("/negocio/horarios-especiales", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/configuracion");
  return { ok: true };
}

export async function deleteHorarioEspecialAction(
  fecha: string,
): Promise<ActionResult> {
  const res = await panelApiFetch(
    `/negocio/horarios-especiales/${encodeURIComponent(fecha)}`,
    { method: "DELETE" },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/configuracion");
  return { ok: true };
}

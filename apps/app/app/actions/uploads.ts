"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function uploadSedePhotosAction(
  formData: FormData,
): Promise<ActionResult & { photos?: string[]; photoUrl?: string | null }> {
  const files = formData
    .getAll("files")
    .filter((f) => f instanceof File) as File[];
  // compat: un solo "file"
  const single = formData.get("file");
  if (single instanceof File && single.size > 0) files.push(single);

  if (files.length === 0) {
    return { ok: false, error: "Elegí al menos una imagen" };
  }
  const body = new FormData();
  for (const f of files) body.append("files", f);
  const res = await panelApiFetch<{
    photos: string[];
    photoUrl: string | null;
  }>("/uploads/sede", {
    method: "POST",
    body,
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/mi-estudio");
  revalidatePath("/");
  return {
    ok: true,
    photos: res.data.photos,
    photoUrl: res.data.photoUrl,
  };
}

/** @deprecated usar uploadSedePhotosAction */
export async function uploadSedePhotoAction(
  formData: FormData,
): Promise<ActionResult & { photoUrl?: string; photos?: string[] }> {
  return uploadSedePhotosAction(formData);
}

export async function deleteSedePhotoAction(
  url: string,
): Promise<ActionResult & { photos?: string[]; photoUrl?: string | null }> {
  const res = await panelApiFetch<{
    photos: string[];
    photoUrl: string | null;
  }>("/uploads/sede/photo", {
    method: "DELETE",
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/mi-estudio");
  revalidatePath("/");
  return {
    ok: true,
    photos: res.data.photos,
    photoUrl: res.data.photoUrl,
  };
}

export async function uploadSalaPhotosAction(
  salaId: string,
  formData: FormData,
): Promise<ActionResult & { photos?: string[] }> {
  const files = formData.getAll("files").filter((f) => f instanceof File) as File[];
  if (files.length === 0) {
    return { ok: false, error: "Elegí al menos una imagen" };
  }
  const body = new FormData();
  for (const f of files) body.append("files", f);
  const res = await panelApiFetch<{ photos: string[] }>(
    `/uploads/salas/${salaId}`,
    { method: "POST", body },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/salas");
  revalidatePath("/panel");
  return { ok: true, photos: res.data.photos };
}

export async function deleteSalaPhotoAction(
  salaId: string,
  url: string,
): Promise<ActionResult & { photos?: string[] }> {
  const res = await panelApiFetch<{ photos: string[] }>(
    `/uploads/salas/${salaId}/photo`,
    {
      method: "DELETE",
      body: JSON.stringify({ url }),
    },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/salas");
  return { ok: true, photos: res.data.photos };
}

export async function uploadAdicionalPhotoAction(
  adicionalId: string,
  formData: FormData,
): Promise<ActionResult & { photoUrl?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, error: "Elegí una imagen" };
  }
  const body = new FormData();
  body.append("file", file);
  const res = await panelApiFetch<{ photoUrl: string }>(
    `/uploads/adicionales/${adicionalId}`,
    { method: "POST", body },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/adicionales");
  revalidatePath("/panel");
  revalidatePath("/panel/caja");
  return { ok: true, photoUrl: res.data.photoUrl };
}

export async function deleteAdicionalPhotoAction(
  adicionalId: string,
): Promise<ActionResult & { photoUrl?: string | null }> {
  const res = await panelApiFetch<{ photoUrl: string | null }>(
    `/uploads/adicionales/${adicionalId}/photo`,
    { method: "DELETE" },
  );
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/adicionales");
  revalidatePath("/panel");
  revalidatePath("/panel/caja");
  return { ok: true, photoUrl: res.data.photoUrl };
}

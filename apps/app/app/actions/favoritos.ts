"use server";

import { auth } from "@/auth";
import { getAppDb } from "@/lib/db";
import { signFavoritosShareToken } from "@/lib/favoritos-share";
import {
  addFavorito,
  listFavoritoIds,
  listFavoritosDetalle,
  removeFavorito,
  syncFavoritos,
} from "@repo/db/queries";

export async function getMyFavoritoIdsAction(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return listFavoritoIds(getAppDb(), session.user.id);
}

export async function toggleFavoritoAction(
  directorioEntradaId: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "login_required" };
  }
  const db = getAppDb();
  const ids = await listFavoritoIds(db, session.user.id);
  if (ids.includes(directorioEntradaId)) {
    await removeFavorito(db, session.user.id, directorioEntradaId);
  } else {
    await addFavorito(db, session.user.id, directorioEntradaId);
  }
  return { ok: true, ids: await listFavoritoIds(db, session.user.id) };
}

export async function syncFavoritosAction(
  localIds: string[],
): Promise<{ ids: string[]; loggedIn: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ids: localIds, loggedIn: false };
  const ids = await syncFavoritos(getAppDb(), session.user.id, localIds);
  return { ids, loggedIn: true };
}

export async function listMyFavoritosAction() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const rows = await listFavoritosDetalle(getAppDb(), session.user.id);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug ?? r.id,
    zona: r.zona ?? "",
    address: r.address ?? "",
    plan: r.plan as "cliente" | "destacado" | "seed",
    photo: r.photoUrl ?? "",
  }));
}

export async function getFavoritosShareUrlAction(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const base =
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const t = signFavoritosShareToken(session.user.id);
  return `${base}/f/${encodeURIComponent(t)}`;
}

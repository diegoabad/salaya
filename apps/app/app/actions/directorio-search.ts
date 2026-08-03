"use server";

import { getAppDb } from "@/lib/db";
import {
  searchDirectorioPorNombre,
  type DirectorioNombreHit,
} from "@repo/db/queries";

export type { DirectorioNombreHit };

export async function searchSalaByNombreAction(
  query: string,
): Promise<DirectorioNombreHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    return await searchDirectorioPorNombre(getAppDb(), q, 5);
  } catch (err) {
    console.error("searchSalaByNombreAction", err);
    return [];
  }
}

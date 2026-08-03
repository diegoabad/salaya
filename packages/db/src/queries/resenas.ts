import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { resenas } from "../schema";

export async function listResenasTenant(db: Database, tenantId: string) {
  return db
    .select()
    .from(resenas)
    .where(eq(resenas.tenantId, tenantId))
    .orderBy(desc(resenas.publishedAt));
}

export async function insertResena(
  db: Database,
  tenantId: string,
  input: {
    sedeId?: string | null;
    salaId?: string | null;
    authorName: string;
    rating: number;
    body: string;
    published?: boolean;
  },
) {
  const [row] = await db
    .insert(resenas)
    .values({
      tenantId,
      sedeId: input.sedeId ?? null,
      salaId: input.salaId ?? null,
      authorName: input.authorName,
      rating: input.rating,
      body: input.body,
      published: input.published ?? true,
    })
    .returning();
  return row!;
}

export async function setResenaPublished(
  db: Database,
  tenantId: string,
  id: string,
  published: boolean,
) {
  const [row] = await db
    .update(resenas)
    .set({ published, updatedAt: new Date() })
    .where(and(eq(resenas.tenantId, tenantId), eq(resenas.id, id)))
    .returning();
  return row ?? null;
}

import { getDb } from "@repo/db";
import {
  getClienteById,
  getNegocioBundle,
  insertResena,
  listResenasTenant,
  setResenaPublished,
  updateClienteRow,
} from "@repo/db/queries";
import type {
  CreateResenaInput,
  InvitarResenaInput,
  PublicResenaSubmitInput,
} from "@repo/shared";
import {
  parseResenaInviteToken,
  resenaInviteUrl,
} from "../crypto/resenaInviteToken";
import { HttpError } from "../middlewares/errorHandler";
import { enqueueNotification, processNotificationOutbox } from "./notifications";

function map(r: Awaited<ReturnType<typeof listResenasTenant>>[number]) {
  return {
    id: r.id,
    authorName: r.authorName,
    rating: r.rating as 1 | 2 | 3 | 4 | 5,
    body: r.body,
    published: r.published,
    publishedAt: r.publishedAt.toISOString().slice(0, 10),
    salaId: r.salaId,
  };
}

export async function listResenas(tenantId: string) {
  const rows = await listResenasTenant(getDb(), tenantId);
  const published = rows.filter((r) => r.published);
  const ratingCount = published.length;
  const ratingAvg =
    ratingCount === 0
      ? null
      : Math.round(
          (published.reduce((a, r) => a + r.rating, 0) / ratingCount) * 10,
        ) / 10;
  return {
    ratingAvg,
    ratingCount,
    resenas: rows.map(map),
  };
}

export async function createResena(tenantId: string, input: CreateResenaInput) {
  const bundle = await getNegocioBundle(getDb(), tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");
  const row = await insertResena(getDb(), tenantId, {
    sedeId: bundle.sede.id,
    salaId: input.salaId,
    authorName: input.authorName,
    rating: input.rating,
    body: input.body,
    published: input.published,
  });
  return map(row);
}

export async function toggleResena(
  tenantId: string,
  id: string,
  published: boolean,
) {
  const row = await setResenaPublished(getDb(), tenantId, id, published);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Reseña no encontrada");
  return map(row);
}

export async function invitarResena(
  tenantId: string,
  input: InvitarResenaInput,
) {
  const db = getDb();
  const cliente = await getClienteById(db, tenantId, input.clienteId);
  if (!cliente) throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");

  let email = (input.email ?? cliente.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    throw new HttpError(
      400,
      "EMAIL_REQUIRED",
      "Este cliente no tiene email. Cargalo para poder invitarlo.",
    );
  }

  if (!cliente.email || cliente.email.toLowerCase() !== email) {
    await updateClienteRow(db, tenantId, cliente.id, { email });
  }

  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");

  const inviteUrl = resenaInviteUrl(tenantId, cliente.id);
  await enqueueNotification({
    tenantId,
    eventType: "resena.invitar",
    payload: {
      email,
      clienteNombre: cliente.nombre,
      sedeNombre: bundle.sede.name ?? bundle.tenant.name,
      inviteUrl,
    },
  });
  await processNotificationOutbox(5);

  return {
    ok: true as const,
    email,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    inviteUrl,
  };
}

export async function previewResenaInvite(token: string) {
  const parsed = parseResenaInviteToken(token);
  if (!parsed) {
    throw new HttpError(400, "TOKEN_INVALIDO", "Link inválido o vencido");
  }
  const db = getDb();
  const cliente = await getClienteById(db, parsed.tenantId, parsed.clienteId);
  if (!cliente) {
    throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");
  }
  const bundle = await getNegocioBundle(db, parsed.tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Estudio no encontrado");
  }
  return {
    clienteNombre: cliente.nombre,
    estudioNombre: bundle.sede.name ?? bundle.tenant.name,
    estudioSlug: bundle.tenant.slug,
  };
}

export async function submitResenaPublica(input: PublicResenaSubmitInput) {
  const parsed = parseResenaInviteToken(input.t);
  if (!parsed) {
    throw new HttpError(400, "TOKEN_INVALIDO", "Link inválido o vencido");
  }
  const db = getDb();
  const cliente = await getClienteById(db, parsed.tenantId, parsed.clienteId);
  if (!cliente) {
    throw new HttpError(404, "NOT_FOUND", "Cliente no encontrado");
  }
  const bundle = await getNegocioBundle(db, parsed.tenantId);
  if (!bundle) {
    throw new HttpError(404, "NOT_FOUND", "Estudio no encontrado");
  }

  const row = await insertResena(db, parsed.tenantId, {
    sedeId: bundle.sede.id,
    authorName: cliente.nombre,
    rating: input.rating,
    body: input.body,
    published: true,
  });

  return {
    id: row.id,
    estudioSlug: bundle.tenant.slug,
    estudioNombre: bundle.sede.name ?? bundle.tenant.name,
  };
}

import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  reservas,
  tenantInvites,
  tenants,
  userTenants,
  users,
} from "../schema";

export type Membership = {
  tenantId: string;
  role: "owner" | "employee";
  tenantName: string;
  tenantSlug: string;
};

export {
  getNegocioBundle,
  getSalaById,
  isSalaSlugTaken,
  listSalasTenant,
} from "./negocio";

export {
  getEstudioPublicoBySlug,
  getSalaPublica,
  listDirectorioPublico,
  searchDirectorioPorNombre,
  type DirectorioNombreHit,
  type PublicEstudio,
  type PublicResena,
  type PublicSala,
} from "./publico";

export {
  listReservasRango,
  listReservasByCliente,
  listReservasParaRecordatorio,
  upsertClienteByTelefono,
  getReservaById,
  getReservaPublicaById,
  updateReservaEstado,
  updateReservaHorario,
  updateReservaPrecios,
  incrementClienteNoShow,
  addClienteCredito,
} from "./reservas";

export {
  getClienteById,
  insertCliente,
  listClientesConStats,
  updateClienteRow,
} from "./clientes";

export {
  findMembresiaActivaCliente,
  getClienteMembresiaById,
  getMembresiaPlanById,
  insertClienteMembresia,
  insertMembresiaPlan,
  listClienteMembresias,
  listMembresiasByCliente,
  listMembresiaPlanes,
  updateClienteMembresiaRow,
  updateMembresiaPlanRow,
} from "./membresias";

export {
  findCierreCajaAfter,
  findInicioCajaEnRango,
  findLatestInicioCaja,
  insertMovimiento,
  listMovimientosRango,
  sumCobradoReserva,
} from "./caja";

export {
  listHorariosAtencionSede,
  listHorariosEspecialesSede,
  replaceHorariosAtencionSede,
  seedHorariosDefaultSede,
  upsertHorarioEspecialSede,
  deleteHorarioEspecialSede,
} from "./horarios";

export {
  deleteBloqueoRow,
  insertBloqueo,
  listBloqueosSalaRango,
  listBloqueosTenant,
} from "./bloqueos";

export {
  deleteAdicionalRow,
  ensureAdicionalGrupo,
  insertAdicional,
  listAdicionalGrupos,
  listAdicionalesByIds,
  listAdicionalesConGrupo,
  listAdicionalesPublicosSede,
  listReservaAdicionales,
  listReservasAdicionales,
  listUsosAdicionalesSolape,
  replaceReservaAdicionales,
  updateAdicionalRow,
} from "./adicionales";

export {
  deleteReglaPrecioRow,
  insertReglaPrecio,
  listReglasPrecio,
  updateReglaPrecioRow,
} from "./reglas-precio";

export {
  expireHoldsPast,
  findHoldBySession,
  findSalaPublicaById,
  getPoliticaBySede,
  insertHoldReserva,
  listHoldsActivosSala,
  listOcupacionDia,
  listReservasActivasSolape,
  updateHoldReserva,
} from "./holds";

export {
  deleteMpConexion,
  getMpConexion,
  getPagoByExternalRef,
  getPagoById,
  insertPago,
  markWebhookProcessed,
  tryInsertWebhookEvent,
  updatePago,
  upsertMpConexion,
} from "./mp";

export {
  insertResena,
  listResenasTenant,
  setResenaPublished,
} from "./resenas";

export {
  getSuscripcionPagoByExternalRef,
  getTenantSubscription,
  insertSuscripcionPago,
  syncDirectorioPlanForTenant,
  updateSuscripcionPago,
  updateTenantSubscription,
} from "./suscripcion";

export {
  countNotificationsByStatus,
  existsOutboxForReservaEvent,
  getNotificationById,
  insertNotificationOutbox,
  listPendingNotifications,
  markNotificationFailed,
  markNotificationSent,
} from "./outbox";
export function getTenantBySlug(db: Database, slug: string) {
  return db.query.tenants.findFirst({
    where: (t, { eq }) => eq(t.slug, slug),
  });
}

export async function listMemberships(
  db: Database,
  userId: string,
): Promise<Membership[]> {
  return db
    .select({
      tenantId: userTenants.tenantId,
      role: userTenants.role,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(userTenants)
    .innerJoin(tenants, eq(tenants.id, userTenants.tenantId))
    .where(eq(userTenants.userId, userId));
}

export async function getMembership(
  db: Database,
  userId: string,
  tenantId: string,
): Promise<Membership | null> {
  const rows = await db
    .select({
      tenantId: userTenants.tenantId,
      role: userTenants.role,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(userTenants)
    .innerJoin(tenants, eq(tenants.id, userTenants.tenantId))
    .where(
      and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export function listSedes(db: Database, tenantId: string) {
  return db.query.sedes.findMany({
    where: (s, { eq }) => eq(s.tenantId, tenantId),
  });
}

export function listSalasBySede(db: Database, tenantId: string, sedeId: string) {
  return db.query.salas.findMany({
    where: (s, { and, eq, isNull }) =>
      and(eq(s.tenantId, tenantId), eq(s.sedeId, sedeId), isNull(s.deletedAt)),
  });
}

export function findClienteByTelefono(
  db: Database,
  tenantId: string,
  telefono: string,
) {
  return db.query.clientes.findFirst({
    where: (c, { and, eq }) =>
      and(eq(c.tenantId, tenantId), eq(c.telefono, telefono)),
  });
}

export async function listTenantMembers(db: Database, tenantId: string) {
  return db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: userTenants.role,
      createdAt: userTenants.createdAt,
      passwordHash: users.passwordHash,
    })
    .from(userTenants)
    .innerJoin(users, eq(users.id, userTenants.userId))
    .where(eq(userTenants.tenantId, tenantId));
}

export function listPendingInvites(db: Database, tenantId: string) {
  return db.query.tenantInvites.findMany({
    where: and(
      eq(tenantInvites.tenantId, tenantId),
      isNull(tenantInvites.acceptedAt),
    ),
    orderBy: (i, { desc }) => [desc(i.createdAt)],
  });
}

export function findInviteByToken(db: Database, token: string) {
  return db.query.tenantInvites.findFirst({
    where: eq(tenantInvites.token, token),
    with: { tenant: true },
  });
}

export {
  addFavorito,
  listFavoritoIds,
  listFavoritosDetalle,
  listFavoritosPublicosByUserId,
  removeFavorito,
  syncFavoritos,
} from "./favoritos";

export { insertAnalyticsEvent } from "./analytics";

/** Reservas activas de una sala que solapan [from, to) */
export function reservasActivasSolapadas(
  db: Database,
  tenantId: string,
  salaId: string,
  from: Date,
  to: Date,
) {
  return db
    .select()
    .from(reservas)
    .where(
      and(
        eq(reservas.tenantId, tenantId),
        eq(reservas.salaId, salaId),
        sql`${reservas.estado} in ('hold', 'pendiente_aprobacion', 'confirmada', 'senada')`,
        lt(reservas.startsAt, to),
        gte(reservas.endsAt, from),
      ),
    );
}

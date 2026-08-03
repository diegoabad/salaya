import { and, asc, desc, eq, gt, gte, lt, sql } from "drizzle-orm";
import type { MedioPago, MovimientoTipo } from "@repo/shared";
import type { Database } from "../client";
import {
  clientes,
  movimientosCaja,
  reservas,
  salas,
} from "../schema";

export async function listMovimientosRango(
  db: Database,
  tenantId: string,
  from: Date,
  to: Date,
) {
  return db
    .select({
      id: movimientosCaja.id,
      tipo: movimientosCaja.tipo,
      estado: movimientosCaja.estado,
      medioPago: movimientosCaja.medioPago,
      monto: movimientosCaja.monto,
      descripcion: movimientosCaja.descripcion,
      occurredAt: movimientosCaja.occurredAt,
      reservaId: movimientosCaja.reservaId,
      clienteNombre: clientes.nombre,
      salaName: salas.name,
      turnoStartsAt: reservas.startsAt,
      turnoEndsAt: reservas.endsAt,
    })
    .from(movimientosCaja)
    .leftJoin(reservas, eq(reservas.id, movimientosCaja.reservaId))
    .leftJoin(clientes, eq(clientes.id, reservas.clienteId))
    .leftJoin(salas, eq(salas.id, reservas.salaId))
    .where(
      and(
        eq(movimientosCaja.tenantId, tenantId),
        gte(movimientosCaja.occurredAt, from),
        lt(movimientosCaja.occurredAt, to),
        eq(movimientosCaja.estado, "cobrado"),
      ),
    )
    .orderBy(desc(movimientosCaja.occurredAt));
}

/** Último inicio_caja del tenant (más reciente). */
export async function findLatestInicioCaja(db: Database, tenantId: string) {
  const [row] = await db
    .select({
      id: movimientosCaja.id,
      occurredAt: movimientosCaja.occurredAt,
      monto: movimientosCaja.monto,
    })
    .from(movimientosCaja)
    .where(
      and(
        eq(movimientosCaja.tenantId, tenantId),
        eq(movimientosCaja.tipo, "inicio_caja"),
        eq(movimientosCaja.estado, "cobrado"),
      ),
    )
    .orderBy(desc(movimientosCaja.occurredAt))
    .limit(1);
  return row ?? null;
}

/** Primer inicio_caja dentro de un rango (día operativo). */
export async function findInicioCajaEnRango(
  db: Database,
  tenantId: string,
  from: Date,
  to: Date,
) {
  const [row] = await db
    .select({
      id: movimientosCaja.id,
      occurredAt: movimientosCaja.occurredAt,
      monto: movimientosCaja.monto,
    })
    .from(movimientosCaja)
    .where(
      and(
        eq(movimientosCaja.tenantId, tenantId),
        eq(movimientosCaja.tipo, "inicio_caja"),
        eq(movimientosCaja.estado, "cobrado"),
        gte(movimientosCaja.occurredAt, from),
        lt(movimientosCaja.occurredAt, to),
      ),
    )
    .orderBy(asc(movimientosCaja.occurredAt))
    .limit(1);
  return row ?? null;
}

/** Primer cierre_caja estrictamente posterior a `after`. */
export async function findCierreCajaAfter(
  db: Database,
  tenantId: string,
  after: Date,
) {
  const [row] = await db
    .select({
      id: movimientosCaja.id,
      occurredAt: movimientosCaja.occurredAt,
      monto: movimientosCaja.monto,
    })
    .from(movimientosCaja)
    .where(
      and(
        eq(movimientosCaja.tenantId, tenantId),
        eq(movimientosCaja.tipo, "cierre_caja"),
        eq(movimientosCaja.estado, "cobrado"),
        gt(movimientosCaja.occurredAt, after),
      ),
    )
    .orderBy(asc(movimientosCaja.occurredAt))
    .limit(1);
  return row ?? null;
}

export async function insertMovimiento(
  db: Database,
  tenantId: string,
  input: {
    tipo: MovimientoTipo;
    medioPago: MedioPago;
    monto: string;
    reservaId?: string | null;
    descripcion?: string | null;
    occurredAt?: Date;
  },
) {
  const [row] = await db
    .insert(movimientosCaja)
    .values({
      tenantId,
      tipo: input.tipo,
      estado: "cobrado",
      medioPago: input.medioPago,
      monto: input.monto,
      reservaId: input.reservaId ?? null,
      descripcion: input.descripcion ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .returning();
  return row!;
}

/** Suma cobros (seña+saldo) − reembolsos de una reserva */
export async function sumCobradoReserva(
  db: Database,
  tenantId: string,
  reservaId: string,
) {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(
        case
          when ${movimientosCaja.tipo} in ('sena', 'saldo') then ${movimientosCaja.monto}::numeric
          when ${movimientosCaja.tipo} = 'reembolso' then -${movimientosCaja.monto}::numeric
          else 0
        end
      ), 0)`,
    })
    .from(movimientosCaja)
    .where(
      and(
        eq(movimientosCaja.tenantId, tenantId),
        eq(movimientosCaja.reservaId, reservaId),
        eq(movimientosCaja.estado, "cobrado"),
      ),
    );
  return Number(row?.total ?? 0);
}

import { getDb, reservas } from "@repo/db";
import {
  findCierreCajaAfter,
  findInicioCajaEnRango,
  findLatestInicioCaja,
  insertMovimiento,
  listMovimientosRango,
} from "@repo/db/queries";
import type { CreateMovimientoInput } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import { HttpError } from "../middlewares/errorHandler";
import {
  arDayBounds,
  arLocalToUtc,
  fechaArFromUtc,
  formatHoraAr,
  todayArDate,
} from "./arTime";

function formatHoraIso(d: Date) {
  return d.toISOString();
}

function esSalida(tipo: string) {
  return tipo === "egreso" || tipo === "reembolso";
}

function esInicio(tipo: string) {
  return tipo === "inicio_caja";
}

function esCierre(tipo: string) {
  return tipo === "cierre_caja";
}

/** No suma a ingresos/egresos/inicio (marcador de cierre). */
function esMarcadorCierre(tipo: string) {
  return esCierre(tipo);
}

type SesionRango = {
  fecha: string;
  from: Date;
  to: Date;
  abierta: boolean;
  cerradaAt: Date | null;
};

async function resolveSesionAbierta(
  tenantId: string,
): Promise<SesionRango | null> {
  const db = getDb();
  const inicio = await findLatestInicioCaja(db, tenantId);
  if (!inicio) return null;
  const cierre = await findCierreCajaAfter(db, tenantId, inicio.occurredAt);
  if (cierre) return null;
  const fecha = fechaArFromUtc(inicio.occurredAt);
  const { start } = arDayBounds(fecha);
  return {
    fecha,
    from: start,
    to: new Date(Date.now() + 60_000),
    abierta: true,
    cerradaAt: null,
  };
}

async function resolveSesionPorFecha(
  tenantId: string,
  fecha: string,
): Promise<SesionRango> {
  const db = getDb();
  const { start, end } = arDayBounds(fecha);
  const inicio = await findInicioCajaEnRango(db, tenantId, start, end);
  if (!inicio) {
    return {
      fecha,
      from: start,
      to: end,
      abierta: false,
      cerradaAt: null,
    };
  }
  const cierre = await findCierreCajaAfter(db, tenantId, inicio.occurredAt);
  return {
    fecha,
    from: start,
    to: cierre
      ? new Date(cierre.occurredAt.getTime() + 1)
      : new Date(Date.now() + 60_000),
    abierta: !cierre,
    cerradaAt: cierre?.occurredAt ?? null,
  };
}

function buildCajaDto(
  sesion: SesionRango,
  rows: Awaited<ReturnType<typeof listMovimientosRango>>,
) {
  const movimientos = rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    estado: m.estado,
    medioPago: m.medioPago ?? "efectivo",
    monto: Number(m.monto),
    descripcion: m.descripcion,
    occurredAt: formatHoraIso(m.occurredAt),
    reservaId: m.reservaId,
    clienteNombre: m.clienteNombre ?? "—",
    salaName: m.salaName,
    turnoStartsAt: m.turnoStartsAt ? formatHoraAr(m.turnoStartsAt) : null,
    turnoEndsAt: m.turnoEndsAt ? formatHoraAr(m.turnoEndsAt) : null,
  }));

  const inicioCaja = movimientos
    .filter((m) => esInicio(m.tipo))
    .reduce((acc, m) => acc + m.monto, 0);
  const ingresos = movimientos
    .filter(
      (m) => !esSalida(m.tipo) && !esInicio(m.tipo) && !esMarcadorCierre(m.tipo),
    )
    .reduce((acc, m) => acc + m.monto, 0);
  const egresos = movimientos
    .filter((m) => esSalida(m.tipo))
    .reduce((acc, m) => acc + m.monto, 0);
  const total = inicioCaja + ingresos - egresos;

  const porMedio: Record<string, number> = {};
  for (const m of movimientos) {
    if (esMarcadorCierre(m.tipo)) continue;
    const key = m.medioPago;
    const signed = esSalida(m.tipo) ? -m.monto : m.monto;
    porMedio[key] = (porMedio[key] ?? 0) + signed;
  }

  return {
    fecha: sesion.fecha,
    abierta: sesion.abierta,
    cerradaAt: sesion.cerradaAt ? formatHoraIso(sesion.cerradaAt) : null,
    inicioCaja,
    ingresos,
    egresos,
    total,
    porMedio,
    movimientos,
  };
}

/**
 * Sin fecha → sesión abierta si existe; si no, día civil de hoy.
 * Con fecha → sesión de ese día operativo (puede extenderse past medianoche).
 */
export async function listCajaDia(tenantId: string, fecha?: string) {
  let sesion: SesionRango;
  if (!fecha) {
    sesion =
      (await resolveSesionAbierta(tenantId)) ??
      (await resolveSesionPorFecha(tenantId, todayArDate()));
  } else {
    sesion = await resolveSesionPorFecha(tenantId, fecha);
  }

  const rows = await listMovimientosRango(
    getDb(),
    tenantId,
    sesion.from,
    sesion.to,
  );
  return buildCajaDto(sesion, rows);
}

export async function createMovimientoCaja(
  tenantId: string,
  input: CreateMovimientoInput,
) {
  const db = getDb();
  const abierta = await resolveSesionAbierta(tenantId);

  if (input.tipo === "inicio_caja") {
    if (abierta) {
      throw new HttpError(
        409,
        "CAJA_ABIERTA",
        "Ya hay una caja abierta. Cerrala antes de iniciar otra.",
      );
    }
    const fechaInicio = input.fecha ?? todayArDate();
    if (fechaInicio !== todayArDate()) {
      throw new HttpError(
        400,
        "CAJA_DIA_INVALIDO",
        "Solo podés iniciar la caja el día de hoy.",
      );
    }
  } else if (input.tipo === "cierre_caja") {
    if (!abierta) {
      throw new HttpError(
        409,
        "CAJA_CERRADA",
        "No hay una caja abierta para cerrar.",
      );
    }
  } else if (abierta) {
    // cobros de madrugada siguen en la sesión abierta
  } else if (input.fecha) {
    const sesionFecha = await resolveSesionPorFecha(tenantId, input.fecha);
    if (sesionFecha.cerradaAt) {
      throw new HttpError(
        409,
        "CAJA_CERRADA",
        "La caja de ese día ya está cerrada.",
      );
    }
  }

  if (input.reservaId) {
    const reserva = await db.query.reservas.findFirst({
      where: (r, { and, eq }) =>
        and(eq(r.tenantId, tenantId), eq(r.id, input.reservaId!)),
    });
    if (!reserva) {
      throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");
    }
  }

  let monto = input.monto;
  let occurredAt: Date | undefined;

  if (input.tipo === "cierre_caja") {
    const caja = await listCajaDia(tenantId);
    monto = String(caja.total);
    occurredAt = new Date();
  } else if (abierta || input.tipo === "inicio_caja") {
    // Sesión viva o apertura: timestamp real (soporta madrugada)
    occurredAt = new Date();
  } else if (input.fecha && input.fecha !== todayArDate()) {
    occurredAt = arLocalToUtc(input.fecha, formatHoraAr(new Date()));
  }

  const row = await insertMovimiento(db, tenantId, {
    tipo: input.tipo,
    medioPago: input.medioPago,
    monto,
    reservaId: input.reservaId ?? null,
    descripcion:
      input.descripcion ??
      (input.tipo === "cierre_caja" ? "Cierre de caja" : null),
    occurredAt,
  });

  if (
    input.reservaId &&
    input.tipo === "sena" &&
    (input.marcarSenaPagada ?? true)
  ) {
    await db
      .update(reservas)
      .set({
        senaPagada: true,
        senaMonto: input.monto,
        estado: "senada",
        updatedAt: new Date(),
      })
      .where(
        and(eq(reservas.tenantId, tenantId), eq(reservas.id, input.reservaId)),
      );
  }

  return {
    id: row.id,
    tipo: row.tipo,
    medioPago: row.medioPago,
    monto: Number(row.monto),
    occurredAt: row.occurredAt.toISOString(),
  };
}

/** Helper para auto-registrar seña al crear reserva desde panel */
export async function registrarSenaSiCorresponde(
  tenantId: string,
  reservaId: string,
  senaMonto: string,
  senaPagada: boolean,
) {
  if (!senaPagada || Number(senaMonto) <= 0) return null;
  return insertMovimiento(getDb(), tenantId, {
    tipo: "sena",
    medioPago: "efectivo",
    monto: senaMonto,
    reservaId,
    descripcion: "Seña al crear reserva (panel)",
  });
}

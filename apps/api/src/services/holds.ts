import {
  assertStockAdicionales,
  calcularMontoSena,
  calculateAdicionalPrice,
  calculateSalaPrice,
  StockAdicionalError,
  type ReglaPrecio,
} from "@repo/core";
import { getDb } from "@repo/db";
import {
  expireHoldsPast,
  findHoldBySession as findHoldRow,
  findSalaPublicaById,
  getPoliticaBySede,
  insertHoldReserva,
  insertMovimiento,
  listAdicionalesByIds,
  listAdicionalesPublicosSede,
  listBloqueosSalaRango,
  listHoldsActivosSala,
  listHorariosAtencionSede,
  listOcupacionDia,
  listReglasPrecio,
  listReservaAdicionales,
  listUsosAdicionalesSolape,
  replaceReservaAdicionales,
  updateHoldReserva,
  upsertClienteByTelefono,
} from "@repo/db/queries";
import { addMoney, POLITICA_DEFAULTS, type DiaSemana } from "@repo/shared";
import { z } from "zod";
import { HttpError } from "../middlewares/errorHandler";
import { trackEvent } from "./analytics";
import {
  arDayBounds,
  arLocalToUtc,
  fechaArFromUtc,
  formatHoraAr,
} from "./arTime";
import { assertSalaDisponible } from "./disponibilidad";
import { enqueueReservaConfirmada } from "./notifications";

export type HoldPublic = {
  id: string;
  salaId: string;
  sessionId: string;
  fecha: string;
  horas: string[];
  expiresAt: string;
  precioTotal: number;
  precioSala: number;
  precioAdicionales: number;
};

export type HoldAdicionalInput = { id: string; cantidad: number };

export type ReglaPublica = {
  tipo: "continuo" | "puntual";
  nombre: string | null;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  precioPorHora: number;
  descuentoPorcentaje: number | null;
};

type Listener = (event: "upsert" | "remove", hold: HoldPublic) => void;
const listeners = new Set<Listener>();

export function onHoldChange(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: "upsert" | "remove", hold: HoldPublic) {
  for (const l of listeners) l(event, hold);
}

/** Para webhook MP / otros writers que confirman un hold */
export function emitHoldRemovePublic(hold: {
  id: string;
  salaId: string;
  sessionId?: string;
  fecha?: string;
  horas?: string[];
  precioTotal?: number;
}) {
  emit("remove", {
    id: hold.id,
    salaId: hold.salaId,
    sessionId: hold.sessionId ?? "",
    fecha: hold.fecha ?? "",
    horas: hold.horas ?? [],
    expiresAt: new Date(0).toISOString(),
    precioTotal: hold.precioTotal ?? 0,
    precioSala: 0,
    precioAdicionales: 0,
  });
}

function toCoreRegla(row: {
  id: string;
  tipo: "continuo" | "puntual";
  nombre: string | null;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  precioPorHora: string;
  descuentoPorcentaje: string | null;
  active: boolean;
}): ReglaPrecio {
  return {
    id: row.id,
    tipo: row.tipo,
    nombre: row.nombre,
    daysOfWeek: row.daysOfWeek as DiaSemana[],
    startTime: row.startTime,
    endTime: row.endTime,
    fechaDesde: row.fechaDesde,
    fechaHasta: row.fechaHasta,
    precioPorHora: String(row.precioPorHora),
    descuentoPorcentaje: row.descuentoPorcentaje,
    active: row.active,
  };
}

function baseRegla(precioHora: string): ReglaPrecio {
  return {
    id: "__base__",
    tipo: "continuo",
    nombre: "Base",
    daysOfWeek: [],
    startTime: null,
    endTime: null,
    precioPorHora: Number(precioHora).toFixed(2),
    active: true,
  };
}

async function reglasParaSala(
  tenantId: string,
  salaId: string,
  precioHora: string,
): Promise<ReglaPrecio[]> {
  const rows = await listReglasPrecio(getDb(), tenantId);
  const deSala = rows
    .filter(
      (r) =>
        r.active &&
        r.scope === "sala" &&
        r.scopeId === salaId,
    )
    .map(toCoreRegla);
  return [...deSala, baseRegla(precioHora)];
}

function horaToMinutes(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h! * 60 + m!;
}

function minutesToHora(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Ordena y completa huecos de 60 min entre la primera y la última hora. */
function normalizeHorasContiguas(horas: string[]) {
  const sorted = [...new Set(horas)].sort(
    (a, b) => horaToMinutes(a) - horaToMinutes(b),
  );
  if (sorted.length === 0) {
    throw new HttpError(400, "HOLD_EMPTY", "Elegí al menos un horario");
  }
  if (sorted.length === 1) return sorted;
  const out: string[] = [];
  const from = horaToMinutes(sorted[0]!);
  const to = horaToMinutes(sorted[sorted.length - 1]!);
  for (let m = from; m <= to; m += 60) {
    out.push(minutesToHora(m));
  }
  return out;
}

/** fecha YYYY-MM-DD + HH:MM (hora AR) → UTC Date — ver arLocalToUtc */

function rangeToHoras(startsAt: Date, endsAt: Date): string[] {
  const horas: string[] = [];
  let cursor = startsAt.getTime();
  const end = endsAt.getTime();
  while (cursor + 60_000 < end) {
    horas.push(formatHoraAr(new Date(cursor)));
    cursor += 60 * 60_000;
  }
  return horas;
}

function toPublic(row: {
  id: string;
  salaId: string;
  holdSessionId: string | null;
  startsAt: Date;
  endsAt: Date;
  holdExpiresAt: Date | null;
  precioTotal?: string | number;
  precioSala?: string | number;
  precioAdicionales?: string | number;
}): HoldPublic {
  return {
    id: row.id,
    salaId: row.salaId,
    sessionId: row.holdSessionId ?? "",
    fecha: fechaArFromUtc(row.startsAt),
    horas: rangeToHoras(row.startsAt, row.endsAt),
    expiresAt: (row.holdExpiresAt ?? row.startsAt).toISOString(),
    precioTotal: Number(row.precioTotal ?? 0),
    precioSala: Number(row.precioSala ?? 0),
    precioAdicionales: Number(row.precioAdicionales ?? 0),
  };
}

async function resolveSala(salaId: string) {
  const sala = await findSalaPublicaById(getDb(), salaId);
  if (!sala) throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");
  const politica = await getPoliticaBySede(getDb(), sala.sedeId);
  return {
    sala,
    holdMinutos: politica?.holdMinutos ?? POLITICA_DEFAULTS.holdMinutos,
    politica,
    sena: {
      senaModo: (politica?.senaModo ?? POLITICA_DEFAULTS.senaModo) as
        | "nunca"
        | "siempre"
        | "reincidentes",
      senaTipo: (politica?.senaTipo ?? POLITICA_DEFAULTS.senaTipo) as
        | "porcentaje"
        | "fijo",
      senaValor: String(politica?.senaValor ?? POLITICA_DEFAULTS.senaValor),
    },
  };
}

export async function holdMinutesForSala(salaId: string) {
  const { holdMinutos } = await resolveSala(salaId);
  return holdMinutos;
}

export async function politicaPublicaSala(salaId: string) {
  const { sala, holdMinutos, sena, politica } = await resolveSala(salaId);
  const db = getDb();
  const [rows, horarios] = await Promise.all([
    listReglasPrecio(db, sala.tenantId),
    listHorariosAtencionSede(db, sala.tenantId, sala.sedeId),
  ]);
  const reglas: ReglaPublica[] = rows
    .filter(
      (r) => r.active && r.scope === "sala" && r.scopeId === salaId,
    )
    .map((r) => ({
      tipo: r.tipo,
      nombre: r.nombre,
      daysOfWeek: r.daysOfWeek ?? [],
      startTime: r.startTime,
      endTime: r.endTime,
      fechaDesde: r.fechaDesde,
      fechaHasta: r.fechaHasta,
      precioPorHora: Number(r.precioPorHora),
      descuentoPorcentaje:
        r.descuentoPorcentaje != null ? Number(r.descuentoPorcentaje) : null,
    }));
  return {
    holdMinutos,
    ...sena,
    cancelacionVentanaHoras:
      politica?.cancelacionVentanaHoras ??
      POLITICA_DEFAULTS.cancelacionVentanaHoras,
    senaDestinoCancelacion:
      politica?.senaDestinoCancelacion ??
      POLITICA_DEFAULTS.senaDestinoCancelacion,
    permiteReprogramar:
      politica?.permiteReprogramar ?? POLITICA_DEFAULTS.permiteReprogramar,
    precioHora: Number(sala.precioHora),
    reglas,
    horarios: horarios.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime,
      endTime: h.endTime,
    })),
  };
}

export async function listHolds(salaId: string, fecha?: string): Promise<HoldPublic[]> {
  await tickExpiredHolds();
  const now = new Date();
  let start: Date | undefined;
  let end: Date | undefined;
  if (fecha) {
    ({ start, end } = arDayBounds(fecha));
  }
  const rows = await listHoldsActivosSala(getDb(), salaId, now, start, end);
  return rows
    .filter((r) => r.holdSessionId)
    .map((r) => toPublic(r));
}

export async function listOcupacion(salaId: string, fecha: string) {
  await tickExpiredHolds();
  const { sala } = await resolveSala(salaId);
  const { start, end } = arDayBounds(fecha);
  const db = getDb();
  const [rows, bloqueos] = await Promise.all([
    listOcupacionDia(db, salaId, start, end),
    listBloqueosSalaRango(
      db,
      sala.tenantId,
      sala.sedeId,
      salaId,
      start,
      end,
    ),
  ]);
  const horas = new Set<string>();
  for (const r of rows) {
    for (const h of rangeToHoras(r.startsAt, r.endsAt)) {
      horas.add(h);
    }
  }
  for (const b of bloqueos) {
    for (const h of rangeToHoras(b.startsAt, b.endsAt)) {
      horas.add(h);
    }
  }
  return { fecha, horas: [...horas].sort() };
}

export async function listAdicionalesPublicos(salaId: string) {
  const { sala } = await resolveSala(salaId);
  const rows = await listAdicionalesPublicosSede(
    getDb(),
    sala.tenantId,
    sala.sedeId,
  );
  const gruposMap = new Map<
    string,
    {
      id: string;
      name: string;
      items: Array<{
        id: string;
        name: string;
        precioBase: number;
        modalidad: "por_hora" | "por_reserva";
        stock: number | null;
        caracteristicas: string[];
        photoUrl: string | null;
      }>;
    }
  >();
  for (const r of rows) {
    let g = gruposMap.get(r.grupoId);
    if (!g) {
      g = { id: r.grupoId, name: r.grupoName, items: [] };
      gruposMap.set(r.grupoId, g);
    }
    g.items.push({
      id: r.id,
      name: r.name,
      precioBase: Number(r.precioBase),
      modalidad: r.modalidad,
      stock: r.stock,
      caracteristicas: r.caracteristicas ?? [],
      photoUrl: r.photoUrl ?? null,
    });
  }
  return { grupos: [...gruposMap.values()] };
}

type AdicLine = {
  adicionalId: string;
  cantidad: number;
  precioUnitario: string;
  modalidad: "por_hora" | "por_reserva";
  lineTotal: string;
};

async function resolveAdicionalesForHold(input: {
  tenantId: string;
  startsAt: Date;
  endsAt: Date;
  excludeReservaId?: string;
  pedidos: HoldAdicionalInput[] | undefined;
  existingReservaId?: string;
}): Promise<{ lines: AdicLine[]; precioAdicionales: string }> {
  const db = getDb();
  let pedidos = input.pedidos;

  if (pedidos === undefined && input.existingReservaId) {
    const prev = await listReservaAdicionales(db, input.existingReservaId);
    pedidos = prev.map((p) => ({
      id: p.adicionalId,
      cantidad: p.cantidad,
    }));
  }
  if (!pedidos || pedidos.length === 0) {
    return { lines: [], precioAdicionales: "0.00" };
  }

  const ids = [...new Set(pedidos.map((p) => p.id))];
  const catalog = await listAdicionalesByIds(db, input.tenantId, ids);
  if (catalog.length !== ids.length) {
    throw new HttpError(
      400,
      "ADICIONAL_INVALID",
      "Uno o más adicionales no existen o están inactivos",
    );
  }
  const byId = new Map(catalog.map((c) => [c.id, c]));

  const stockPedidos = pedidos.map((p) => {
    const c = byId.get(p.id)!;
    return {
      adicionalId: p.id,
      cantidad: p.cantidad,
      stock: c.stock,
    };
  });
  const usos = await listUsosAdicionalesSolape(
    db,
    input.tenantId,
    input.startsAt,
    input.endsAt,
    input.excludeReservaId,
  );
  try {
    assertStockAdicionales(
      { startsAt: input.startsAt, endsAt: input.endsAt },
      stockPedidos,
      usos,
    );
  } catch (err) {
    if (err instanceof StockAdicionalError) {
      throw new HttpError(409, "STOCK_ADICIONAL", err.message);
    }
    throw err;
  }

  // Reglas de precio por adicional (scope adicional)
  const allRules = await listReglasPrecio(db, input.tenantId);
  const lines: AdicLine[] = [];
  let precioAdicionales = "0.00";
  for (const p of pedidos) {
    const c = byId.get(p.id)!;
    const rules = allRules
      .filter(
        (r) =>
          r.active && r.scope === "adicional" && r.scopeId === p.id,
      )
      .map(toCoreRegla);
    const lineTotal = calculateAdicionalPrice({
      precioBase: String(c.precioBase),
      modalidad: c.modalidad,
      cantidad: p.cantidad,
      rules,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    const hours =
      (input.endsAt.getTime() - input.startsAt.getTime()) / 3_600_000;
    const unit =
      c.modalidad === "por_hora"
        ? (Number(lineTotal) / (p.cantidad * (hours || 1))).toFixed(2)
        : (Number(lineTotal) / p.cantidad).toFixed(2);
    lines.push({
      adicionalId: p.id,
      cantidad: p.cantidad,
      precioUnitario: unit,
      modalidad: c.modalidad,
      lineTotal,
    });
    precioAdicionales = addMoney(precioAdicionales, lineTotal);
  }
  return { lines, precioAdicionales };
}

export async function upsertHold(input: {
  salaId: string;
  sessionId: string;
  fecha: string;
  horas: string[];
  /** Si viene definido (aunque vacío), reemplaza adicionales del hold */
  adicionales?: HoldAdicionalInput[];
}): Promise<HoldPublic> {
  await tickExpiredHolds();
  const horas = normalizeHorasContiguas(input.horas);
  const { sala, holdMinutos } = await resolveSala(input.salaId);
  const db = getDb();
  const now = new Date();

  const startsUtc = arLocalToUtc(input.fecha, horas[0]!);
  const lastStart = arLocalToUtc(input.fecha, horas[horas.length - 1]!);
  const endsFixed = new Date(lastStart.getTime() + 60 * 60_000);

  const existing = await findHoldRow(db, input.salaId, input.sessionId, now);

  await assertSalaDisponible({
    tenantId: sala.tenantId,
    sedeId: sala.sedeId,
    salaId: sala.id,
    startsAt: startsUtc,
    endsAt: endsFixed,
    excludeReservaId: existing?.id,
    sala: {
      duracionMinMinutos: sala.duracionMinMinutos,
      duracionMaxMinutos: sala.duracionMaxMinutos,
      granularidadMinutos: sala.granularidadMinutos,
    },
  });

  const rules = await reglasParaSala(
    sala.tenantId,
    sala.id,
    String(sala.precioHora),
  );
  const precioSala = calculateSalaPrice({
    rules,
    startsAt: startsUtc,
    endsAt: endsFixed,
  });

  const { lines, precioAdicionales } = await resolveAdicionalesForHold({
    tenantId: sala.tenantId,
    startsAt: startsUtc,
    endsAt: endsFixed,
    excludeReservaId: existing?.id,
    pedidos: input.adicionales,
    existingReservaId:
      input.adicionales === undefined ? existing?.id : undefined,
  });
  const precioTotal = addMoney(precioSala, precioAdicionales);

  try {
    if (existing) {
      const updated = await updateHoldReserva(db, existing.id, {
        startsAt: startsUtc,
        endsAt: endsFixed,
        holdExpiresAt: existing.holdExpiresAt,
        precioSala,
        precioAdicionales,
        precioTotal,
      });
      await replaceReservaAdicionales(db, sala.tenantId, existing.id, lines);
      const pub = toPublic(updated!);
      emit("upsert", pub);
      return pub;
    }

    const created = await insertHoldReserva(db, {
      tenantId: sala.tenantId,
      sedeId: sala.sedeId,
      salaId: sala.id,
      startsAt: startsUtc,
      endsAt: endsFixed,
      estado: "hold",
      origen: "publico",
      holdExpiresAt: new Date(now.getTime() + holdMinutos * 60_000),
      holdSessionId: input.sessionId,
      precioSala,
      precioAdicionales,
      precioTotal,
    });
    if (lines.length > 0) {
      await replaceReservaAdicionales(
        db,
        sala.tenantId,
        created.id,
        lines,
      );
    }
    const pub = toPublic(created);
    emit("upsert", pub);
    void trackEvent({
      eventType: "reserva.hold_creado",
      tenantId: sala.tenantId,
      salaId: sala.id,
      reservaId: created.id,
      sessionId: input.sessionId,
      payload: {
        fecha: input.fecha,
        horas,
        precioTotal: Number(precioTotal),
      },
    });
    return pub;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("reservas_sala_no_overlap") || msg.includes("exclusion")) {
      throw new HttpError(409, "HOLD_CONFLICT", "Ese horario ya está ocupado");
    }
    throw err;
  }
}

export async function releaseHoldBySession(
  salaId: string,
  sessionId: string,
): Promise<HoldPublic | null> {
  const db = getDb();
  const now = new Date();
  const existing = await findHoldRow(db, salaId, sessionId, now);
  if (!existing) return null;
  const pub = toPublic(existing);
  await updateHoldReserva(db, existing.id, {
    estado: "cancelada",
    canceladoPor: "cliente",
    canceladoAt: now,
    cancelMotivo: "Hold liberado",
    holdExpiresAt: null,
  });
  emit("remove", pub);
  return pub;
}

export const confirmHoldSchema = z.object({
  clienteNombre: z.string().trim().min(2).max(120),
  clienteTelefono: z.string().trim().min(6).max(40),
  clienteEmail: z.string().trim().email().optional().nullable(),
  /** Simulación MP: true = seña/pago cobrado */
  pagoOk: z.boolean().default(true),
});

export async function confirmHold(
  salaId: string,
  sessionId: string,
  input: z.infer<typeof confirmHoldSchema>,
) {
  await tickExpiredHolds();
  const db = getDb();
  const now = new Date();
  const { sala, politica } = await resolveSala(salaId);
  const hold = await findHoldRow(db, salaId, sessionId, now);
  if (!hold) {
    throw new HttpError(404, "HOLD_GONE", "El hold expiró o no existe");
  }

  const cliente = await upsertClienteByTelefono(db, sala.tenantId, {
    telefono: input.clienteTelefono,
    nombre: input.clienteNombre,
    email: input.clienteEmail,
  });

  const precioTotal = hold.precioTotal;
  const senaPolitica = {
    senaModo: (politica?.senaModo ?? POLITICA_DEFAULTS.senaModo) as
      | "nunca"
      | "siempre"
      | "reincidentes",
    senaTipo: (politica?.senaTipo ?? POLITICA_DEFAULTS.senaTipo) as
      | "porcentaje"
      | "fijo",
    senaValor: politica?.senaValor ?? POLITICA_DEFAULTS.senaValor,
    clienteNoShowCount: cliente.noShowCount,
  };
  const senaMonto = calcularMontoSena(String(precioTotal), senaPolitica);
  const requiereSena = Number(senaMonto) > 0;
  const senaPagada = requiereSena && input.pagoOk;
  const estado = senaPagada ? "senada" : "confirmada";

  const updated = await updateHoldReserva(db, hold.id, {
    clienteId: cliente.id,
    estado,
    senaMonto,
    senaPagada,
    holdExpiresAt: null,
    // keep holdSessionId for audit or clear:
    holdSessionId: null,
  });

  if (senaPagada) {
    await insertMovimiento(db, sala.tenantId, {
      tipo: "sena",
      medioPago: "mercadopago",
      monto: senaMonto,
      reservaId: hold.id,
      descripcion: "Seña checkout público (simulado)",
    });
  } else if (!requiereSena && input.pagoOk) {
    // sin seña: cobro total simulado opcional — solo confirmamos
  }

  const pub = toPublic({ ...hold, holdSessionId: sessionId });
  emit("remove", pub);

  const codigo = `SY-${updated!.id.slice(0, 8).toUpperCase()}`;
  await enqueueReservaConfirmada({
    tenantId: sala.tenantId,
    reservaId: updated!.id,
    email: cliente.email ?? input.clienteEmail,
    clienteNombre: cliente.nombre,
    salaNombre: sala.name,
    startsAt: hold.startsAt,
    endsAt: hold.endsAt,
    codigo,
  });

  void trackEvent({
    eventType: senaPagada ? "reserva.senada" : "reserva.confirmada",
    tenantId: sala.tenantId,
    salaId: sala.id,
    reservaId: updated!.id,
    sessionId,
    payload: {
      estado,
      precioTotal: Number(precioTotal),
      senaMonto: Number(senaMonto),
      horas: pub.horas,
      fecha: pub.fecha,
    },
  });

  return {
    id: updated!.id,
    codigo,
    estado,
    startsAt: hold.startsAt.toISOString(),
    endsAt: hold.endsAt.toISOString(),
    precioTotal: Number(precioTotal),
    senaMonto: Number(senaMonto),
    senaPagada,
    clienteNombre: cliente.nombre,
  };
}

export async function tickExpiredHolds(): Promise<HoldPublic[]> {
  const expired = await expireHoldsPast(getDb(), new Date());
  const removed: HoldPublic[] = [];
  for (const row of expired) {
    if (!row.holdSessionId) continue;
    const pub: HoldPublic = {
      id: row.id,
      salaId: row.salaId,
      sessionId: row.holdSessionId,
      fecha: fechaArFromUtc(row.startsAt),
      horas: rangeToHoras(row.startsAt, row.endsAt),
      expiresAt: new Date(0).toISOString(),
      precioTotal: 0,
      precioSala: 0,
      precioAdicionales: 0,
    };
    removed.push(pub);
    emit("remove", pub);
  }
  return removed;
}

/** @deprecated prefer holdMinutesForSala */
export function holdMinutes() {
  return POLITICA_DEFAULTS.holdMinutos;
}

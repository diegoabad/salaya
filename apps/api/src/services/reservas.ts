import {
  calculateAdicionalPrice,
  calculateSalaPrice,
  PrecioNoDefinidoError,
  type ReglaPrecio,
} from "@repo/core";
import { getDb, reservas } from "@repo/db";
import {
  getNegocioBundle,
  getReservaById,
  getSalaById,
  listAdicionalesByIds,
  listReglasPrecio,
  listReservasAdicionales,
  listReservasRango,
  replaceReservaAdicionales,
  sumCobradoReserva,
  updateReservaPrecios,
  upsertClienteByTelefono,
} from "@repo/db/queries";
import { addMoney, fromCents, toCents, type DiaSemana } from "@repo/shared";
import { z } from "zod";
import { HttpError } from "../middlewares/errorHandler";
import { arDayBounds, arLocalToUtc, formatHoraAr, todayArDate } from "./arTime";
import { registrarSenaSiCorresponde } from "./caja";
import { assertSalaDisponible } from "./disponibilidad";
import { enqueueReservaConfirmada } from "./notifications";

export { arDayBounds, todayArDate };

function toCoreRegla(
  row: Awaited<ReturnType<typeof listReglasPrecio>>[number],
): ReglaPrecio {
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
      (r) => r.active && r.scope === "sala" && r.scopeId === salaId,
    )
    .map(toCoreRegla);
  return [...deSala, baseRegla(precioHora)];
}

export async function listAgendaDia(tenantId: string, fecha?: string) {
  const day = fecha ?? todayArDate();
  const { start, end } = arDayBounds(day);
  const rows = await listReservasRango(getDb(), tenantId, start, end);
  const adicionales = await listReservasAdicionales(
    getDb(),
    tenantId,
    rows.map((r) => r.id),
  );
  const adicionalesPorReserva = new Map<string, typeof adicionales>();
  for (const adicional of adicionales) {
    const actuales = adicionalesPorReserva.get(adicional.reservaId) ?? [];
    actuales.push(adicional);
    adicionalesPorReserva.set(adicional.reservaId, actuales);
  }

  const reservasMapped = await Promise.all(
    rows.map(async (r) => {
      const total = Number(r.precioTotal);
      const cobrado = await sumCobradoReserva(getDb(), tenantId, r.id);
      const senaFlag = r.senaPagada ? Number(r.senaMonto) : 0;
      // cobrado de caja manda; fallback a flag de seña si aún no hay movimientos
      const pagado = cobrado > 0 ? cobrado : senaFlag;
      const saldo = Math.max(0, total - pagado);
      return {
        id: r.id,
        salaId: r.salaId,
        salaName: r.salaName,
        startsAt: formatHoraAr(r.startsAt),
        endsAt: formatHoraAr(r.endsAt),
        startsAtIso: r.startsAt.toISOString(),
        endsAtIso: r.endsAt.toISOString(),
        clienteNombre: r.clienteNombre ?? "Sin cliente",
        clienteTelefono: r.clienteTelefono ?? "—",
        clienteEmail: r.clienteEmail ?? null,
        precioTotal: total,
        precioSala: Number(r.precioSala),
        senaPagada: Math.min(pagado, total),
        saldo,
        estado: r.estado,
        origen: r.origen,
        holdExpiresAt: r.holdExpiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        adicionales: (adicionalesPorReserva.get(r.id) ?? []).map((a) => ({
          id: a.adicionalId,
          name: a.name,
          cantidad: a.cantidad,
          precioUnitario: Number(a.precioUnitario),
          modalidad: a.modalidad,
        })),
      };
    }),
  );

  return { fecha: day, reservas: reservasMapped };
}

export const createReservaPanelSchema = z.object({
  salaId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  clienteNombre: z.string().trim().min(2).max(120),
  clienteTelefono: z.string().trim().min(6).max(40),
  clienteEmail: z.string().trim().email().optional().nullable(),
  adicionales: z
    .array(
      z.object({
        id: z.string().uuid(),
        cantidad: z.number().int().positive().max(99),
      }),
    )
    .default([]),
  descuentoTipo: z.enum(["porcentaje", "fijo"]).optional(),
  descuentoValor: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  senaMonto: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"),
  senaPagada: z.boolean().default(false),
});

export async function createReservaPanel(
  tenantId: string,
  input: z.infer<typeof createReservaPanelSchema>,
) {
  const db = getDb();
  const bundle = await getNegocioBundle(db, tenantId);
  if (!bundle) throw new HttpError(404, "NOT_FOUND", "Negocio no encontrado");

  const sala = await getSalaById(db, tenantId, input.salaId);
  if (!sala) throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");

  const startsUtc = arLocalToUtc(input.fecha, input.horaInicio);
  const endsUtc = arLocalToUtc(input.fecha, input.horaFin);
  if (!(endsUtc > startsUtc)) {
    throw new HttpError(400, "INVALID_RANGE", "El fin debe ser después del inicio");
  }

  await assertSalaDisponible({
    tenantId,
    sedeId: bundle.sede.id,
    salaId: sala.id,
    startsAt: startsUtc,
    endsAt: endsUtc,
    sala: {
      duracionMinMinutos: sala.duracionMinMinutos,
      duracionMaxMinutos: sala.duracionMaxMinutos,
      granularidadMinutos: sala.granularidadMinutos,
    },
  });

  const rules = await reglasParaSala(
    tenantId,
    sala.id,
    String(sala.precioHora),
  );
  const granularityMinutes =
    sala.granularidadMinutos ??
    bundle.politica?.granularidadMinutos ??
    60;
  let precioSala: string;
  try {
    precioSala = calculateSalaPrice({
      rules,
      startsAt: startsUtc,
      endsAt: endsUtc,
      granularityMinutes,
    });
  } catch (err) {
    if (err instanceof PrecioNoDefinidoError) {
      throw new HttpError(400, "PRECIO_INDEFINIDO", err.message);
    }
    throw err;
  }

  let precioAdicionales = "0.00";
  const adicLines: Array<{
    adicionalId: string;
    cantidad: number;
    precioUnitario: string;
    modalidad: "por_hora" | "por_reserva";
  }> = [];

  if (input.adicionales.length > 0) {
    const ids = [...new Set(input.adicionales.map((a) => a.id))];
    const catalog = await listAdicionalesByIds(db, tenantId, ids);
    if (catalog.length !== ids.length) {
      throw new HttpError(
        400,
        "ADICIONAL_INVALID",
        "Uno o más adicionales no existen o están inactivos",
      );
    }
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const allRules = await listReglasPrecio(db, tenantId);
    for (const pedido of input.adicionales) {
      const c = byId.get(pedido.id)!;
      const adicRules = allRules
        .filter(
          (r) =>
            r.active && r.scope === "adicional" && r.scopeId === pedido.id,
        )
        .map(toCoreRegla);
      const lineTotal = calculateAdicionalPrice({
        precioBase: String(c.precioBase),
        modalidad: c.modalidad,
        cantidad: pedido.cantidad,
        rules: adicRules,
        startsAt: startsUtc,
        endsAt: endsUtc,
      });
      const hours =
        (endsUtc.getTime() - startsUtc.getTime()) / 3_600_000;
      const unit =
        c.modalidad === "por_hora"
          ? (Number(lineTotal) / (pedido.cantidad * (hours || 1))).toFixed(2)
          : (Number(lineTotal) / pedido.cantidad).toFixed(2);
      adicLines.push({
        adicionalId: pedido.id,
        cantidad: pedido.cantidad,
        precioUnitario: unit,
        modalidad: c.modalidad,
      });
      precioAdicionales = addMoney(precioAdicionales, lineTotal);
    }
  }

  const subtotal = addMoney(precioSala, precioAdicionales);
  let precioTotal = subtotal;
  if (input.descuentoTipo && input.descuentoValor) {
    const subtotalCents = toCents(subtotal);
    const valorCents = toCents(input.descuentoValor);
    const descuentoCents =
      input.descuentoTipo === "porcentaje"
        ? Math.min(
            subtotalCents,
            Math.round((subtotalCents * Number(input.descuentoValor)) / 100),
          )
        : Math.min(subtotalCents, valorCents);
    precioTotal = fromCents(Math.max(0, subtotalCents - descuentoCents));
  }

  const cliente = await upsertClienteByTelefono(db, tenantId, {
    telefono: input.clienteTelefono,
    nombre: input.clienteNombre,
    email: input.clienteEmail,
  });

  try {
    const [row] = await db
      .insert(reservas)
      .values({
        tenantId,
        sedeId: bundle.sede.id,
        salaId: input.salaId,
        clienteId: cliente.id,
        startsAt: startsUtc,
        endsAt: endsUtc,
        estado: "confirmada",
        origen: "panel",
        precioSala,
        precioAdicionales,
        precioTotal,
        senaMonto: input.senaMonto,
        senaPagada: input.senaPagada,
      })
      .returning();

    if (adicLines.length > 0) {
      await replaceReservaAdicionales(db, tenantId, row!.id, adicLines);
    }

    await registrarSenaSiCorresponde(
      tenantId,
      row!.id,
      input.senaMonto,
      input.senaPagada,
    );

    await enqueueReservaConfirmada({
      tenantId,
      reservaId: row!.id,
      email: cliente.email,
      clienteNombre: cliente.nombre,
      salaNombre: sala.name,
      sedeNombre: bundle.sede.name,
      startsAt: startsUtc,
      endsAt: endsUtc,
    });

    return row!;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("reservas_sala_no_overlap") || msg.includes("exclusion")) {
      throw new HttpError(409, "SLOT_OCUPADO", "Ese horario ya está ocupado");
    }
    throw err;
  }
}

export const updateReservaAdicionalesSchema = z.object({
  adicionales: z
    .array(
      z.object({
        id: z.string().uuid(),
        cantidad: z.number().int().positive().max(99),
      }),
    )
    .default([]),
});

const ESTADOS_EDITABLES_ADIC = new Set([
  "hold",
  "pendiente_aprobacion",
  "confirmada",
  "senada",
  "completada",
]);

export async function updateReservaAdicionalesPanel(
  tenantId: string,
  reservaId: string,
  input: z.infer<typeof updateReservaAdicionalesSchema>,
) {
  const db = getDb();
  const reserva = await getReservaById(db, tenantId, reservaId);
  if (!reserva) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");
  if (!ESTADOS_EDITABLES_ADIC.has(reserva.estado)) {
    throw new HttpError(
      400,
      "ESTADO_INVALIDO",
      "No se pueden editar adicionales en este estado",
    );
  }

  let precioAdicionales = "0.00";
  const adicLines: Array<{
    adicionalId: string;
    cantidad: number;
    precioUnitario: string;
    modalidad: "por_hora" | "por_reserva";
  }> = [];

  if (input.adicionales.length > 0) {
    const ids = [...new Set(input.adicionales.map((a) => a.id))];
    const catalog = await listAdicionalesByIds(db, tenantId, ids);
    if (catalog.length !== ids.length) {
      throw new HttpError(
        400,
        "ADICIONAL_INVALID",
        "Uno o más adicionales no existen o están inactivos",
      );
    }
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const allRules = await listReglasPrecio(db, tenantId);
    for (const pedido of input.adicionales) {
      const c = byId.get(pedido.id)!;
      const adicRules = allRules
        .filter(
          (r) =>
            r.active && r.scope === "adicional" && r.scopeId === pedido.id,
        )
        .map(toCoreRegla);
      const lineTotal = calculateAdicionalPrice({
        precioBase: String(c.precioBase),
        modalidad: c.modalidad,
        cantidad: pedido.cantidad,
        rules: adicRules,
        startsAt: reserva.startsAt,
        endsAt: reserva.endsAt,
      });
      const hours =
        (reserva.endsAt.getTime() - reserva.startsAt.getTime()) / 3_600_000;
      const unit =
        c.modalidad === "por_hora"
          ? (Number(lineTotal) / (pedido.cantidad * (hours || 1))).toFixed(2)
          : (Number(lineTotal) / pedido.cantidad).toFixed(2);
      adicLines.push({
        adicionalId: pedido.id,
        cantidad: pedido.cantidad,
        precioUnitario: unit,
        modalidad: c.modalidad,
      });
      precioAdicionales = addMoney(precioAdicionales, lineTotal);
    }
  }

  const precioSala = String(reserva.precioSala ?? "0");
  const precioTotal = addMoney(precioSala, precioAdicionales);

  await replaceReservaAdicionales(db, tenantId, reservaId, adicLines);
  const updated = await updateReservaPrecios(db, tenantId, reservaId, {
    precioAdicionales,
    precioTotal,
  });
  if (!updated) {
    throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");
  }

  const cobrado = await sumCobradoReserva(db, tenantId, reservaId);
  const senaFlag = updated.senaPagada ? Number(updated.senaMonto) : 0;
  const pagado = cobrado > 0 ? cobrado : senaFlag;
  const total = Number(precioTotal);

  return {
    id: updated.id,
    precioAdicionales: Number(precioAdicionales),
    precioTotal: total,
    senaPagada: Math.min(pagado, total),
    saldo: Math.max(0, total - pagado),
  };
}

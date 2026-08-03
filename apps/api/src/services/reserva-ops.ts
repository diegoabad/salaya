import {
  CancelacionNoPermitidaError,
  AsistenciaInvalidaError,
  calculateAdicionalPrice,
  calculateSalaPrice,
  evaluarCancelacion,
  puedeReprogramar,
  PrecioNoDefinidoError,
  resolverCierreAsistencia,
  type ReglaPrecio,
} from "@repo/core";
import { getDb } from "@repo/db";
import {
  addClienteCredito,
  getNegocioBundle,
  getReservaById,
  getReservaPublicaById,
  getSalaById,
  incrementClienteNoShow,
  insertMovimiento,
  listAdicionalesByIds,
  listReglasPrecio,
  listReservasAdicionales,
  replaceReservaAdicionales,
  sumCobradoReserva,
  updateReservaEstado,
  updateReservaHorario,
  updateReservaPrecios,
} from "@repo/db/queries";
import type {
  AsistenciaInput,
  CancelarReservaInput,
  CobrarSaldoInput,
  DiaSemana,
  ReprogramarReservaInput,
  ReservaEstado,
  SenaDestinoCancelacion,
} from "@repo/shared";
import {
  addMoney,
  POLITICA_DEFAULTS,
  SALAYA_CANCEL_DISCLAIMER,
  textoDestinoSenaCancelacion,
  textoPoliticaCancelacion,
} from "@repo/shared";
import { HttpError } from "../middlewares/errorHandler";
import { cancelUrlForReserva, parseCancelToken } from "../crypto/cancelToken";
import { arLocalToUtc, fechaArFromUtc, formatHoraAr } from "./arTime";
import { assertSalaDisponible } from "./disponibilidad";
import { enqueueNotification } from "./notifications";

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

async function saldoPendiente(
  tenantId: string,
  reservaId: string,
  precioTotal: string | number,
) {
  const cobrado = await sumCobradoReserva(getDb(), tenantId, reservaId);
  return Math.max(0, Number(precioTotal) - cobrado);
}

function politicaCancelFromBundle(
  bundle: Awaited<ReturnType<typeof getNegocioBundle>>,
) {
  return {
    cancelacionVentanaHoras:
      bundle?.politica?.cancelacionVentanaHoras ??
      POLITICA_DEFAULTS.cancelacionVentanaHoras,
    senaDestinoCancelacion: (bundle?.politica?.senaDestinoCancelacion ??
      POLITICA_DEFAULTS.senaDestinoCancelacion) as SenaDestinoCancelacion,
    permiteReprogramar:
      bundle?.politica?.permiteReprogramar ??
      POLITICA_DEFAULTS.permiteReprogramar,
  };
}

async function aplicarCancelacion(input: {
  tenantId: string;
  reservaId: string;
  esDueno: boolean;
  canceladoPor: "dueno" | "cliente" | "sistema";
  motivo?: string | null;
}) {
  const db = getDb();
  const row = await getReservaById(db, input.tenantId, input.reservaId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");

  const cancelables: ReservaEstado[] = [
    "hold",
    "pendiente_aprobacion",
    "confirmada",
    "senada",
  ];
  if (!cancelables.includes(row.estado as ReservaEstado)) {
    throw new HttpError(
      400,
      "CANCEL_INVALIDA",
      `No se puede cancelar desde estado ${row.estado}`,
    );
  }

  const bundle = await getNegocioBundle(db, input.tenantId);
  const politica = politicaCancelFromBundle(bundle);

  let eval_: ReturnType<typeof evaluarCancelacion>;
  try {
    eval_ = evaluarCancelacion({
      startsAt: row.startsAt,
      now: new Date(),
      esDueno: input.esDueno,
      senaPagada: row.senaPagada,
      politica,
    });
  } catch (err) {
    if (err instanceof CancelacionNoPermitidaError) {
      throw new HttpError(400, err.code, err.message);
    }
    throw err;
  }

  await updateReservaEstado(db, input.tenantId, input.reservaId, {
    estado: "cancelada",
    canceladoPor: input.canceladoPor,
    canceladoAt: new Date(),
    cancelMotivo: input.motivo ?? null,
  });

  let creditoAplicado = 0;
  const senaMonto = row.senaPagada ? Number(row.senaMonto) : 0;

  if (eval_.destinoSena === "credito" && senaMonto > 0 && row.clienteId) {
    await addClienteCredito(
      db,
      input.tenantId,
      row.clienteId,
      senaMonto.toFixed(2),
    );
    creditoAplicado = senaMonto;
  } else if (eval_.destinoSena === "devolver" && senaMonto > 0) {
    await insertMovimiento(db, input.tenantId, {
      tipo: "reembolso",
      medioPago: "efectivo",
      monto: senaMonto.toFixed(2),
      reservaId: input.reservaId,
      descripcion: input.esDueno
        ? "Reembolso seña por cancelación (dueño)"
        : "Reembolso seña por cancelación (cliente)",
    });
  }

  if (row.clienteEmail) {
    await enqueueNotification({
      tenantId: input.tenantId,
      eventType: "reserva.cancelada",
      payload: {
        reservaId: input.reservaId,
        email: row.clienteEmail,
        clienteNombre: row.clienteNombre,
        destinoSena: eval_.destinoSena,
        motivo: input.motivo ?? null,
      },
    });
  }

  return {
    id: input.reservaId,
    estado: "cancelada" as const,
    destinoSena: eval_.destinoSena,
    creditoAplicado,
    politica,
  };
}

export async function cerrarAsistencia(
  tenantId: string,
  reservaId: string,
  input: AsistenciaInput,
) {
  const row = await getReservaById(getDb(), tenantId, reservaId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");

  try {
    const result = resolverCierreAsistencia({
      estadoActual: row.estado as ReservaEstado,
      endsAt: row.endsAt,
      now: new Date(),
      asistio: input.asistio,
    });

    await updateReservaEstado(getDb(), tenantId, reservaId, {
      estado: result.nuevoEstado,
    });

    if (result.incrementarNoShow && row.clienteId) {
      await incrementClienteNoShow(getDb(), tenantId, row.clienteId);
    }

    return {
      id: reservaId,
      estado: result.nuevoEstado,
      incrementarNoShow: result.incrementarNoShow,
    };
  } catch (err) {
    if (err instanceof AsistenciaInvalidaError) {
      throw new HttpError(400, err.code, err.message);
    }
    throw err;
  }
}

export async function cobrarSaldoReserva(
  tenantId: string,
  reservaId: string,
  input: CobrarSaldoInput,
) {
  const row = await getReservaById(getDb(), tenantId, reservaId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");

  if (
    row.estado !== "completada" &&
    row.estado !== "senada" &&
    row.estado !== "confirmada"
  ) {
    throw new HttpError(
      400,
      "COBRO_INVALIDO",
      `No se puede cobrar saldo en estado ${row.estado}`,
    );
  }

  const pendiente = await saldoPendiente(tenantId, reservaId, row.precioTotal);
  if (pendiente <= 0) {
    throw new HttpError(400, "SIN_SALDO", "No hay saldo pendiente");
  }

  const monto = input.monto ? Number(input.monto) : pendiente;
  if (!(monto > 0) || monto > pendiente + 0.001) {
    throw new HttpError(400, "MONTO_INVALIDO", "Monto de cobro inválido");
  }

  const mov = await insertMovimiento(getDb(), tenantId, {
    tipo: "saldo",
    medioPago: input.medioPago,
    monto: monto.toFixed(2),
    reservaId,
    descripcion: input.descripcion ?? "Cobro de saldo (panel)",
  });

  const nuevoSaldo = await saldoPendiente(tenantId, reservaId, row.precioTotal);

  return {
    movimientoId: mov.id,
    cobrado: Number(mov.monto),
    saldoPendiente: nuevoSaldo,
  };
}

export async function cancelarReservaPanel(
  tenantId: string,
  reservaId: string,
  input: CancelarReservaInput,
) {
  return aplicarCancelacion({
    tenantId,
    reservaId,
    esDueno: true,
    canceladoPor: "dueno",
    motivo: input.motivo,
  });
}

async function aplicarReprogramacion(input: {
  tenantId: string;
  reservaId: string;
  esDueno: boolean;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}) {
  const db = getDb();
  const row = await getReservaById(db, input.tenantId, input.reservaId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");

  const activos: ReservaEstado[] = [
    "hold",
    "pendiente_aprobacion",
    "confirmada",
    "senada",
  ];
  if (input.esDueno) activos.push("completada");
  if (!activos.includes(row.estado as ReservaEstado)) {
    throw new HttpError(
      400,
      "REPROGRAMAR_INVALIDA",
      `No se puede reprogramar desde estado ${row.estado}`,
    );
  }

  const bundle = await getNegocioBundle(db, input.tenantId);
  const politica = politicaCancelFromBundle(bundle);
  if (!puedeReprogramar(politica, input.esDueno)) {
    throw new HttpError(
      400,
      "REPROGRAMAR_NO_PERMITIDA",
      "La política del estudio no permite reprogramar",
    );
  }

  const startsUtc = arLocalToUtc(input.fecha, input.horaInicio);
  let endsUtc = arLocalToUtc(input.fecha, input.horaFin);
  // Turnos que cruzan medianoche: fin al día siguiente
  if (!(endsUtc > startsUtc)) {
    const [y, m, d] = input.fecha.split("-").map(Number);
    const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
    const nextFecha = next.toISOString().slice(0, 10);
    endsUtc = arLocalToUtc(nextFecha, input.horaFin);
  }
  if (!(endsUtc > startsUtc)) {
    throw new HttpError(400, "INVALID_RANGE", "El fin debe ser después del inicio");
  }

  const sala = await getSalaById(db, input.tenantId, row.salaId);
  if (!sala) throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");

  await assertSalaDisponible({
    tenantId: input.tenantId,
    sedeId: row.sedeId,
    salaId: row.salaId,
    startsAt: startsUtc,
    endsAt: endsUtc,
    excludeReservaId: input.reservaId,
    sala: {
      duracionMinMinutos: sala.duracionMinMinutos,
      duracionMaxMinutos: sala.duracionMaxMinutos,
      granularidadMinutos: sala.granularidadMinutos,
    },
  });

  const allRules = await listReglasPrecio(db, input.tenantId);
  const salaRules: ReglaPrecio[] = [
    ...allRules
      .filter(
        (r) =>
          r.active && r.scope === "sala" && r.scopeId === row.salaId,
      )
      .map(toCoreRegla),
    baseRegla(String(sala.precioHora)),
  ];

  let precioSala: string;
  try {
    precioSala = calculateSalaPrice({
      rules: salaRules,
      startsAt: startsUtc,
      endsAt: endsUtc,
    });
  } catch (err) {
    if (err instanceof PrecioNoDefinidoError) {
      throw new HttpError(400, "PRECIO_INDEFINIDO", err.message);
    }
    throw err;
  }

  const adicRows = await listReservasAdicionales(db, input.tenantId, [
    input.reservaId,
  ]);
  let precioAdicionales = "0.00";
  const adicLines: Array<{
    adicionalId: string;
    cantidad: number;
    precioUnitario: string;
    modalidad: "por_hora" | "por_reserva";
  }> = [];

  if (adicRows.length > 0) {
    const ids = [...new Set(adicRows.map((a) => a.adicionalId))];
    const catalog = await listAdicionalesByIds(db, input.tenantId, ids);
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const hours =
      (endsUtc.getTime() - startsUtc.getTime()) / 3_600_000;

    for (const line of adicRows) {
      const c = byId.get(line.adicionalId);
      if (!c) continue;
      const adicRules = allRules
        .filter(
          (r) =>
            r.active &&
            r.scope === "adicional" &&
            r.scopeId === line.adicionalId,
        )
        .map(toCoreRegla);
      const lineTotal = calculateAdicionalPrice({
        precioBase: String(c.precioBase),
        modalidad: c.modalidad,
        cantidad: line.cantidad,
        rules: adicRules,
        startsAt: startsUtc,
        endsAt: endsUtc,
      });
      const unit =
        c.modalidad === "por_hora"
          ? (Number(lineTotal) / (line.cantidad * (hours || 1))).toFixed(2)
          : (Number(lineTotal) / line.cantidad).toFixed(2);
      adicLines.push({
        adicionalId: line.adicionalId,
        cantidad: line.cantidad,
        precioUnitario: unit,
        modalidad: c.modalidad,
      });
      precioAdicionales = addMoney(precioAdicionales, lineTotal);
    }
  }

  const precioTotal = addMoney(precioSala, precioAdicionales);

  try {
    const updated = await updateReservaHorario(
      db,
      input.tenantId,
      input.reservaId,
      {
        startsAt: startsUtc,
        endsAt: endsUtc,
      },
    );
    if (!updated) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");

    if (adicLines.length > 0) {
      await replaceReservaAdicionales(
        db,
        input.tenantId,
        input.reservaId,
        adicLines,
      );
    }

    await updateReservaPrecios(db, input.tenantId, input.reservaId, {
      precioSala,
      precioAdicionales,
      precioTotal,
    });

    const cobrado = await sumCobradoReserva(db, input.tenantId, input.reservaId);
    const senaFlag = row.senaPagada ? Number(row.senaMonto) : 0;
    const pagado = cobrado > 0 ? cobrado : senaFlag;
    const total = Number(precioTotal);

    return {
      id: input.reservaId,
      startsAt: startsUtc.toISOString(),
      endsAt: endsUtc.toISOString(),
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      senaPagada: row.senaPagada,
      senaMonto: Number(row.senaMonto),
      estado: row.estado,
      precioSala: Number(precioSala),
      precioAdicionales: Number(precioAdicionales),
      precioTotal: total,
      saldo: Math.max(0, total - pagado),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("reservas_sala_no_overlap") || msg.includes("exclusion")) {
      throw new HttpError(409, "SLOT_OCUPADO", "Ese horario ya está ocupado");
    }
    throw err;
  }
}

export async function reprogramarReservaPanel(
  tenantId: string,
  reservaId: string,
  input: ReprogramarReservaInput,
) {
  return aplicarReprogramacion({
    tenantId,
    reservaId,
    esDueno: true,
    fecha: input.fecha,
    horaInicio: input.horaInicio,
    horaFin: input.horaFin,
  });
}

export async function previewReprogramacionPublica(token: string) {
  const reservaId = parseCancelToken(token);
  if (!reservaId) {
    throw new HttpError(400, "TOKEN_INVALIDO", "Link de reprogramación inválido");
  }

  const db = getDb();
  const row = await getReservaPublicaById(db, reservaId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");

  const bundle = await getNegocioBundle(db, row.tenantId);
  const politica = politicaCancelFromBundle(bundle);
  const activos: ReservaEstado[] = [
    "hold",
    "pendiente_aprobacion",
    "confirmada",
    "senada",
  ];
  const estadoOk = activos.includes(row.estado as ReservaEstado);
  const permitida = estadoOk && puedeReprogramar(politica, false);

  return {
    permitida,
    error: !estadoOk
      ? `Esta reserva ya no se puede reprogramar (estado: ${row.estado})`
      : !politica.permiteReprogramar
        ? "El estudio no permite reprogramar online"
        : null,
    reserva: {
      ...serializePublicCancel(row, bundle?.tenant.name ?? null),
      salaId: row.salaId,
    },
    politica: {
      permiteReprogramar: politica.permiteReprogramar,
    },
  };
}

export async function confirmarReprogramacionPublica(
  token: string,
  input: ReprogramarReservaInput,
) {
  const preview = await previewReprogramacionPublica(token);
  if (!preview.permitida) {
    throw new HttpError(
      400,
      "REPROGRAMAR_NO_PERMITIDA",
      preview.error ?? "No se puede reprogramar",
    );
  }

  return aplicarReprogramacion({
    tenantId: preview.reserva.tenantId,
    reservaId: preview.reserva.id,
    esDueno: false,
    fecha: input.fecha,
    horaInicio: input.horaInicio,
    horaFin: input.horaFin,
  });
}

export async function previewCancelacionPublica(token: string) {
  const reservaId = parseCancelToken(token);
  if (!reservaId) {
    throw new HttpError(400, "TOKEN_INVALIDO", "Link de cancelación inválido");
  }

  const db = getDb();
  const row = await getReservaPublicaById(db, reservaId);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Reserva no encontrada");

  const bundle = await getNegocioBundle(db, row.tenantId);
  const politica = politicaCancelFromBundle(bundle);

  if (row.estado === "cancelada") {
    return {
      alreadyCancelled: true as const,
      permitida: false,
      reserva: serializePublicCancel(row, bundle?.tenant.name ?? null),
      politica,
      politicaTexto: textoPoliticaCancelacion(politica),
      destinoSena: "n/a" as const,
      destinoTexto: textoDestinoSenaCancelacion("n/a"),
      disclaimer: SALAYA_CANCEL_DISCLAIMER,
    };
  }

  const cancelables: ReservaEstado[] = [
    "hold",
    "pendiente_aprobacion",
    "confirmada",
    "senada",
  ];
  if (!cancelables.includes(row.estado as ReservaEstado)) {
    throw new HttpError(
      400,
      "CANCEL_INVALIDA",
      `Esta reserva ya no se puede cancelar (estado: ${row.estado})`,
    );
  }

  let permitida = true;
  let destinoSena: ReturnType<typeof evaluarCancelacion>["destinoSena"] = "n/a";
  let error: string | null = null;
  try {
    const eval_ = evaluarCancelacion({
      startsAt: row.startsAt,
      now: new Date(),
      esDueno: false,
      senaPagada: row.senaPagada,
      politica,
    });
    destinoSena = eval_.destinoSena;
  } catch (err) {
    permitida = false;
    if (err instanceof CancelacionNoPermitidaError) {
      error = err.message;
    } else {
      throw err;
    }
  }

  return {
    alreadyCancelled: false as const,
    permitida,
    error,
    reserva: serializePublicCancel(row, bundle?.tenant.name ?? null),
    politica,
    politicaTexto: textoPoliticaCancelacion({
      ...politica,
      requiereSena: row.senaPagada || Number(row.senaMonto) > 0,
    }),
    destinoSena,
    destinoTexto: textoDestinoSenaCancelacion(destinoSena),
    disclaimer: SALAYA_CANCEL_DISCLAIMER,
  };
}

export async function confirmarCancelacionPublica(token: string) {
  const preview = await previewCancelacionPublica(token);
  if (preview.alreadyCancelled) {
    return {
      id: preview.reserva.id,
      estado: "cancelada" as const,
      destinoSena: "n/a" as const,
      creditoAplicado: 0,
      alreadyCancelled: true as const,
    };
  }
  if (!preview.permitida) {
    throw new HttpError(
      400,
      "CANCELACION_NO_PERMITIDA",
      preview.error ?? "No se puede cancelar",
    );
  }

  const result = await aplicarCancelacion({
    tenantId: preview.reserva.tenantId,
    reservaId: preview.reserva.id,
    esDueno: false,
    canceladoPor: "cliente",
    motivo: "Cancelación online (link email)",
  });

  return { ...result, alreadyCancelled: false as const };
}

function serializePublicCancel(
  row: NonNullable<Awaited<ReturnType<typeof getReservaPublicaById>>>,
  estudioNombre: string | null,
) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    codigo: `SY-${row.id.slice(0, 8).toUpperCase()}`,
    salaNombre: row.salaName,
    estudioNombre,
    fecha: fechaArFromUtc(row.startsAt),
    horaInicio: formatHoraAr(row.startsAt),
    horaFin: formatHoraAr(row.endsAt),
    estado: row.estado,
    senaPagada: row.senaPagada,
    senaMonto: Number(row.senaMonto),
    precioTotal: Number(row.precioTotal),
  };
}

export { saldoPendiente, cancelUrlForReserva };

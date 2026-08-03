/** Día de semana alineado a Date#getUTCDay / getDay: 0 = domingo … 6 = sábado */
export const DIAS_SEMANA = [0, 1, 2, 3, 4, 5, 6] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const USER_TENANT_ROLES = ["owner", "employee"] as const;
export type UserTenantRole = (typeof USER_TENANT_ROLES)[number];

export const RESERVA_ESTADOS = [
  "hold",
  "pendiente_aprobacion",
  "confirmada",
  "senada",
  "completada",
  "cancelada",
  "vencida",
  "ausente",
] as const;
export type ReservaEstado = (typeof RESERVA_ESTADOS)[number];

/** Estados que ocupan el slot (exclusion constraint + disponibilidad) */
export const RESERVA_ESTADOS_ACTIVOS = [
  "hold",
  "pendiente_aprobacion",
  "confirmada",
  "senada",
] as const satisfies readonly ReservaEstado[];

export const RESERVA_ORIGENES = ["publico", "panel", "whatsapp"] as const;
export type ReservaOrigen = (typeof RESERVA_ORIGENES)[number];

export const SENA_MODOS = ["nunca", "siempre", "reincidentes"] as const;
export type SenaModo = (typeof SENA_MODOS)[number];

export const SENA_TIPOS = ["porcentaje", "fijo"] as const;
export type SenaTipo = (typeof SENA_TIPOS)[number];

export const SENA_DESTINOS_CANCELACION = ["devolver", "credito", "perder"] as const;
export type SenaDestinoCancelacion = (typeof SENA_DESTINOS_CANCELACION)[number];

export const ADICIONAL_MODALIDADES = ["por_hora", "por_reserva"] as const;
export type AdicionalModalidad = (typeof ADICIONAL_MODALIDADES)[number];

export const REGLA_PRECIO_SCOPES = ["sala", "adicional"] as const;
export type ReglaPrecioScope = (typeof REGLA_PRECIO_SCOPES)[number];

/**
 * Descuentos / tarifas especiales del dueño:
 * - continuo: se repite (ej. happy hour lun–vie 14–17)
 * - puntual: relámpago / vigencia acotada a fechas concretas
 */
export const DESCUENTO_TIPOS = ["continuo", "puntual"] as const;
export type DescuentoTipo = (typeof DESCUENTO_TIPOS)[number];

export const MOVIMIENTO_TIPOS = [
  "sena",
  "saldo",
  "reembolso",
  "ajuste",
  "egreso",
  "inicio_caja",
  "cierre_caja",
  "credito",
  "membresia",
] as const;
export type MovimientoTipo = (typeof MOVIMIENTO_TIPOS)[number];

export const MEMBRESIA_ESTADOS = ["activa", "pausada", "cancelada"] as const;
export type MembresiaEstado = (typeof MEMBRESIA_ESTADOS)[number];

export const MOVIMIENTO_ESTADOS = ["pendiente", "cobrado", "anulado"] as const;
export type MovimientoEstado = (typeof MOVIMIENTO_ESTADOS)[number];

export const MEDIOS_PAGO = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta",
] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const CANCELADO_POR = ["cliente", "dueno", "sistema"] as const;
export type CanceladoPor = (typeof CANCELADO_POR)[number];

export const PAGO_ESTADOS = [
  "pendiente",
  "aprobado",
  "rechazado",
  "vencido",
  "cancelado",
] as const;
export type PagoEstado = (typeof PAGO_ESTADOS)[number];

export const DIRECTORIO_PLANES = ["seed", "cliente", "destacado"] as const;
export type DirectorioPlan = (typeof DIRECTORIO_PLANES)[number];

/** Pedidos de dueños para reclamar ficha seed del directorio */
export const DIRECTORIO_RECLAMACION_ESTADOS = [
  "pendiente",
  "contactado",
  "convertido",
  "rechazado",
] as const;
export type DirectorioReclamacionEstado =
  (typeof DIRECTORIO_RECLAMACION_ESTADOS)[number];

/** Categorías de sala en el detalle del estudio (editables como texto libre en DB) */
export const SALA_CATEGORIAS = [
  "Música",
  "Danza",
  "Teatro",
  "Multiuso",
] as const;
export type SalaCategoria = (typeof SALA_CATEGORIAS)[number];

export const NOTIFICATION_CHANNELS = ["email", "whatsapp"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["pending", "sent", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const DOMAIN_EVENTS = [
  "reserva.creada",
  "reserva.confirmada",
  "sena.pagada",
  "reserva.cancelada",
  "reserva.recordatorio",
  "reserva.vencida",
] as const;
export type DomainEvent = (typeof DOMAIN_EVENTS)[number];

/** Defaults de políticas al crear una sede */
export const POLITICA_DEFAULTS = {
  senaModo: "nunca" as SenaModo,
  senaTipo: "porcentaje" as SenaTipo,
  senaValor: "30",
  holdMinutos: 5,
  cancelacionVentanaHoras: 24,
  senaDestinoCancelacion: "perder" as SenaDestinoCancelacion,
  permiteReprogramar: true,
  duracionMinMinutos: 60,
  duracionMaxMinutos: 240,
  granularidadMinutos: 60,
  requiereAprobacionSinSena: false,
} as const;

/** Copy legal / UX — política la define el estudio, no SalaYa */
export const SALAYA_CANCEL_DISCLAIMER =
  "La política de cancelación y el destino de la seña los define el estudio. SalaYa no gestiona reembolsos ni se hace responsable de disputas entre el músico y la sala.";

export function textoDestinoSenaCancelacion(
  destino: SenaDestinoCancelacion | "n/a",
): string {
  switch (destino) {
    case "devolver":
      return "el estudio debe devolverte la seña";
    case "credito":
      return "la seña queda como crédito a favor en ese estudio";
    case "perder":
      return "la seña no se devuelve";
    default:
      return "no hay seña a devolver";
  }
}

export function textoPoliticaCancelacion(input: {
  cancelacionVentanaHoras: number;
  senaDestinoCancelacion: SenaDestinoCancelacion;
  requiereSena?: boolean;
}): string {
  const ventana = input.cancelacionVentanaHoras;
  const destino = textoDestinoSenaCancelacion(input.senaDestinoCancelacion);
  if (input.requiereSena === false) {
    return `Podés cancelar hasta ${ventana} h antes del turno.`;
  }
  return `Podés cancelar hasta ${ventana} h antes del turno. Si cancelás a tiempo, ${destino}. Fuera de esa ventana no se puede cancelar online.`;
}

/**
 * Suscripción del dueño a SalaYa (estilo Wally).
 * Precios/códigos extensibles — no hardcodear en UI.
 * Cobro de plataforma ≠ seña marketplace del músico.
 */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "expired",
  "canceled",
  "exempt",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Planes de producto; sumar filas acá / en DB sin romper enums de directorio */
export const PLATFORM_PLAN_CODES = [
  "starter",
  "pro",
  "destacado",
] as const;
export type PlatformPlanCode = (typeof PLATFORM_PLAN_CODES)[number];

/** Catálogo editable; valores ARS mensuales. Sumar códigos en PLATFORM_PLAN_CODES. */
export const PLATFORM_PLANS: Record<
  PlatformPlanCode,
  {
    name: string;
    priceArs: number;
    directorioPlan: DirectorioPlan;
    /** Días de vigencia por cobro (mensual = 30) */
    periodDays: number;
  }
> = {
  starter: {
    name: "Starter",
    priceArs: 0,
    directorioPlan: "cliente",
    periodDays: 30,
  },
  pro: {
    name: "Pro",
    priceArs: 19999,
    directorioPlan: "cliente",
    periodDays: 30,
  },
  destacado: {
    name: "Destacado",
    priceArs: 34999,
    directorioPlan: "destacado",
    periodDays: 30,
  },
};

/** Trial al crear el negocio (antes del primer cobro) */
export const SUBSCRIPTION_TRIAL_DAYS = 14;

export function listPlatformPlans() {
  return PLATFORM_PLAN_CODES.map((code) => ({
    code,
    ...PLATFORM_PLANS[code],
  }));
}

export function getPlatformPlan(code: string) {
  if (!(code in PLATFORM_PLANS)) return null;
  const c = code as PlatformPlanCode;
  return { code: c, ...PLATFORM_PLANS[c] };
}

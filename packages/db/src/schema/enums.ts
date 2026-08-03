import {
  ADICIONAL_MODALIDADES,
  CANCELADO_POR,
  DIRECTORIO_PLANES,
  DIRECTORIO_RECLAMACION_ESTADOS,
  MEDIOS_PAGO,
  MOVIMIENTO_ESTADOS,
  MOVIMIENTO_TIPOS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  PAGO_ESTADOS,
  MEMBRESIA_ESTADOS,
  REGLA_PRECIO_SCOPES,
  DESCUENTO_TIPOS,
  RESERVA_ESTADOS,
  RESERVA_ORIGENES,
  SENA_DESTINOS_CANCELACION,
  SENA_MODOS,
  SENA_TIPOS,
  SUBSCRIPTION_STATUSES,
  USER_TENANT_ROLES,
} from "@repo/shared";
import { pgEnum } from "drizzle-orm/pg-core";

export const userTenantRoleEnum = pgEnum("user_tenant_role", USER_TENANT_ROLES);
export const subscriptionStatusEnum = pgEnum(
  "subscription_status",
  SUBSCRIPTION_STATUSES,
);
export const reservaEstadoEnum = pgEnum("reserva_estado", RESERVA_ESTADOS);
export const reservaOrigenEnum = pgEnum("reserva_origen", RESERVA_ORIGENES);
export const senaModoEnum = pgEnum("sena_modo", SENA_MODOS);
export const senaTipoEnum = pgEnum("sena_tipo", SENA_TIPOS);
export const senaDestinoCancelacionEnum = pgEnum(
  "sena_destino_cancelacion",
  SENA_DESTINOS_CANCELACION,
);
export const adicionalModalidadEnum = pgEnum(
  "adicional_modalidad",
  ADICIONAL_MODALIDADES,
);
export const reglaPrecioScopeEnum = pgEnum(
  "regla_precio_scope",
  REGLA_PRECIO_SCOPES,
);
export const descuentoTipoEnum = pgEnum("descuento_tipo", DESCUENTO_TIPOS);
export const movimientoTipoEnum = pgEnum("movimiento_tipo", MOVIMIENTO_TIPOS);
export const movimientoEstadoEnum = pgEnum(
  "movimiento_estado",
  MOVIMIENTO_ESTADOS,
);
export const membresiaEstadoEnum = pgEnum("membresia_estado", MEMBRESIA_ESTADOS);
export const medioPagoEnum = pgEnum("medio_pago", MEDIOS_PAGO);
export const canceladoPorEnum = pgEnum("cancelado_por", CANCELADO_POR);
export const pagoEstadoEnum = pgEnum("pago_estado", PAGO_ESTADOS);
export const directorioPlanEnum = pgEnum("directorio_plan", DIRECTORIO_PLANES);
export const directorioReclamacionEstadoEnum = pgEnum(
  "directorio_reclamacion_estado",
  DIRECTORIO_RECLAMACION_ESTADOS,
);
export const notificationChannelEnum = pgEnum(
  "notification_channel",
  NOTIFICATION_CHANNELS,
);
export const notificationStatusEnum = pgEnum(
  "notification_status",
  NOTIFICATION_STATUSES,
);

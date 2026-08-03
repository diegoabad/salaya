import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  adicionalModalidadEnum,
  canceladoPorEnum,
  descuentoTipoEnum,
  directorioPlanEnum,
  directorioReclamacionEstadoEnum,
  subscriptionStatusEnum,
  medioPagoEnum,
  membresiaEstadoEnum,
  movimientoEstadoEnum,
  movimientoTipoEnum,
  notificationChannelEnum,
  notificationStatusEnum,
  pagoEstadoEnum,
  reglaPrecioScopeEnum,
  reservaEstadoEnum,
  reservaOrigenEnum,
  senaDestinoCancelacionEnum,
  senaModoEnum,
  senaTipoEnum,
  userTenantRoleEnum,
} from "./enums";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ─── Auth / tenancy ───────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  /** null si el usuario solo entra con Google */
  passwordHash: text("password_hash"),
  name: text("name").notNull().default(""),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  ...timestamps,
}, (t) => [
  uniqueIndex("users_email_uidx").on(t.email),
]);

/** Cuentas OAuth (Auth.js / Google). Mismo email → mismo userId. */
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [
  uniqueIndex("accounts_provider_uidx").on(t.provider, t.providerAccountId),
  index("accounts_user_idx").on(t.userId),
]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("sessions_user_idx").on(t.userId),
  index("sessions_expires_idx").on(t.expiresAt),
]);

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.identifier, t.token] }),
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  /** URL pública; una vez creado no se cambia en la app */
  slug: text("slug").notNull(),
  instagramUrl: text("instagram_url"),
  websiteUrl: text("website_url"),
  whatsapp: text("whatsapp"),
  youtubeUrl: text("youtube_url"),
  tiktokUrl: text("tiktok_url"),
  /** Links libres: [{ label, url }] */
  linksExtra: jsonb("links_extra")
    .$type<Array<{ label: string; url: string }>>()
    .notNull()
    .default([]),
  comoLlegar: text("como_llegar"),
  /** Suscripción a SalaYa (plataforma ≠ seña marketplace) */
  subscriptionStatus: subscriptionStatusEnum("subscription_status")
    .notNull()
    .default("trialing"),
  /** Código de PLATFORM_PLAN_CODES (texto para poder extender sin migración enum) */
  subscriptionPlanCode: text("subscription_plan_code").notNull().default("starter"),
  subscriptionPeriodEnd: timestamp("subscription_period_end", {
    withTimezone: true,
  }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("tenants_slug_uidx").on(t.slug),
]);

export const userTenants = pgTable("user_tenants", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  role: userTenantRoleEnum("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.tenantId] }),
  index("user_tenants_tenant_idx").on(t.tenantId),
]);

/** Invitaciones a colaboradores (solo el owner las crea desde el panel). */
export const tenantInvites = pgTable("tenant_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: userTenantRoleEnum("role").notNull().default("employee"),
  token: text("token").notNull(),
  invitedByUserId: uuid("invited_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("tenant_invites_token_uidx").on(t.token),
  index("tenant_invites_tenant_idx").on(t.tenantId),
  index("tenant_invites_email_idx").on(t.email),
]);

// ─── Sedes / salas ────────────────────────────────────────────────────────────

export const sedes = pgTable("sedes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  zona: text("zona"),
  description: text("description"),
  /** Portada / primera de la galería (compat + directorio) */
  photoUrl: text("photo_url"),
  /** Galería del estudio en la ficha pública (máx. ~12) */
  photos: text("photos").array().notNull().default([]),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  /** Amenities del local (WiFi, Estacionamiento, etc.) — editables en panel */
  amenidades: text("amenidades").array().notNull().default([]),
  timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (t) => [
  index("sedes_tenant_idx").on(t.tenantId),
]);

export const salas = pgTable("salas", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sedeId: uuid("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** URL dentro del tenant: /{estudio}/{slug} */
  slug: text("slug"),
  description: text("description"),
  /** Música | Danza | Teatro | Multiuso — filtro del detalle */
  categoria: text("categoria").notNull().default("Música"),
  /** Tags/géneros visibles en la card (Rock, Metal, Producción…) */
  tags: text("tags").array().notNull().default([]),
  capacity: integer("capacity"),
  /** Medidas en metros (editables) */
  anchoMetros: numeric("ancho_metros", { precision: 5, scale: 2 }),
  largoMetros: numeric("largo_metros", { precision: 5, scale: 2 }),
  /** Precio base/hora mostrado en directorio; reglas de precio pueden override */
  precioHora: numeric("precio_hora", { precision: 12, scale: 2 }),
  /** Texto corto para la card de specs (ej. Profesional) */
  acustica: text("acustica"),
  equipamiento: text("equipamiento").array().notNull().default([]),
  /** Lo que el músico debe traer */
  noIncluido: text("no_incluido").array().notNull().default([]),
  /** Chips destacados de la card (Batería Mapex, Marshall 100W…) */
  caracteristicas: text("caracteristicas").array().notNull().default([]),
  photos: text("photos").array().notNull().default([]),
  popular: boolean("popular").notNull().default(false),
  nueva: boolean("nueva").notNull().default(false),
  ratingAvg: numeric("rating_avg", { precision: 2, scale: 1 }),
  ratingCount: integer("rating_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  /** null = hereda política de la sede */
  duracionMinMinutos: integer("duracion_min_minutos"),
  duracionMaxMinutos: integer("duracion_max_minutos"),
  granularidadMinutos: integer("granularidad_minutos"),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index("salas_tenant_sede_idx").on(t.tenantId, t.sedeId),
  uniqueIndex("salas_tenant_slug_uidx").on(t.tenantId, t.slug),
]);

/** Horario de atención semanal: 0=domingo … 6=sábado (Date#getDay) */
export const horariosAtencion = pgTable("horarios_atencion", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sedeId: uuid("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  dayOfWeek: smallint("day_of_week").notNull(),
  /** HH:MM en hora local de la sede */
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
}, (t) => [
  index("horarios_tenant_sede_dow_idx").on(t.tenantId, t.sedeId, t.dayOfWeek),
]);

/** Override de un día puntual (feriado abierto, cierre especial, etc.) */
export const horariosEspeciales = pgTable("horarios_especiales", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sedeId: uuid("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  /** Fecha local de la sede YYYY-MM-DD */
  fecha: text("fecha").notNull(),
  closed: boolean("closed").notNull().default(false),
  startTime: text("start_time"),
  endTime: text("end_time"),
  nota: text("nota"),
  ...timestamps,
}, (t) => [
  uniqueIndex("horarios_especiales_sede_fecha_uidx").on(t.sedeId, t.fecha),
  index("horarios_especiales_tenant_idx").on(t.tenantId),
]);

export const politicas = pgTable("politicas", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sedeId: uuid("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  senaModo: senaModoEnum("sena_modo").notNull().default("nunca"),
  senaTipo: senaTipoEnum("sena_tipo").notNull().default("porcentaje"),
  senaValor: numeric("sena_valor", { precision: 12, scale: 2 }).notNull().default("30"),
  holdMinutos: integer("hold_minutos").notNull().default(5),
  cancelacionVentanaHoras: integer("cancelacion_ventana_horas").notNull().default(24),
  senaDestinoCancelacion: senaDestinoCancelacionEnum("sena_destino_cancelacion")
    .notNull()
    .default("perder"),
  permiteReprogramar: boolean("permite_reprogramar").notNull().default(true),
  duracionMinMinutos: integer("duracion_min_minutos").notNull().default(60),
  duracionMaxMinutos: integer("duracion_max_minutos").notNull().default(240),
  granularidadMinutos: integer("granularidad_minutos").notNull().default(60),
  requiereAprobacionSinSena: boolean("requiere_aprobacion_sin_sena").notNull().default(false),
  ...timestamps,
}, (t) => [
  uniqueIndex("politicas_sede_uidx").on(t.sedeId),
  index("politicas_tenant_idx").on(t.tenantId),
]);

// ─── Precios / adicionales ────────────────────────────────────────────────────

export const reglasPrecio = pgTable("reglas_precio", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  scope: reglaPrecioScopeEnum("scope").notNull(),
  /** sala_id o adicional_id según scope */
  scopeId: uuid("scope_id").notNull(),
  /**
   * continuo = se repite semanalmente (happy hour).
   * puntual = relámpago / vigencia en fechas concretas.
   */
  tipo: descuentoTipoEnum("tipo").notNull().default("continuo"),
  /** Nombre editable: "Happy hour", "Flash viernes", etc. */
  nombre: text("nombre"),
  /** Días 0–6; vacío = todos los días (útil en puntual con rango de fechas) */
  daysOfWeek: smallint("days_of_week").array().notNull().default([]),
  /** null = aplica todo el día (hora local sede) */
  startTime: text("start_time"),
  endTime: text("end_time"),
  /** YYYY-MM-DD local; requerido si tipo=puntual; opcional vigencia en continuo */
  fechaDesde: text("fecha_desde"),
  fechaHasta: text("fecha_hasta"),
  precioPorHora: numeric("precio_por_hora", { precision: 12, scale: 2 }).notNull(),
  /**
   * % de descuento respecto al precio base (solo display / armado en panel).
   * El cobro usa siempre precio_por_hora.
   */
  descuentoPorcentaje: numeric("descuento_porcentaje", { precision: 5, scale: 2 }),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (t) => [
  index("reglas_precio_tenant_scope_idx").on(t.tenantId, t.scope, t.scopeId),
  index("reglas_precio_tipo_idx").on(t.tenantId, t.tipo, t.active),
]);

export const adicionalGrupos = pgTable("adicional_grupos", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sedeId: uuid("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (t) => [
  index("adicional_grupos_tenant_sede_idx").on(t.tenantId, t.sedeId),
]);

export const adicionales = pgTable("adicionales", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  grupoId: uuid("grupo_id").notNull().references(() => adicionalGrupos.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  precioBase: numeric("precio_base", { precision: 12, scale: 2 }).notNull(),
  modalidad: adicionalModalidadEnum("modalidad").notNull().default("por_reserva"),
  /** null = stock ilimitado */
  stock: integer("stock"),
  active: boolean("active").notNull().default(true),
  caracteristicas: text("caracteristicas").array().notNull().default([]),
  photoUrl: text("photo_url"),
  ...timestamps,
}, (t) => [
  index("adicionales_tenant_grupo_idx").on(t.tenantId, t.grupoId),
]);

// ─── Clientes / reservas ──────────────────────────────────────────────────────

export const clientes = pgTable("clientes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  telefono: text("telefono").notNull(),
  nombre: text("nombre").notNull(),
  email: text("email"),
  banda: text("banda"),
  noShowCount: integer("no_show_count").notNull().default(0),
  /** Crédito a favor (packs/abonos simplificados en v1) */
  creditoFavor: numeric("credito_favor", { precision: 12, scale: 2 }).notNull().default("0"),
  notasInternas: text("notas_internas"),
  /** Cuenta opcional futura del músico */
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [
  uniqueIndex("clientes_tenant_telefono_uidx").on(t.tenantId, t.telefono),
  index("clientes_tenant_idx").on(t.tenantId),
]);

/** Planes de membresía del estudio: paga X / mes → crédito Y para gastar. */
export const membresiaPlanes = pgTable(
  "membresia_planes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    descripcion: text("descripcion"),
    precioMensual: numeric("precio_mensual", {
      precision: 12,
      scale: 2,
    }).notNull(),
    creditoMensual: numeric("credito_mensual", {
      precision: 12,
      scale: 2,
    }).notNull(),
    diasPeriodo: integer("dias_periodo").notNull().default(30),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("membresia_planes_tenant_idx").on(t.tenantId)],
);

/** Membresía asignada a un cliente (período + estado). */
export const clienteMembresias = pgTable(
  "cliente_membresias",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => membresiaPlanes.id, { onDelete: "restrict" }),
    estado: membresiaEstadoEnum("estado").notNull().default("activa"),
    /** Día civil AR (YYYY-MM-DD) inicio del período actual */
    vigenteDesde: text("vigente_desde").notNull(),
    /** Día civil AR (YYYY-MM-DD) fin inclusive del período */
    vigenteHasta: text("vigente_hasta").notNull(),
    ...timestamps,
  },
  (t) => [
    index("cliente_membresias_tenant_idx").on(t.tenantId),
    index("cliente_membresias_cliente_idx").on(t.tenantId, t.clienteId),
    index("cliente_membresias_estado_idx").on(t.tenantId, t.estado),
  ],
);

export const reservas = pgTable("reservas", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sedeId: uuid("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  salaId: uuid("sala_id").notNull().references(() => salas.id, { onDelete: "restrict" }),
  clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  estado: reservaEstadoEnum("estado").notNull().default("hold"),
  origen: reservaOrigenEnum("origen").notNull().default("publico"),
  holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
  /** Identidad anónima del músico en el picker público (localStorage) */
  holdSessionId: text("hold_session_id"),
  /** Totales congelados al confirmar el hold */
  precioSala: numeric("precio_sala", { precision: 12, scale: 2 }).notNull().default("0"),
  precioAdicionales: numeric("precio_adicionales", { precision: 12, scale: 2 }).notNull().default("0"),
  precioTotal: numeric("precio_total", { precision: 12, scale: 2 }).notNull().default("0"),
  senaMonto: numeric("sena_monto", { precision: 12, scale: 2 }).notNull().default("0"),
  senaPagada: boolean("sena_pagada").notNull().default(false),
  canceladoPor: canceladoPorEnum("cancelado_por"),
  canceladoAt: timestamp("cancelado_at", { withTimezone: true }),
  cancelMotivo: text("cancel_motivo"),
  ...timestamps,
}, (t) => [
  index("reservas_tenant_sala_starts_idx").on(t.tenantId, t.salaId, t.startsAt),
  index("reservas_tenant_fecha_idx").on(t.tenantId, t.startsAt),
  index("reservas_estado_hold_idx").on(t.estado, t.holdExpiresAt),
  index("reservas_hold_session_idx").on(t.salaId, t.holdSessionId),
]);

export const reservaAdicionales = pgTable("reserva_adicionales", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  reservaId: uuid("reserva_id").notNull().references(() => reservas.id, { onDelete: "cascade" }),
  adicionalId: uuid("adicional_id").notNull().references(() => adicionales.id, { onDelete: "restrict" }),
  cantidad: integer("cantidad").notNull().default(1),
  precioUnitario: numeric("precio_unitario", { precision: 12, scale: 2 }).notNull(),
  modalidad: adicionalModalidadEnum("modalidad").notNull(),
}, (t) => [
  index("reserva_adicionales_reserva_idx").on(t.reservaId),
  index("reserva_adicionales_tenant_adicional_idx").on(t.tenantId, t.adicionalId),
]);

export const bloqueos = pgTable("bloqueos", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  /** Bloqueo de sede completa: sala_id null */
  sedeId: uuid("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  salaId: uuid("sala_id").references(() => salas.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  motivo: text("motivo"),
  ...timestamps,
}, (t) => [
  index("bloqueos_tenant_sede_idx").on(t.tenantId, t.sedeId, t.startsAt),
  index("bloqueos_tenant_sala_idx").on(t.tenantId, t.salaId, t.startsAt),
]);

// ─── Caja / pagos ────────────────────────────────────────────────────────────

export const movimientosCaja = pgTable("movimientos_caja", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  reservaId: uuid("reserva_id").references(() => reservas.id, { onDelete: "set null" }),
  /** Concepto: seña, saldo, reembolso, ajuste, egreso */
  tipo: movimientoTipoEnum("tipo").notNull(),
  estado: movimientoEstadoEnum("estado").notNull().default("pendiente"),
  medioPago: medioPagoEnum("medio_pago"),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  descripcion: text("descripcion"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  index("movimientos_caja_tenant_occurred_idx").on(t.tenantId, t.occurredAt),
]);

export const mpConexiones = pgTable("mp_conexiones", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  mpUserId: text("mp_user_id"),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex("mp_conexiones_tenant_uidx").on(t.tenantId),
]);

export const pagos = pgTable("pagos", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  reservaId: uuid("reserva_id").notNull().references(() => reservas.id, { onDelete: "cascade" }),
  mpPreferenceId: text("mp_preference_id"),
  mpPaymentId: text("mp_payment_id"),
  externalReference: text("external_reference").notNull(),
  estado: pagoEstadoEnum("estado").notNull().default("pendiente"),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  /** Comisión plataforma (marketplace_fee) en ARS; null = no aplicada */
  marketplaceFee: numeric("marketplace_fee", { precision: 12, scale: 2 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("pagos_external_reference_uidx").on(t.externalReference),
  index("pagos_tenant_reserva_idx").on(t.tenantId, t.reservaId),
]);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  payload: text("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("webhook_events_provider_event_uidx").on(t.provider, t.eventId),
]);

/** Cobros de suscripción a SalaYa (cuenta MP de la plataforma) */
export const suscripcionPagos = pgTable("suscripcion_pagos", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planCode: text("plan_code").notNull(),
  mpPreferenceId: text("mp_preference_id"),
  mpPaymentId: text("mp_payment_id"),
  externalReference: text("external_reference").notNull(),
  estado: pagoEstadoEnum("estado").notNull().default("pendiente"),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("suscripcion_pagos_external_reference_uidx").on(t.externalReference),
  index("suscripcion_pagos_tenant_idx").on(t.tenantId),
]);

// ─── Directorio público / notificaciones ──────────────────────────────────────

export const directorioEntradas = pgTable("directorio_entradas", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** null = ficha seed no reclamada */
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug"),
  zona: text("zona"),
  /** Dirección exacta para la card del directorio */
  address: text("address"),
  description: text("description"),
  telefono: text("telefono"),
  instagramUrl: text("instagram_url"),
  photoUrl: text("photo_url"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  precioDesde: numeric("precio_desde", { precision: 12, scale: 2 }),
  /** Cantidad de salas del complejo (denormalizado; seeds y listados) */
  cantidadSalas: integer("cantidad_salas").notNull().default(1),
  /** Promedio 0–5; null = sin reseñas aún */
  ratingAvg: numeric("rating_avg", { precision: 2, scale: 1 }),
  ratingCount: integer("rating_count").notNull().default(0),
  /** Chips destacados en la card (ej. Grabación, Equipos premium) */
  tagsDestacados: text("tags_destacados").array().notNull().default([]),
  /** Equipamiento completo para filtros */
  equipamiento: text("equipamiento").array().notNull().default([]),
  plan: directorioPlanEnum("plan").notNull().default("seed"),
  optOut: boolean("opt_out").notNull().default(false),
  /** Google Places id (import guía seed). Unique cuando no es null. */
  googlePlaceId: text("google_place_id"),
  /**
   * Horario semanal (seeds de Places u override).
   * dayOfWeek: 0=domingo … 6=sábado. Días cerrados = ausentes.
   */
  horarios: jsonb("horarios")
    .$type<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>()
    .notNull()
    .default([]),
  ...timestamps,
}, (t) => [
  uniqueIndex("directorio_entradas_slug_uidx").on(t.slug),
  uniqueIndex("directorio_entradas_google_place_uidx").on(t.googlePlaceId),
  index("directorio_entradas_zona_idx").on(t.zona),
]);

/** Pedidos de dueños para reclamar una ficha seed del directorio. */
export const directorioReclamaciones = pgTable("directorio_reclamaciones", {
  id: uuid("id").defaultRandom().primaryKey(),
  directorioEntradaId: uuid("directorio_entrada_id")
    .notNull()
    .references(() => directorioEntradas.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  email: text("email").notNull(),
  estado: directorioReclamacionEstadoEnum("estado").notNull().default("pendiente"),
  ...timestamps,
}, (t) => [
  index("directorio_reclamaciones_entrada_idx").on(t.directorioEntradaId),
  index("directorio_reclamaciones_estado_idx").on(t.estado, t.createdAt),
  index("directorio_reclamaciones_email_idx").on(t.email),
]);

/** Favoritos del músico (entrada de directorio = estudio). Sin tenant membership. */
export const userFavoritos = pgTable("user_favoritos", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  directorioEntradaId: uuid("directorio_entrada_id")
    .notNull()
    .references(() => directorioEntradas.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.directorioEntradaId] }),
  index("user_favoritos_entrada_idx").on(t.directorioEntradaId),
]);

/** Reseñas públicas del estudio (tenant/sede). Moderables desde el panel. */
export const resenas = pgTable("resenas", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sedeId: uuid("sede_id").references(() => sedes.id, { onDelete: "set null" }),
  /** Opcional: reseña ligada a una sala concreta */
  salaId: uuid("sala_id").references(() => salas.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  /** 1–5 */
  rating: smallint("rating").notNull(),
  body: text("body").notNull(),
  /** Visible en el sitio público */
  published: boolean("published").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  index("resenas_tenant_published_idx").on(t.tenantId, t.published, t.publishedAt),
  index("resenas_sede_idx").on(t.sedeId),
]);

export const notificationOutbox = pgTable("notification_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  payload: text("payload").notNull(),
  status: notificationStatusEnum("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => [
  index("notification_outbox_status_idx").on(t.status, t.createdAt),
  index("notification_outbox_tenant_idx").on(t.tenantId),
]);

/** Eventos de producto (clicks guía, holds, confirmaciones…) para métricas */
export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: text("event_type").notNull(),
  directorioEntradaId: uuid("directorio_entrada_id").references(
    () => directorioEntradas.id,
    { onDelete: "set null" },
  ),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  salaId: uuid("sala_id").references(() => salas.id, { onDelete: "set null" }),
  reservaId: uuid("reserva_id").references(() => reservas.id, { onDelete: "set null" }),
  sessionId: text("session_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("analytics_events_type_created_idx").on(t.eventType, t.createdAt),
  index("analytics_events_entrada_idx").on(t.directorioEntradaId, t.createdAt),
  index("analytics_events_tenant_idx").on(t.tenantId, t.createdAt),
]);

// ─── Relations (para with:) ───────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  sedes: many(sedes),
  userTenants: many(userTenants),
  invites: many(tenantInvites),
}));

export const tenantInvitesRelations = relations(tenantInvites, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantInvites.tenantId],
    references: [tenants.id],
  }),
  invitedBy: one(users, {
    fields: [tenantInvites.invitedByUserId],
    references: [users.id],
  }),
}));

export const sedesRelations = relations(sedes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [sedes.tenantId], references: [tenants.id] }),
  salas: many(salas),
  politica: one(politicas, {
    fields: [sedes.id],
    references: [politicas.sedeId],
  }),
}));

export const salasRelations = relations(salas, ({ one }) => ({
  sede: one(sedes, { fields: [salas.sedeId], references: [sedes.id] }),
  tenant: one(tenants, { fields: [salas.tenantId], references: [tenants.id] }),
}));

export const reservasRelations = relations(reservas, ({ one, many }) => ({
  sala: one(salas, { fields: [reservas.salaId], references: [salas.id] }),
  cliente: one(clientes, { fields: [reservas.clienteId], references: [clientes.id] }),
  adicionales: many(reservaAdicionales),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(userTenants),
  sessions: many(sessions),
  accounts: many(accounts),
  favoritos: many(userFavoritos),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const userTenantsRelations = relations(userTenants, ({ one }) => ({
  user: one(users, { fields: [userTenants.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [userTenants.tenantId], references: [tenants.id] }),
}));

export const userFavoritosRelations = relations(userFavoritos, ({ one }) => ({
  user: one(users, { fields: [userFavoritos.userId], references: [users.id] }),
  entrada: one(directorioEntradas, {
    fields: [userFavoritos.directorioEntradaId],
    references: [directorioEntradas.id],
  }),
}));

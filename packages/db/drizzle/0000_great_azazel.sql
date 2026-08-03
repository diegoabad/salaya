CREATE TYPE "public"."adicional_modalidad" AS ENUM('por_hora', 'por_reserva');--> statement-breakpoint
CREATE TYPE "public"."cancelado_por" AS ENUM('cliente', 'dueno', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."directorio_plan" AS ENUM('seed', 'cliente', 'destacado');--> statement-breakpoint
CREATE TYPE "public"."movimiento_estado" AS ENUM('pendiente', 'cobrado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."movimiento_tipo" AS ENUM('sena', 'saldo', 'reembolso', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pago_estado" AS ENUM('pendiente', 'aprobado', 'rechazado', 'vencido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."regla_precio_scope" AS ENUM('sala', 'adicional');--> statement-breakpoint
CREATE TYPE "public"."reserva_estado" AS ENUM('hold', 'pendiente_aprobacion', 'confirmada', 'senada', 'cancelada', 'vencida', 'ausente');--> statement-breakpoint
CREATE TYPE "public"."reserva_origen" AS ENUM('publico', 'panel', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."sena_destino_cancelacion" AS ENUM('devolver', 'credito', 'perder');--> statement-breakpoint
CREATE TYPE "public"."sena_modo" AS ENUM('nunca', 'siempre', 'reincidentes');--> statement-breakpoint
CREATE TYPE "public"."sena_tipo" AS ENUM('porcentaje', 'fijo');--> statement-breakpoint
CREATE TYPE "public"."user_tenant_role" AS ENUM('owner', 'employee');--> statement-breakpoint
CREATE TABLE "adicional_grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adicionales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"name" text NOT NULL,
	"precio_base" numeric(12, 2) NOT NULL,
	"modalidad" "adicional_modalidad" DEFAULT 'por_reserva' NOT NULL,
	"stock" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bloqueos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"sala_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"telefono" text NOT NULL,
	"nombre" text NOT NULL,
	"email" text,
	"banda" text,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"notas_internas" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directorio_entradas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" text NOT NULL,
	"slug" text,
	"zona" text,
	"telefono" text,
	"plan" "directorio_plan" DEFAULT 'seed' NOT NULL,
	"opt_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horarios_atencion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reserva_id" uuid,
	"tipo" "movimiento_tipo" NOT NULL,
	"estado" "movimiento_estado" DEFAULT 'pendiente' NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"descripcion" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_conexiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mp_user_id" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"event_type" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"payload" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reserva_id" uuid NOT NULL,
	"mp_preference_id" text,
	"mp_payment_id" text,
	"external_reference" text NOT NULL,
	"estado" "pago_estado" DEFAULT 'pendiente' NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"sena_modo" "sena_modo" DEFAULT 'nunca' NOT NULL,
	"sena_tipo" "sena_tipo" DEFAULT 'porcentaje' NOT NULL,
	"sena_valor" numeric(12, 2) DEFAULT '30' NOT NULL,
	"hold_minutos" integer DEFAULT 15 NOT NULL,
	"cancelacion_ventana_horas" integer DEFAULT 24 NOT NULL,
	"sena_destino_cancelacion" "sena_destino_cancelacion" DEFAULT 'perder' NOT NULL,
	"permite_reprogramar" boolean DEFAULT true NOT NULL,
	"duracion_min_minutos" integer DEFAULT 60 NOT NULL,
	"duracion_max_minutos" integer DEFAULT 240 NOT NULL,
	"granularidad_minutos" integer DEFAULT 60 NOT NULL,
	"requiere_aprobacion_sin_sena" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reglas_precio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scope" "regla_precio_scope" NOT NULL,
	"scope_id" uuid NOT NULL,
	"days_of_week" smallint[] NOT NULL,
	"start_time" text,
	"end_time" text,
	"precio_por_hora" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserva_adicionales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reserva_id" uuid NOT NULL,
	"adicional_id" uuid NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" numeric(12, 2) NOT NULL,
	"modalidad" "adicional_modalidad" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"sala_id" uuid NOT NULL,
	"cliente_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"estado" "reserva_estado" DEFAULT 'hold' NOT NULL,
	"origen" "reserva_origen" DEFAULT 'publico' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"precio_sala" numeric(12, 2) DEFAULT '0' NOT NULL,
	"precio_adicionales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"precio_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sena_monto" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sena_pagada" boolean DEFAULT false NOT NULL,
	"cancelado_por" "cancelado_por",
	"cancelado_at" timestamp with time zone,
	"cancel_motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	"equipamiento" text[] DEFAULT '{}' NOT NULL,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sedes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"zona" text,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tenants" (
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" "user_tenant_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tenants_user_id_tenant_id_pk" PRIMARY KEY("user_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" text NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adicional_grupos" ADD CONSTRAINT "adicional_grupos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adicional_grupos" ADD CONSTRAINT "adicional_grupos_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adicionales" ADD CONSTRAINT "adicionales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adicionales" ADD CONSTRAINT "adicionales_grupo_id_adicional_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."adicional_grupos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_sala_id_salas_id_fk" FOREIGN KEY ("sala_id") REFERENCES "public"."salas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directorio_entradas" ADD CONSTRAINT "directorio_entradas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_atencion" ADD CONSTRAINT "horarios_atencion_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_atencion" ADD CONSTRAINT "horarios_atencion_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_conexiones" ADD CONSTRAINT "mp_conexiones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politicas" ADD CONSTRAINT "politicas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politicas" ADD CONSTRAINT "politicas_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_precio" ADD CONSTRAINT "reglas_precio_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_adicionales" ADD CONSTRAINT "reserva_adicionales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_adicionales" ADD CONSTRAINT "reserva_adicionales_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_adicionales" ADD CONSTRAINT "reserva_adicionales_adicional_id_adicionales_id_fk" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sala_id_salas_id_fk" FOREIGN KEY ("sala_id") REFERENCES "public"."salas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salas" ADD CONSTRAINT "salas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salas" ADD CONSTRAINT "salas_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adicional_grupos_tenant_sede_idx" ON "adicional_grupos" USING btree ("tenant_id","sede_id");--> statement-breakpoint
CREATE INDEX "adicionales_tenant_grupo_idx" ON "adicionales" USING btree ("tenant_id","grupo_id");--> statement-breakpoint
CREATE INDEX "bloqueos_tenant_sede_idx" ON "bloqueos" USING btree ("tenant_id","sede_id","starts_at");--> statement-breakpoint
CREATE INDEX "bloqueos_tenant_sala_idx" ON "bloqueos" USING btree ("tenant_id","sala_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_tenant_telefono_uidx" ON "clientes" USING btree ("tenant_id","telefono");--> statement-breakpoint
CREATE INDEX "clientes_tenant_idx" ON "clientes" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "directorio_entradas_slug_uidx" ON "directorio_entradas" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "directorio_entradas_zona_idx" ON "directorio_entradas" USING btree ("zona");--> statement-breakpoint
CREATE INDEX "horarios_tenant_sede_dow_idx" ON "horarios_atencion" USING btree ("tenant_id","sede_id","day_of_week");--> statement-breakpoint
CREATE INDEX "movimientos_caja_tenant_occurred_idx" ON "movimientos_caja" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_conexiones_tenant_uidx" ON "mp_conexiones" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notification_outbox_status_idx" ON "notification_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_tenant_idx" ON "notification_outbox" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pagos_external_reference_uidx" ON "pagos" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "pagos_tenant_reserva_idx" ON "pagos" USING btree ("tenant_id","reserva_id");--> statement-breakpoint
CREATE UNIQUE INDEX "politicas_sede_uidx" ON "politicas" USING btree ("sede_id");--> statement-breakpoint
CREATE INDEX "politicas_tenant_idx" ON "politicas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "reglas_precio_tenant_scope_idx" ON "reglas_precio" USING btree ("tenant_id","scope","scope_id");--> statement-breakpoint
CREATE INDEX "reserva_adicionales_reserva_idx" ON "reserva_adicionales" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "reserva_adicionales_tenant_adicional_idx" ON "reserva_adicionales" USING btree ("tenant_id","adicional_id");--> statement-breakpoint
CREATE INDEX "reservas_tenant_sala_starts_idx" ON "reservas" USING btree ("tenant_id","sala_id","starts_at");--> statement-breakpoint
CREATE INDEX "reservas_tenant_fecha_idx" ON "reservas" USING btree ("tenant_id","starts_at");--> statement-breakpoint
CREATE INDEX "reservas_estado_hold_idx" ON "reservas" USING btree ("estado","hold_expires_at");--> statement-breakpoint
CREATE INDEX "salas_tenant_sede_idx" ON "salas" USING btree ("tenant_id","sede_id");--> statement-breakpoint
CREATE INDEX "sedes_tenant_idx" ON "sedes" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_uidx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "user_tenants_tenant_idx" ON "user_tenants" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uidx" ON "webhook_events" USING btree ("provider","event_id");
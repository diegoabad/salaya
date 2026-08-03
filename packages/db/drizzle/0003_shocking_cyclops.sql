CREATE TYPE "public"."medio_pago" AS ENUM('efectivo', 'transferencia', 'mercadopago', 'tarjeta');--> statement-breakpoint
ALTER TYPE "public"."movimiento_tipo" ADD VALUE 'egreso';--> statement-breakpoint
ALTER TYPE "public"."reserva_estado" ADD VALUE 'completada' BEFORE 'cancelada';--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "horarios_especiales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"fecha" text NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"start_time" text,
	"end_time" text,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "credito_favor" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD COLUMN "medio_pago" "medio_pago";--> statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "duracion_min_minutos" integer;--> statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "duracion_max_minutos" integer;--> statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "granularidad_minutos" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "como_llegar" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_especiales" ADD CONSTRAINT "horarios_especiales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_especiales" ADD CONSTRAINT "horarios_especiales_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_uidx" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "horarios_especiales_sede_fecha_uidx" ON "horarios_especiales" USING btree ("sede_id","fecha");--> statement-breakpoint
CREATE INDEX "horarios_especiales_tenant_idx" ON "horarios_especiales" USING btree ("tenant_id");
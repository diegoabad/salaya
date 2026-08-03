ALTER TYPE "public"."movimiento_tipo" ADD VALUE IF NOT EXISTS 'membresia';

CREATE TYPE "public"."membresia_estado" AS ENUM('activa', 'pausada', 'cancelada');

CREATE TABLE IF NOT EXISTS "membresia_planes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "descripcion" text,
  "precio_mensual" numeric(12, 2) NOT NULL,
  "credito_mensual" numeric(12, 2) NOT NULL,
  "dias_periodo" integer DEFAULT 30 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "membresia_planes_tenant_idx" ON "membresia_planes" ("tenant_id");

CREATE TABLE IF NOT EXISTS "cliente_membresias" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "cliente_id" uuid NOT NULL REFERENCES "clientes"("id") ON DELETE cascade,
  "plan_id" uuid NOT NULL REFERENCES "membresia_planes"("id") ON DELETE restrict,
  "estado" "membresia_estado" DEFAULT 'activa' NOT NULL,
  "vigente_desde" text NOT NULL,
  "vigente_hasta" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "cliente_membresias_tenant_idx" ON "cliente_membresias" ("tenant_id");
CREATE INDEX IF NOT EXISTS "cliente_membresias_cliente_idx" ON "cliente_membresias" ("tenant_id", "cliente_id");
CREATE INDEX IF NOT EXISTS "cliente_membresias_estado_idx" ON "cliente_membresias" ("tenant_id", "estado");

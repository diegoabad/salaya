CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'expired', 'canceled', 'exempt');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_status" "subscription_status" DEFAULT 'trialing' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_plan_code" text DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "suscripcion_pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"mp_preference_id" text,
	"mp_payment_id" text,
	"external_reference" text NOT NULL,
	"estado" "pago_estado" DEFAULT 'pendiente' NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suscripcion_pagos" ADD CONSTRAINT "suscripcion_pagos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suscripcion_pagos_external_reference_uidx" ON "suscripcion_pagos" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "suscripcion_pagos_tenant_idx" ON "suscripcion_pagos" USING btree ("tenant_id");

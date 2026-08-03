CREATE TYPE "public"."descuento_tipo" AS ENUM('continuo', 'puntual');--> statement-breakpoint
ALTER TABLE "reglas_precio" ADD COLUMN "tipo" "descuento_tipo" DEFAULT 'continuo' NOT NULL;--> statement-breakpoint
ALTER TABLE "reglas_precio" ADD COLUMN "nombre" text;--> statement-breakpoint
ALTER TABLE "reglas_precio" ADD COLUMN "fecha_desde" text;--> statement-breakpoint
ALTER TABLE "reglas_precio" ADD COLUMN "fecha_hasta" text;--> statement-breakpoint
ALTER TABLE "reglas_precio" ADD COLUMN "descuento_porcentaje" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "reglas_precio" ALTER COLUMN "days_of_week" SET DEFAULT '{}';--> statement-breakpoint
CREATE INDEX "reglas_precio_tipo_idx" ON "reglas_precio" USING btree ("tenant_id","tipo","active");

ALTER TABLE "directorio_entradas" ADD COLUMN "address" text;-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "description" text;-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "photo_url" text;-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "lat" numeric(10, 7);-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "lng" numeric(10, 7);-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "precio_desde" numeric(12, 2);-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "cantidad_salas" integer DEFAULT 1 NOT NULL;-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "rating_avg" numeric(2, 1);-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "tags_destacados" text[] DEFAULT '{}'::text[] NOT NULL;-->statement-breakpoint
ALTER TABLE "directorio_entradas" ADD COLUMN "equipamiento" text[] DEFAULT '{}'::text[] NOT NULL;

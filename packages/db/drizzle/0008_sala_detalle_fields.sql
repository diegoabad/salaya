ALTER TABLE "salas" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "acustica" text;--> statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "no_incluido" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "salas_tenant_slug_uidx" ON "salas" USING btree ("tenant_id","slug");

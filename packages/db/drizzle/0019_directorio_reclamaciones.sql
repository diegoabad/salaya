CREATE TYPE "public"."directorio_reclamacion_estado" AS ENUM('pendiente', 'contactado', 'convertido', 'rechazado');
--> statement-breakpoint
CREATE TABLE "directorio_reclamaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"directorio_entrada_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text NOT NULL,
	"estado" "directorio_reclamacion_estado" DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "directorio_reclamaciones" ADD CONSTRAINT "directorio_reclamaciones_directorio_entrada_id_directorio_entradas_id_fk" FOREIGN KEY ("directorio_entrada_id") REFERENCES "public"."directorio_entradas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "directorio_reclamaciones_entrada_idx" ON "directorio_reclamaciones" USING btree ("directorio_entrada_id");
--> statement-breakpoint
CREATE INDEX "directorio_reclamaciones_estado_idx" ON "directorio_reclamaciones" USING btree ("estado","created_at");
--> statement-breakpoint
CREATE INDEX "directorio_reclamaciones_email_idx" ON "directorio_reclamaciones" USING btree ("email");

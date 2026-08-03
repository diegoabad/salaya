ALTER TABLE "directorio_entradas" ADD COLUMN "google_place_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "directorio_entradas_google_place_uidx" ON "directorio_entradas" USING btree ("google_place_id");

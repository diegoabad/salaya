ALTER TABLE "reservas" ADD COLUMN "hold_session_id" text;--> statement-breakpoint
CREATE INDEX "reservas_hold_session_idx" ON "reservas" USING btree ("sala_id","hold_session_id");

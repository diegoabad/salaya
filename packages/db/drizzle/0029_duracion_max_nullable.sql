-- Sin tope por defecto: null = no limita la duración de la reserva.
-- El estudio puede fijar un máximo en la política de sede o override por sala.
ALTER TABLE "politicas" ALTER COLUMN "duracion_max_minutos" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "politicas" ALTER COLUMN "duracion_max_minutos" DROP NOT NULL;--> statement-breakpoint
UPDATE "politicas" SET "duracion_max_minutos" = NULL;--> statement-breakpoint

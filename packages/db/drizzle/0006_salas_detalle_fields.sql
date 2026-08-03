ALTER TABLE "sedes" ADD COLUMN "description" text;-->statement-breakpoint
ALTER TABLE "sedes" ADD COLUMN "photo_url" text;-->statement-breakpoint
ALTER TABLE "sedes" ADD COLUMN "lat" numeric(10, 7);-->statement-breakpoint
ALTER TABLE "sedes" ADD COLUMN "lng" numeric(10, 7);-->statement-breakpoint
ALTER TABLE "sedes" ADD COLUMN "amenidades" text[] DEFAULT '{}'::text[] NOT NULL;-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "categoria" text DEFAULT 'Música' NOT NULL;-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "ancho_metros" numeric(5, 2);-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "largo_metros" numeric(5, 2);-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "precio_hora" numeric(12, 2);-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "caracteristicas" text[] DEFAULT '{}'::text[] NOT NULL;-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "popular" boolean DEFAULT false NOT NULL;-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "nueva" boolean DEFAULT false NOT NULL;-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "rating_avg" numeric(2, 1);-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;-->statement-breakpoint
ALTER TABLE "salas" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;

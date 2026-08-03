ALTER TABLE "directorio_entradas" ADD COLUMN "horarios" jsonb DEFAULT '[]'::jsonb NOT NULL;

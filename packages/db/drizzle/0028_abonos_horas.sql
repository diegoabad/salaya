ALTER TABLE "membresia_planes"
  ADD COLUMN IF NOT EXISTS "horas_mensuales" numeric(8, 1) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "horas_min_semanales" numeric(8, 1) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "dias_preferidos" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "adicionales"
  ADD COLUMN IF NOT EXISTS "caracteristicas" text[] DEFAULT '{}' NOT NULL;

ALTER TABLE "sedes" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}' NOT NULL;

-- Migrar la foto única existente a la galería
UPDATE "sedes"
SET "photos" = ARRAY["photo_url"]
WHERE "photo_url" IS NOT NULL
  AND "photo_url" <> ''
  AND cardinality("photos") = 0;

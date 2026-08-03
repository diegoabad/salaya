ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "whatsapp" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "youtube_url" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "tiktok_url" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "links_extra" jsonb DEFAULT '[]'::jsonb NOT NULL;

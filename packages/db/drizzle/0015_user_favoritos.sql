CREATE TABLE "user_favoritos" (
	"user_id" uuid NOT NULL,
	"directorio_entrada_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_favoritos_user_id_directorio_entrada_id_pk" PRIMARY KEY("user_id","directorio_entrada_id")
);
--> statement-breakpoint
ALTER TABLE "user_favoritos" ADD CONSTRAINT "user_favoritos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_favoritos" ADD CONSTRAINT "user_favoritos_directorio_entrada_id_directorio_entradas_id_fk" FOREIGN KEY ("directorio_entrada_id") REFERENCES "public"."directorio_entradas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_favoritos_entrada_idx" ON "user_favoritos" USING btree ("directorio_entrada_id");

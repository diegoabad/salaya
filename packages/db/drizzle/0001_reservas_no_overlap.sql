-- Extensión para índices GiST sobre rangos + igualdad
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
-- Última línea de defensa: dos reservas activas de la misma sala no pueden solaparse
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sala_no_overlap"
EXCLUDE USING gist (
  "sala_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
)
WHERE (
  "estado" IN ('hold', 'pendiente_aprobacion', 'confirmada', 'senada')
);

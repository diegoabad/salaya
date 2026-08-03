import type { ReservaEstado } from "@repo/shared";
import { DomainError } from "./errors";

const CERRABLES: ReservaEstado[] = [
  "confirmada",
  "senada",
  "pendiente_aprobacion",
];

export class AsistenciaInvalidaError extends DomainError {
  constructor(message: string) {
    super("ASISTENCIA_INVALIDA", message);
    this.name = "AsistenciaInvalidaError";
  }
}

/**
 * Cierre de asistencia desde la agenda.
 * - asistió → completada (habilita cobrar saldo)
 * - no vino → ausente (caller incrementa no_show_count)
 */
export function resolverCierreAsistencia(input: {
  estadoActual: ReservaEstado;
  endsAt: Date;
  now: Date;
  asistio: boolean;
}): { nuevoEstado: "completada" | "ausente"; incrementarNoShow: boolean } {
  if (input.endsAt.getTime() > input.now.getTime()) {
    throw new AsistenciaInvalidaError(
      "Solo se puede cerrar asistencia de turnos ya finalizados",
    );
  }
  if (!CERRABLES.includes(input.estadoActual)) {
    throw new AsistenciaInvalidaError(
      `No se puede cerrar asistencia desde estado ${input.estadoActual}`,
    );
  }
  if (input.asistio) {
    return { nuevoEstado: "completada", incrementarNoShow: false };
  }
  return { nuevoEstado: "ausente", incrementarNoShow: true };
}

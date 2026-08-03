import type { PoliticaDuracion } from "./types";

export type SalaDuracionOverride = {
  duracionMinMinutos: number | null;
  duracionMaxMinutos: number | null;
  granularidadMinutos: number | null;
};

/** Valor efectivo: override de sala si existe, si no política de sede. */
export function resolveEffectiveDuracion(
  sede: PoliticaDuracion,
  sala?: SalaDuracionOverride | null,
): PoliticaDuracion {
  return {
    duracionMinMinutos:
      sala?.duracionMinMinutos ?? sede.duracionMinMinutos,
    duracionMaxMinutos:
      sala?.duracionMaxMinutos ?? sede.duracionMaxMinutos,
    granularidadMinutos:
      sala?.granularidadMinutos ?? sede.granularidadMinutos,
  };
}

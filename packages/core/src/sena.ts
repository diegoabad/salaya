import { percentOf, type Money } from "@repo/shared";
import { CancelacionNoPermitidaError } from "./errors";
import type { PoliticaCancelacionInput, PoliticaSenaInput } from "./types";

export function requiereSena(politica: PoliticaSenaInput): boolean {
  switch (politica.senaModo) {
    case "nunca":
      return false;
    case "siempre":
      return true;
    case "reincidentes":
      return politica.clienteNoShowCount > 0;
  }
}

export function calcularMontoSena(
  precioTotal: Money,
  politica: PoliticaSenaInput,
): Money {
  if (!requiereSena(politica)) return "0.00";
  if (politica.senaTipo === "fijo") {
    return Number.parseFloat(politica.senaValor).toFixed(2);
  }
  return percentOf(precioTotal, politica.senaValor);
}

export type DestinoSenaCancelacion = "devolver" | "credito" | "perder" | "n/a";

export function evaluarCancelacion(input: {
  startsAt: Date;
  now: Date;
  esDueno: boolean;
  senaPagada: boolean;
  politica: PoliticaCancelacionInput;
}): {
  permitida: boolean;
  destinoSena: DestinoSenaCancelacion;
} {
  const horasHastaInicio =
    (input.startsAt.getTime() - input.now.getTime()) / 3_600_000;

  if (input.esDueno) {
    return {
      permitida: true,
      destinoSena: input.senaPagada
        ? input.politica.senaDestinoCancelacion
        : "n/a",
    };
  }

  if (horasHastaInicio < input.politica.cancelacionVentanaHoras) {
    throw new CancelacionNoPermitidaError(
      `Solo se puede cancelar hasta ${input.politica.cancelacionVentanaHoras}h antes`,
    );
  }

  return {
    permitida: true,
    destinoSena: input.senaPagada
      ? input.politica.senaDestinoCancelacion
      : "n/a",
  };
}

export function puedeReprogramar(
  politica: PoliticaCancelacionInput,
  esDueno: boolean,
): boolean {
  return esDueno || politica.permiteReprogramar;
}

import { describe, expect, it } from "vitest";
import { CancelacionNoPermitidaError } from "./errors";
import {
  calcularMontoSena,
  evaluarCancelacion,
  puedeReprogramar,
  requiereSena,
} from "./sena";

describe("requiereSena", () => {
  it("nunca / siempre / reincidentes", () => {
    expect(
      requiereSena({
        senaModo: "nunca",
        senaTipo: "porcentaje",
        senaValor: "30",
        clienteNoShowCount: 5,
      }),
    ).toBe(false);

    expect(
      requiereSena({
        senaModo: "siempre",
        senaTipo: "porcentaje",
        senaValor: "30",
        clienteNoShowCount: 0,
      }),
    ).toBe(true);

    expect(
      requiereSena({
        senaModo: "reincidentes",
        senaTipo: "porcentaje",
        senaValor: "30",
        clienteNoShowCount: 0,
      }),
    ).toBe(false);

    expect(
      requiereSena({
        senaModo: "reincidentes",
        senaTipo: "porcentaje",
        senaValor: "30",
        clienteNoShowCount: 1,
      }),
    ).toBe(true);
  });
});

describe("calcularMontoSena", () => {
  it("porcentaje y fijo", () => {
    expect(
      calcularMontoSena("10000.00", {
        senaModo: "siempre",
        senaTipo: "porcentaje",
        senaValor: "30",
        clienteNoShowCount: 0,
      }),
    ).toBe("3000.00");

    expect(
      calcularMontoSena("10000.00", {
        senaModo: "siempre",
        senaTipo: "fijo",
        senaValor: "5000",
        clienteNoShowCount: 0,
      }),
    ).toBe("5000.00");
  });
});

describe("evaluarCancelacion", () => {
  const startsAt = new Date("2026-07-20T15:00:00.000Z");
  const politica = {
    cancelacionVentanaHoras: 24,
    senaDestinoCancelacion: "perder" as const,
    permiteReprogramar: true,
  };

  it("cliente dentro de ventana", () => {
    const result = evaluarCancelacion({
      startsAt,
      now: new Date("2026-07-18T15:00:00.000Z"),
      esDueno: false,
      senaPagada: true,
      politica,
    });
    expect(result.permitida).toBe(true);
    expect(result.destinoSena).toBe("perder");
  });

  it("cliente fuera de ventana", () => {
    expect(() =>
      evaluarCancelacion({
        startsAt,
        now: new Date("2026-07-20T01:00:00.000Z"),
        esDueno: false,
        senaPagada: true,
        politica,
      }),
    ).toThrow(CancelacionNoPermitidaError);
  });

  it("dueño siempre puede", () => {
    const result = evaluarCancelacion({
      startsAt,
      now: new Date("2026-07-20T14:00:00.000Z"),
      esDueno: true,
      senaPagada: false,
      politica,
    });
    expect(result.permitida).toBe(true);
  });
});

describe("puedeReprogramar", () => {
  it("dueño siempre", () => {
    expect(
      puedeReprogramar(
        {
          cancelacionVentanaHoras: 24,
          senaDestinoCancelacion: "perder",
          permiteReprogramar: false,
        },
        true,
      ),
    ).toBe(true);
  });

  it("cliente según flag", () => {
    expect(
      puedeReprogramar(
        {
          cancelacionVentanaHoras: 24,
          senaDestinoCancelacion: "perder",
          permiteReprogramar: true,
        },
        false,
      ),
    ).toBe(true);
    expect(
      puedeReprogramar(
        {
          cancelacionVentanaHoras: 24,
          senaDestinoCancelacion: "perder",
          permiteReprogramar: false,
        },
        false,
      ),
    ).toBe(false);
  });
});

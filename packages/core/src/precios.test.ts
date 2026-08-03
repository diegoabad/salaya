import { describe, expect, it } from "vitest";
import {
  calculateSalaPrice,
  resolvePriceRule,
  specificityScore,
} from "./precios";
import type { ReglaPrecio } from "./types";

/** Jueves 2026-07-16 15:00 UTC = 12:00 ART (UTC-3) */
const juevesMediodiaArt = new Date("2026-07-16T15:00:00.000Z");
/** Jueves 21:00 UTC = 18:00 ART */
const juevesTardeArt = new Date("2026-07-16T21:00:00.000Z");
/** Sábado 15:00 UTC = 12:00 ART */
const sabadoMediodiaArt = new Date("2026-07-18T15:00:00.000Z");

const reglas: ReglaPrecio[] = [
  {
    id: "lv-dia",
    tipo: "continuo",
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: null,
    endTime: null,
    precioPorHora: "15000.00",
    active: true,
  },
  {
    id: "lv-noche",
    tipo: "continuo",
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "18:00",
    endTime: "23:59",
    precioPorHora: "24000.00",
    active: true,
  },
  {
    id: "finde",
    tipo: "continuo",
    daysOfWeek: [0, 6],
    startTime: null,
    endTime: null,
    precioPorHora: "20000.00",
    active: true,
  },
];

describe("specificityScore", () => {
  it("prioriza franja horaria sobre todo el día", () => {
    expect(specificityScore(reglas[1]!)).toBeGreaterThan(
      specificityScore(reglas[0]!),
    );
  });
});

describe("resolvePriceRule", () => {
  it("elige tarifa diurna entre semana a las 12 ART", () => {
    const rule = resolvePriceRule(reglas, juevesMediodiaArt);
    expect(rule?.id).toBe("lv-dia");
  });

  it("elige tarifa nocturna a las 18 ART", () => {
    const rule = resolvePriceRule(reglas, juevesTardeArt);
    expect(rule?.id).toBe("lv-noche");
  });

  it("elige fin de semana el sábado", () => {
    const rule = resolvePriceRule(reglas, sabadoMediodiaArt);
    expect(rule?.id).toBe("finde");
  });
});

describe("calculateSalaPrice", () => {
  it("cobra 1h diurna", () => {
    const price = calculateSalaPrice({
      rules: reglas,
      startsAt: juevesMediodiaArt,
      endsAt: new Date(juevesMediodiaArt.getTime() + 60 * 60_000),
    });
    expect(price).toBe("15000.00");
  });

  it("cobra 1h nocturna", () => {
    const price = calculateSalaPrice({
      rules: reglas,
      startsAt: juevesTardeArt,
      endsAt: new Date(juevesTardeArt.getTime() + 60 * 60_000),
    });
    expect(price).toBe("24000.00");
  });

  it("suma segmentos si cruza el cambio de tarifa", () => {
    // 17:00–19:00 ART = 20:00–22:00 UTC
    const start = new Date("2026-07-16T20:00:00.000Z");
    const end = new Date("2026-07-16T22:00:00.000Z");
    const price = calculateSalaPrice({
      rules: reglas,
      startsAt: start,
      endsAt: end,
      granularityMinutes: 60,
    });
    // 17–18 diurna 15000 + 18–19 nocturna 24000
    expect(price).toBe("39000.00");
  });
});

describe("descuentos puntual vs continuo", () => {
  const conFlash: ReglaPrecio[] = [
    ...reglas,
    {
      id: "flash",
      tipo: "puntual",
      nombre: "Relámpago",
      daysOfWeek: [],
      startTime: "18:00",
      endTime: "23:59",
      fechaDesde: "2026-07-16",
      fechaHasta: "2026-07-16",
      precioPorHora: "10000.00",
      descuentoPorcentaje: "50.00",
      active: true,
    },
  ];

  it("el puntual gana sobre el continuo el día del flash", () => {
    const rule = resolvePriceRule(conFlash, juevesTardeArt);
    expect(rule?.id).toBe("flash");
  });

  it("fuera de la fecha del flash usa la tarifa continua", () => {
    // viernes 17 ART = 2026-07-17
    const viernesTarde = new Date("2026-07-17T21:00:00.000Z");
    const rule = resolvePriceRule(conFlash, viernesTarde);
    expect(rule?.id).toBe("lv-noche");
  });
});

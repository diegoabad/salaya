import { describe, expect, it } from "vitest";
import {
  assertDisponible,
  assertStockAdicionales,
} from "./disponibilidad";
import {
  FueraDeHorarioError,
  SlotOcupadoError,
  StockAdicionalError,
} from "./errors";
import type { HorarioAtencion } from "./types";

const horarios: HorarioAtencion[] = [
  { dayOfWeek: 4, startTime: "10:00", endTime: "22:00" }, // jueves
];

const politica = {
  duracionMinMinutos: 60,
  duracionMaxMinutos: 240,
  granularidadMinutos: 60,
};

const politicaSinTope = {
  duracionMinMinutos: 60,
  duracionMaxMinutos: null,
  granularidadMinutos: 60,
};

/** Jueves 12:00–14:00 ART */
const slot = {
  startsAt: new Date("2026-07-16T15:00:00.000Z"),
  endsAt: new Date("2026-07-16T17:00:00.000Z"),
};

describe("assertDisponible", () => {
  it("acepta un slot libre dentro de horario", () => {
    expect(() =>
      assertDisponible({
        intervalo: slot,
        salaId: "sala-1",
        sedeId: "sede-1",
        horarios,
        bloqueos: [],
        reservas: [],
        politicaDuracion: politica,
      }),
    ).not.toThrow();
  });

  it("sin tope máximo acepta reservas largas", () => {
    expect(() =>
      assertDisponible({
        intervalo: {
          startsAt: new Date("2026-07-16T13:00:00.000Z"), // 10 ART
          endsAt: new Date("2026-07-16T18:00:00.000Z"), // 15 ART = 5h
        },
        salaId: "sala-1",
        sedeId: "sede-1",
        horarios,
        bloqueos: [],
        reservas: [],
        politicaDuracion: politicaSinTope,
      }),
    ).not.toThrow();
  });

  it("rechaza fuera de horario", () => {
    expect(() =>
      assertDisponible({
        intervalo: {
          startsAt: new Date("2026-07-16T01:00:00.000Z"), // 22 ART miércoles→cuidado
          endsAt: new Date("2026-07-16T02:00:00.000Z"),
        },
        salaId: "sala-1",
        sedeId: "sede-1",
        horarios,
        bloqueos: [],
        reservas: [],
        politicaDuracion: politica,
      }),
    ).toThrow(FueraDeHorarioError);
  });

  it("rechaza solape con reserva activa", () => {
    expect(() =>
      assertDisponible({
        intervalo: slot,
        salaId: "sala-1",
        sedeId: "sede-1",
        horarios,
        bloqueos: [],
        reservas: [
          {
            id: "r1",
            salaId: "sala-1",
            startsAt: new Date("2026-07-16T16:00:00.000Z"),
            endsAt: new Date("2026-07-16T18:00:00.000Z"),
            estado: "confirmada",
          },
        ],
        politicaDuracion: politica,
      }),
    ).toThrow(SlotOcupadoError);
  });

  it("rechaza bloqueo de sede", () => {
    expect(() =>
      assertDisponible({
        intervalo: slot,
        salaId: "sala-1",
        sedeId: "sede-1",
        horarios,
        bloqueos: [
          {
            salaId: null,
            sedeId: "sede-1",
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          },
        ],
        reservas: [],
        politicaDuracion: politica,
      }),
    ).toThrow(SlotOcupadoError);
  });

  it("respeta horario especial cerrado", () => {
    expect(() =>
      assertDisponible({
        intervalo: slot,
        salaId: "sala-1",
        sedeId: "sede-1",
        horarios,
        bloqueos: [],
        reservas: [],
        politicaDuracion: politica,
        horariosEspeciales: [
          {
            fecha: "2026-07-16",
            closed: true,
            startTime: null,
            endTime: null,
          },
        ],
      }),
    ).toThrow(FueraDeHorarioError);
  });
});

describe("assertStockAdicionales", () => {
  it("permite si hay stock", () => {
    expect(() =>
      assertStockAdicionales(
        slot,
        [{ adicionalId: "amp", cantidad: 1, stock: 2 }],
        [
          {
            adicionalId: "amp",
            cantidad: 1,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          },
        ],
      ),
    ).not.toThrow();
  });

  it("rechaza si se supera el stock", () => {
    expect(() =>
      assertStockAdicionales(
        slot,
        [{ adicionalId: "amp", cantidad: 2, stock: 2 }],
        [
          {
            adicionalId: "amp",
            cantidad: 1,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          },
        ],
      ),
    ).toThrow(StockAdicionalError);
  });
});

import { describe, expect, it } from "vitest";
import {
  AsistenciaInvalidaError,
  resolverCierreAsistencia,
} from "./asistencia";

describe("resolverCierreAsistencia", () => {
  const endsAt = new Date("2026-07-16T17:00:00.000Z");
  const now = new Date("2026-07-16T18:00:00.000Z");

  it("asistió → completada", () => {
    expect(
      resolverCierreAsistencia({
        estadoActual: "confirmada",
        endsAt,
        now,
        asistio: true,
      }),
    ).toEqual({ nuevoEstado: "completada", incrementarNoShow: false });
  });

  it("no vino → ausente + no-show", () => {
    expect(
      resolverCierreAsistencia({
        estadoActual: "senada",
        endsAt,
        now,
        asistio: false,
      }),
    ).toEqual({ nuevoEstado: "ausente", incrementarNoShow: true });
  });

  it("rechaza turnos futuros", () => {
    expect(() =>
      resolverCierreAsistencia({
        estadoActual: "confirmada",
        endsAt: new Date("2026-07-20T17:00:00.000Z"),
        now,
        asistio: true,
      }),
    ).toThrow(AsistenciaInvalidaError);
  });
});

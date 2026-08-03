import { describe, expect, it } from "vitest";
import { resolveEffectiveDuracion } from "./duracion";

describe("resolveEffectiveDuracion", () => {
  const sede = {
    duracionMinMinutos: 60,
    duracionMaxMinutos: 240,
    granularidadMinutos: 60,
  };

  it("hereda de sede si sala no define", () => {
    expect(resolveEffectiveDuracion(sede, null)).toEqual(sede);
    expect(
      resolveEffectiveDuracion(sede, {
        duracionMinMinutos: null,
        duracionMaxMinutos: null,
        granularidadMinutos: null,
      }),
    ).toEqual(sede);
  });

  it("usa override parcial de sala", () => {
    expect(
      resolveEffectiveDuracion(sede, {
        duracionMinMinutos: 30,
        duracionMaxMinutos: null,
        granularidadMinutos: 30,
      }),
    ).toEqual({
      duracionMinMinutos: 30,
      duracionMaxMinutos: 240,
      granularidadMinutos: 30,
    });
  });
});

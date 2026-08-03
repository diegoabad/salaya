import { describe, expect, it } from "vitest";
import { calcularMarketplaceFee } from "./marketplaceFee";

describe("calcularMarketplaceFee", () => {
  it("0% o monto 0 → 0", () => {
    expect(calcularMarketplaceFee(1000, 0)).toBe(0);
    expect(calcularMarketplaceFee(0, 5)).toBe(0);
  });

  it("5% de 10000 → 500", () => {
    expect(calcularMarketplaceFee(10000, 5)).toBe(500);
  });

  it("redondea a 2 decimales", () => {
    expect(calcularMarketplaceFee(100, 3.33)).toBe(3.33);
  });

  it("nunca alcanza el total", () => {
    expect(calcularMarketplaceFee(1, 100)).toBe(0.99);
  });
});

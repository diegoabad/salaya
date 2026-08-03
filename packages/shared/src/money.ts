import { z } from "zod";

export const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Monto inválido");

export type Money = string;

/** Suma/resta de montos en string decimal sin usar float. */
export function addMoney(a: Money, b: Money): Money {
  return fromCents(toCents(a) + toCents(b));
}

export function subMoney(a: Money, b: Money): Money {
  return fromCents(toCents(a) - toCents(b));
}

export function mulMoney(a: Money, factor: number): Money {
  return fromCents(Math.round(toCents(a) * factor));
}

export function percentOf(amount: Money, percent: Money): Money {
  const cents = Math.round((toCents(amount) * toCents(percent)) / 10000);
  return (cents / 100).toFixed(2);
}

export function compareMoney(a: Money, b: Money): number {
  return toCents(a) - toCents(b);
}

export function toCents(amount: Money): number {
  const [whole, frac = ""] = amount.split(".");
  const frac2 = (frac + "00").slice(0, 2);
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(frac2, 10);
}

export function fromCents(cents: number): Money {
  return (cents / 100).toFixed(2);
}

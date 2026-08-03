/**
 * Comisión de SalaYa sobre señas cobradas vía marketplace MP (Checkout Pro).
 * MP espera `marketplace_fee` como monto fijo en moneda local (no %).
 */
export function calcularMarketplaceFee(
  amount: number,
  percent: number,
): number {
  if (!(amount > 0) || !(percent > 0)) return 0;
  const raw = (amount * percent) / 100;
  const fee = Math.round(raw * 100) / 100;
  // MP: fee no puede ser >= total
  const max = Math.round((amount - 0.01) * 100) / 100;
  if (max <= 0) return 0;
  return Math.min(fee, max);
}

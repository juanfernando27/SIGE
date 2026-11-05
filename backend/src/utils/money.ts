import { Decimal } from "decimal.js";
Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
export function money(value: string | number) {
  return new Decimal(value).toFixed(2);
}
export function lineTotal(price: string, quantity: number) {
  return new Decimal(price).times(quantity).toFixed(2);
}
export function sumMoney(values: string[]) {
  return values.reduce((total, v) => total.plus(v), new Decimal(0)).toFixed(2);
}

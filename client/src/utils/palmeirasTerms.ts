// The deal with the Palmeiras, in one place (gui, 2026-10-30 / 2026-11-08).
// Their bungalows have a public price per night, in meticals. BKC's share is
// the same both ways: when the guest pays BKC, BKC owes them the price minus
// our share; when the guest pays them, they owe BKC our share of what was paid.

/** Our share of a bungalow's price, either way. Small gaps (a price agreed
 *  differently, the exchange rate) are entered as the month's actual commission
 *  (palmeiras_reversals) and show as an adjustment. */
export const PALMEIRAS_COMMISSION_PCT = 15

const r2 = (n: number) => Math.round(n * 100) / 100

/** What BKC owes the Palmeiras for an amount at their price: 12 000 → 10 200. */
export function palmeirasCostMzn(priceMzn: number): number {
  return r2(priceMzn * (100 - PALMEIRAS_COMMISSION_PCT) / 100)
}

/** Our commission on an amount the guest paid them: 12 000 → 1 800. */
export function palmeirasCommissionMzn(paidMzn: number): number {
  return r2(paidMzn * PALMEIRAS_COMMISSION_PCT / 100)
}

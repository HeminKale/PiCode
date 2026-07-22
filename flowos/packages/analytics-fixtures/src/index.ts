export interface SyntheticShopFixtureOptions {
  customerCount?: number;
  weekCount?: number;
  startYear?: number;
  seed?: number;
}

export interface SyntheticShopFixture {
  salesCsv: string;
  calendarCsv: string;
  productIds: string[];
  customerIds: string[];
  knownPromotionUpliftUnits: number;
  rowCount: number;
}

/**
 * Deterministic, non-production shop data for demos and tests. The direct
 * promotion term is intentionally known so fixed-code model tests can assert
 * that an uplift is recovered without shipping a CSV fixture as product data.
 */
export function createSyntheticShopFixture(options: SyntheticShopFixtureOptions = {}): SyntheticShopFixture {
  const customerCount = options.customerCount ?? 4;
  const weekCount = options.weekCount ?? 20;
  const startYear = options.startYear ?? 2026;
  const knownPromotionUpliftUnits = 9;
  if (!Number.isInteger(customerCount) || customerCount < 1 || customerCount > 100) throw new Error("customerCount must be an integer from 1 to 100.");
  if (!Number.isInteger(weekCount) || weekCount < 8 || weekCount > 52) throw new Error("weekCount must be an integer from 8 to 52.");

  const random = mulberry32(options.seed ?? 202604);
  const productIds = Array.from({ length: 100 }, (_, index) => `P${String(index + 1).padStart(3, "0")}`);
  const customerIds = Array.from({ length: customerCount }, (_, index) => `C${String(index + 1).padStart(3, "0")}`);
  const calendar = ["Year-WeekNumber,WeekStart,WeekEnd"];
  const sales = ["ProductId,CustomerId,WeekNum,NumStores,ConsumerPrice,IsPromotion,Tactic1,Tactic2,SalesUnits"];

  for (let week = 1; week <= weekCount; week += 1) {
    const weekNum = `${startYear}-${String(week).padStart(2, "0")}`;
    const start = isoWeekStart(startYear, week);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
    calendar.push(`${weekNum},${start.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}`);
    for (let productIndex = 0; productIndex < productIds.length; productIndex += 1) {
      for (let customerIndex = 0; customerIndex < customerIds.length; customerIndex += 1) {
        const promotion = (week + productIndex * 3 + customerIndex) % 5 === 0 ? 1 : 0;
        const tactic1 = promotion ? 1 : 0;
        const tactic2 = promotion && (productIndex + week) % 3 === 0 ? 0.5 : 0;
        const stores = 2 + (customerIndex % 4);
        const price = 8 + (productIndex % 12) * 0.65;
        const baseline = 15 + (productIndex % 11) * 1.4 + customerIndex * 2 + (week % 4) * 1.2 - price * 0.18 + stores * 1.1;
        const seasonalNoise = (random() - 0.5) * 1.2;
        const units = Math.max(1, baseline + promotion * knownPromotionUpliftUnits + tactic2 * 2 + seasonalNoise);
        sales.push([productIds[productIndex], customerIds[customerIndex], weekNum, stores, price.toFixed(2), promotion, tactic1, tactic2, units.toFixed(3)].join(","));
      }
    }
  }
  return { salesCsv: `${sales.join("\n")}\n`, calendarCsv: `${calendar.join("\n")}\n`, productIds, customerIds, knownPromotionUpliftUnits, rowCount: productIds.length * customerIds.length * weekCount };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}

function isoWeekStart(year: number, week: number): Date {
  const fourthJanuary = new Date(Date.UTC(year, 0, 4));
  const mondayOffset = (fourthJanuary.getUTCDay() + 6) % 7;
  const monday = new Date(fourthJanuary); monday.setUTCDate(fourthJanuary.getUTCDate() - mondayOffset + (week - 1) * 7);
  return monday;
}

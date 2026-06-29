// FreshBid prediction & scoring engine.
// MVP assumption: trained ML models are not available yet, so these are
// transparent, deterministic heuristics calibrated from typical food-retail
// waste rates. They expose the SAME interface a real model would, so swapping
// in a hosted model later only changes these function bodies.

export type FoodCategory =
  | "bakery" | "produce" | "dairy" | "prepared"
  | "meat" | "frozen" | "pantry" | "beverage" | "other";

export type TempSensitivity = "ambient" | "chilled" | "frozen" | "hot";

// Typical end-of-day surplus rate by category (fraction of daily inventory).
const SURPLUS_RATE: Record<FoodCategory, number> = {
  bakery: 0.28, produce: 0.22, prepared: 0.32, dairy: 0.12,
  meat: 0.1, frozen: 0.05, pantry: 0.04, beverage: 0.06, other: 0.15,
};

// Baseline recovery value ($ per unit) buyers tend to pay for surplus.
const BASE_VALUE: Record<FoodCategory, number> = {
  bakery: 1.1, produce: 0.9, prepared: 1.8, dairy: 1.3,
  meat: 2.6, frozen: 2.0, pantry: 1.0, beverage: 0.8, other: 1.0,
};

/** Predict end-of-day surplus units from total daily inventory. */
export function predictSurplus(totalInventory: number, category: FoodCategory): number {
  const rate = SURPLUS_RATE[category] ?? 0.15;
  return Math.max(0, Math.round(totalInventory * rate * 10) / 10);
}

/** Expected clearing price for a lot, the basis for a reserve-price suggestion. */
export function predictClearingValue(
  quantity: number,
  category: FoodCategory,
  temp: TempSensitivity,
  hoursToExpiry: number,
): number {
  const base = BASE_VALUE[category] ?? 1.0;
  // Urgency discount: less time to expiry -> lower clearing value.
  const urgency = clamp(hoursToExpiry / 24, 0.45, 1);
  // Cold-chain items hold value better.
  const tempFactor = temp === "frozen" ? 1.1 : temp === "chilled" ? 1.0 : temp === "hot" ? 0.8 : 0.95;
  return round2(quantity * base * urgency * tempFactor);
}

/** Suggested reserve price: a fraction of expected clearing value. */
export function suggestReserve(clearingValue: number): number {
  return round2(clearingValue * 0.45);
}

/** Probability (0-1) a buyer completes pickup, used in winner selection. */
export function pickupSuccessProbability(
  buyerReliability: number,
  buyerTrust: number,
  pickupWindowHours: number,
): number {
  const r = clamp(buyerReliability / 100, 0, 1);
  const t = clamp(buyerTrust / 100, 0, 1);
  const window = clamp(pickupWindowHours / 4, 0.5, 1); // wider window = easier pickup
  return round2(clamp(0.35 + 0.4 * r + 0.2 * t + 0.05 * window, 0, 0.99));
}

/**
 * Google-Ads-style effective bid score = bid amount weighted by a quality
 * score (pickup reliability + trust). The highest effective score wins, so a
 * reliable, trusted buyer can beat a slightly higher but riskier bid.
 */
export function effectiveBidScore(
  amount: number,
  reservePrice: number,
  buyerReliability: number,
  buyerTrust: number,
): number {
  if (amount < reservePrice) return 0; // below reserve = invalid
  const quality = 0.6 * clamp(buyerReliability / 100, 0, 1) + 0.4 * clamp(buyerTrust / 100, 0, 1);
  // amount * (0.6 + 0.4*quality): quality can swing effective value by up to 40%.
  return round2(amount * (0.6 + 0.4 * quality));
}

/** Estimated meals funded by a donation amount (≈ $0.40 per meal). */
export function estimateMeals(amount: number): number {
  return Math.round(amount / 0.4);
}

/** Composite fraud-risk score 0-100 (higher = riskier). */
export function fraudRisk(opts: {
  buyerTrust: number;
  bidVsReserveRatio: number; // amount / reserve
  accountAgeDays: number;
  recentBidCount: number;
}): number {
  let risk = 0;
  if (opts.buyerTrust < 50) risk += 35;
  else if (opts.buyerTrust < 70) risk += 15;
  if (opts.bidVsReserveRatio > 4) risk += 25; // implausibly high bid = possible fake bid
  if (opts.accountAgeDays < 2) risk += 20;
  if (opts.recentBidCount > 30) risk += 20; // bid spamming
  return clamp(risk, 0, 100);
}

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
function round2(n: number) { return Math.round(n * 100) / 100; }

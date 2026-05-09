import { formatFixedAmount } from "@/lib/wallet/manual-deposit";

export const PREMIUM_PROMOTION_UNIT_HOURS = 36;
export const PREMIUM_PROMOTION_UNIT_FEE_FIXED = 1_000_000n;
export const PREMIUM_PROMOTION_MAX_UNITS = 6;

export function normalizePremiumDurationHours(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return 0;

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 0;
  if (parsed % PREMIUM_PROMOTION_UNIT_HOURS !== 0) {
    throw new Error("프리미엄 이용 시간은 36시간 단위로 선택해 주세요.");
  }

  const units = parsed / PREMIUM_PROMOTION_UNIT_HOURS;
  if (units > PREMIUM_PROMOTION_MAX_UNITS) {
    throw new Error("프리미엄 이용 시간은 최대 216시간까지 선택할 수 있습니다.");
  }

  return parsed;
}

export function calculatePremiumPromotionFee(durationHours: number) {
  if (durationHours <= 0) return 0n;
  const units = durationHours / PREMIUM_PROMOTION_UNIT_HOURS;
  return BigInt(units) * PREMIUM_PROMOTION_UNIT_FEE_FIXED;
}

export function getPremiumPromotionWindow(durationHours: number, now = new Date()) {
  if (durationHours <= 0) {
    return {
      premiumStartedAt: null,
      premiumEndsAt: null,
    };
  }

  return {
    premiumStartedAt: now,
    premiumEndsAt: new Date(now.getTime() + durationHours * 60 * 60 * 1000),
  };
}

export function formatPremiumPromotionFee(amount: bigint) {
  return formatFixedAmount(amount);
}

export function isPremiumActive(premiumEndsAt?: Date | string | null, now = new Date()) {
  if (!premiumEndsAt) return false;
  const endsAt = premiumEndsAt instanceof Date ? premiumEndsAt : new Date(premiumEndsAt);
  return endsAt.getTime() > now.getTime();
}

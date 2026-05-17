import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

const PLATFORM_FEE_BASIS_POINTS = 500n; // 5%
const BASIS_POINTS = 10_000n;

export type MarketplaceOrderFeeBreakdown = {
  grossAmount: string;
  platformFeeAmount: string;
  sellerReceivableAmount: string;
};

export function calculateMarketplaceOrderFees(
  grossAmountText: string,
): MarketplaceOrderFeeBreakdown {
  const grossAmount = parseFixedAmount(grossAmountText);

  if (grossAmount <= 0n) {
    throw new Error("주문 금액은 0보다 커야 합니다.");
  }

  const platformFeeAmount = (grossAmount * PLATFORM_FEE_BASIS_POINTS) / BASIS_POINTS;
  const sellerReceivableAmount = grossAmount - platformFeeAmount;

  if (sellerReceivableAmount <= 0n) {
    throw new Error("판매자 정산 금액은 0보다 커야 합니다.");
  }

  return {
    grossAmount: formatFixedAmount(grossAmount),
    platformFeeAmount: formatFixedAmount(platformFeeAmount),
    sellerReceivableAmount: formatFixedAmount(sellerReceivableAmount),
  };
}

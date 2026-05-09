import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

const SCALE = 1_000_000n;

export function calculateMarketplacePurchaseAmount(
  quantity: string,
  unitPrice: string,
): string {
  const normalizedQuantity = parseFixedAmount(quantity);
  const normalizedUnitPrice = parseFixedAmount(unitPrice);

  if (normalizedQuantity <= 0n) {
    throw new Error("구매 수량은 0보다 커야 합니다.");
  }

  if (normalizedUnitPrice <= 0n) {
    throw new Error("매물 단가는 0보다 커야 합니다.");
  }

  return formatFixedAmount((normalizedQuantity * normalizedUnitPrice) / SCALE);
}

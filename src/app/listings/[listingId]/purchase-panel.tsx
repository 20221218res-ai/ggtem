"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, Button, Card, Field, TextInput } from "@/components/ui";
import { calculateMarketplacePurchaseAmount } from "@/lib/market/purchase-calculation";
import { parseFixedAmount } from "@/lib/wallet/manual-deposit";

type PurchasePanelProps = {
  listingId: string;
  unitPrice: string;
  currency: string;
  availableQuantity: string;
};

type PurchaseResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  quantity: string;
  amount: string;
  buyerWallet: {
    availableBalance: string;
    escrowBalance: string;
    currency: string;
  };
  inventory: {
    availableQuantity: string;
    lockedQuantity: string;
    soldQuantity: string;
  };
};

export function PurchasePanel({
  listingId,
  unitPrice,
  currency,
  availableQuantity,
}: PurchasePanelProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("100000");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculatedAmount = useMemo(() => {
    try {
      return calculateMarketplacePurchaseAmount(quantity, unitPrice);
    } catch {
      return "";
    }
  }, [quantity, unitPrice]);

  const quickQuantityOptions = useMemo(() => {
    try {
      const maxQuantity = parseFixedAmount(availableQuantity);
      const presetOptions = [
        { label: "100K", value: "100000" },
        { label: "500K", value: "500000" },
      ].filter((option) => parseFixedAmount(option.value) <= maxQuantity);

      return [...presetOptions, { label: "MAX", value: availableQuantity }];
    } catch {
      return [{ label: "MAX", value: availableQuantity }];
    }
  }, [availableQuantity]);

  async function handleSubmit() {
    setError("");
    setIsSubmitting(true);

    try {
      if (!calculatedAmount) {
        throw new Error("구매 수량을 입력해 주세요.");
      }

      const response = await fetch("/api/market/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId,
          quantity,
          amount: calculatedAmount,
        }),
      });
      const nextResult = (await response.json()) as
        | PurchaseResult
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in nextResult && nextResult.message
            ? nextResult.message
            : "구매 처리를 완료하지 못했습니다.",
        );
      }

      setResult(nextResult as PurchaseResult);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "구매 처리를 완료하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="sticky top-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gg-accent)]">즉시 구매</p>
          <p className="mt-2 text-4xl font-bold text-[var(--gg-accent)]">
            {unitPrice} {currency}
          </p>
          <p className="mt-1 text-sm text-[var(--gg-muted)]">단가</p>
        </div>
        <span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-bold text-[var(--gg-accent)]">
          에스크로
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
        <SummaryLine label="구매 가능" value={availableQuantity} />
        <SummaryLine label="전달 방식" value="주문 채팅" />
      </div>

      <div className="mt-6 space-y-4">
        <Field label="구매 수량">
          <TextInput
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setResult(null);
            }}
            inputMode="decimal"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {quickQuantityOptions.map((option) => (
            <button
              key={`${option.label}-${option.value}`}
              type="button"
              onClick={() => {
                setQuantity(option.value);
                setResult(null);
              }}
              className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                quantity === option.value
                  ? "border-[var(--gg-accent)] bg-[var(--gg-accent)] text-[var(--gg-inverse-text)]"
                  : "border-[var(--gg-border)] bg-[var(--gg-control-bg)] text-[var(--gg-muted)] hover:text-[var(--gg-text)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Field label="결제 예정">
          <TextInput value={calculatedAmount} readOnly inputMode="decimal" />
        </Field>
      </div>

      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !calculatedAmount || Boolean(result)}
        className="mt-6 w-full py-3 text-base"
      >
        {isSubmitting ? "처리 중..." : result ? "주문 생성 완료" : "즉시 구매"}
      </Button>

      {result ? (
        <div className="mt-5 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div>
            <p className="font-black text-emerald-800">주문이 생성되었습니다.</p>
            <p className="mt-1 text-xs font-bold text-emerald-700">
              {result.orderNumber} · {getPurchaseStatusLabel(result.status)}
            </p>
          </div>
          <div className="grid gap-2 rounded-lg border border-emerald-200 bg-[var(--gg-card-bg)] p-3 text-xs font-bold text-[var(--gg-muted)]">
            <span>
              구매 금액: {result.amount} {currency}
            </span>
            <span>남은 재고: {result.inventory.availableQuantity}</span>
            <span>에스크로 잠금: {result.buyerWallet.escrowBalance}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={`/my/orders/${result.orderId}`}
              className="inline-flex justify-center rounded-md border border-emerald-300 bg-[var(--gg-card-bg)] px-3 py-2 text-xs font-black text-[var(--gg-text)] hover:bg-emerald-100"
            >
              주문 상세
            </Link>
            <Link
              href={`/my/orders/${result.orderId}/chat`}
              className="inline-flex justify-center rounded-md bg-[var(--gg-accent)] px-3 py-2 text-xs font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              채팅 열기
            </Link>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-sm first:mt-0">
      <span className="text-[var(--gg-muted)]">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function getPurchaseStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ESCROW_LOCKED: "에스크로 잠금",
    SELLER_RESPONSE_PENDING: "판매자 응답 대기",
    DELIVERY_IN_PROGRESS: "전달 진행",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "인수확정 대기",
    COMPLETED: "거래 완료",
    CANCELED: "취소됨",
    DISPUTED: "분쟁 중",
    REFUNDED: "환불 완료",
  };

  return labels[status] ?? status;
}

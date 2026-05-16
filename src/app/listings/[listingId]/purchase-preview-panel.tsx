"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { TradeSafetyConfirmDialog } from "@/components/trade-safety-confirm-dialog";
import { calculateMarketplacePurchaseAmount } from "@/lib/market/purchase-calculation";
import {
  formatGameMoneyQuantityWithUnit,
  isGameMoneyDisplayQuantity,
  normalizeGameMoneyPriceUnit,
  toGameMoneyActualQuantity,
  toGameMoneyDisplayQuantity,
} from "@/lib/market/trade-unit";
import { parseFixedAmount } from "@/lib/wallet/manual-deposit";
import useCountryTranslation from "@/app/use-country-translation";
import type { TranslationKey } from "@/app/i18n";

type PurchasePreviewPanelProps = {
  listingId: string;
  category: string;
  tradeMode: string;
  unitPrice: string;
  displayUnitPrice: string;
  priceUnitQuantity: string;
  priceUnitLabel: string;
  currency: string;
  availableQuantity: string;
  minimumQuantity: string;
  tradeUnitLabel: string;
  serverLabel?: string;
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

export function PurchasePreviewPanel({
  listingId,
  category,
  tradeMode,
  unitPrice,
  displayUnitPrice,
  priceUnitQuantity,
  priceUnitLabel,
  currency,
  availableQuantity,
  minimumQuantity,
  tradeUnitLabel,
  serverLabel,
}: PurchasePreviewPanelProps) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [error, setError] = useState("");
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isGameMoneyListing = category === "GAME_MONEY";
  const priceUnitDisplayLabel = priceUnitLabel || t("listingDetail.eachBasis");
  const safetyServerLabel = serverLabel || t("listingDetail.allServers");
  const isBulkMode = tradeMode === "BULK";
  const normalizedPriceUnitQuantity = isGameMoneyListing
    ? normalizeGameMoneyPriceUnit(priceUnitQuantity)
    : "1";
  const displayMinimumQuantity = isGameMoneyListing
    ? toGameMoneyDisplayQuantity(minimumQuantity, normalizedPriceUnitQuantity)
    : minimumQuantity;
  const displayAvailableQuantity = isGameMoneyListing
    ? toGameMoneyDisplayQuantity(availableQuantity, normalizedPriceUnitQuantity)
    : availableQuantity;
  const minimumQuantityLabel = isGameMoneyListing
    ? formatGameMoneyQuantityWithUnit(minimumQuantity, normalizedPriceUnitQuantity, tradeUnitLabel)
    : formatTradeQuantity(minimumQuantity, tradeUnitLabel);
  const availableQuantityLabel = isGameMoneyListing
    ? formatGameMoneyQuantityWithUnit(availableQuantity, normalizedPriceUnitQuantity, tradeUnitLabel)
    : formatTradeQuantity(availableQuantity, tradeUnitLabel);
  const [quantity, setQuantity] = useState(
    isBulkMode ? displayAvailableQuantity : displayMinimumQuantity,
  );
  const actualQuantity = isGameMoneyListing && isGameMoneyDisplayQuantity(quantity)
    ? toGameMoneyActualQuantity(quantity, normalizedPriceUnitQuantity)
    : quantity;
  const actualQuantityLabel = isGameMoneyListing
    ? formatGameMoneyQuantityWithUnit(actualQuantity, normalizedPriceUnitQuantity, tradeUnitLabel)
    : formatTradeQuantity(actualQuantity, tradeUnitLabel);

  const quantityStatus = (() => {
    try {
      if (isGameMoneyListing && !isGameMoneyDisplayQuantity(quantity)) {
        return {
          isValid: false,
          message: t("listingForm.selectedUnitQuantityInvalid"),
        };
      }

      const normalizedQuantity = parseFixedAmount(actualQuantity || "0");
      const normalizedMinimum = parseFixedAmount(minimumQuantity);
      const normalizedAvailable = parseFixedAmount(availableQuantity);

      if (normalizedQuantity <= 0n) {
        return { isValid: false, message: t("purchase.quantityPositive") };
      }

      if (isBulkMode && normalizedQuantity !== normalizedAvailable) {
        return {
          isValid: false,
          message: t("purchase.bulkOnlyFullQuantity"),
        };
      }

      if (normalizedQuantity < normalizedMinimum) {
        return {
          isValid: false,
          message: formatMessage(t("purchase.minimumQuantityMessage"), {
            quantity: minimumQuantityLabel,
          }),
        };
      }

      if (normalizedQuantity > normalizedAvailable) {
        return {
          isValid: false,
          message: formatMessage(t("purchase.availableStockMessage"), {
            quantity: availableQuantityLabel,
          }),
        };
      }

      return { isValid: true, message: t("purchase.quantityValid") };
    } catch {
      return { isValid: false, message: t("purchase.numberOnly") };
    }
  })();

  const expectedAmount = (() => {
    try {
      if (!quantityStatus.isValid) {
        return "0";
      }

      return calculateMarketplacePurchaseAmount(actualQuantity || "0", unitPrice);
    } catch {
      return "0";
    }
  })();

  const quickQuantitySeeds = isBulkMode
    ? [displayAvailableQuantity]
    : [
        displayMinimumQuantity,
        ...(isGameMoneyListing ? ["1", "5", "10"] : ["10", "100", "1000"]),
        displayAvailableQuantity,
      ];

  const quickQuantities = Array.from(
    new Set(
      quickQuantitySeeds.filter(Boolean),
    ),
  ).filter((option) => {
    try {
      const normalizedOption = parseFixedAmount(
        isGameMoneyListing
          ? toGameMoneyActualQuantity(option, normalizedPriceUnitQuantity)
          : option,
      );
      const normalizedMinimum = parseFixedAmount(minimumQuantity);
      const normalizedAvailable = parseFixedAmount(availableQuantity);

      return (
        normalizedOption >= normalizedMinimum &&
        normalizedOption <= normalizedAvailable
      );
    } catch {
      return false;
    }
  });

  function requestPurchase() {
    setError("");
    setResult(null);

    if (!quantityStatus.isValid) {
      setError(quantityStatus.message);
      return;
    }

    setIsConfirmOpen(true);
  }

  async function handlePurchase(input: { password: string; characterName: string }) {
    setError("");

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId,
          quantity: actualQuantity,
          amount: expectedAmount,
          paymentPin: input.password,
          characterName: input.characterName,
        }),
      });
      const responseBody = (await response.json()) as
        | PurchaseResult
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in responseBody && responseBody.message
            ? responseBody.message
            : t("purchase.failed"),
        );
      }

      setResult(responseBody as PurchaseResult);
      setIsConfirmOpen(false);
      router.refresh();
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : t("purchase.failed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-lg shadow-[var(--gg-shadow)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
        {t("purchase.instantBuy")}
      </p>
      <h2 className="mt-2 text-2xl font-black">{t("purchase.instantBuy")}</h2>

      <label className="mt-5 block">
        <span className="text-xs font-bold text-[var(--gg-muted)]">{t("purchase.quantity")}</span>
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode={isGameMoneyListing ? "numeric" : "decimal"}
          step={isGameMoneyListing ? 1 : undefined}
          placeholder={isGameMoneyListing ? `${t("listingForm.exampleUnitQuantity")} = ${priceUnitLabel}` : undefined}
          disabled={isBulkMode}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 text-sm font-black outline-none focus:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-70"
        />
      </label>
      {isBulkMode ? (
        <p className="mt-2 text-xs font-bold text-[var(--gg-muted)]">
          {t("purchase.bulkOnlyFullQuantity")}
        </p>
      ) : null}
      <p
        className={
          quantityStatus.isValid
            ? "mt-2 text-xs font-bold text-[var(--gg-accent)]"
            : "mt-2 text-xs font-bold text-rose-500"
        }
      >
        {quantityStatus.message}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickQuantities.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setQuantity(option)}
            className={
              quantity === option
                ? "rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-xs font-black text-[var(--gg-inverse-text)]"
                : "rounded-lg border border-[var(--gg-border)] px-3 py-2 text-xs font-black hover:bg-[var(--gg-control-bg)]"
            }
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <PreviewRow label={t("purchase.unitPrice")} value={`${displayUnitPrice} ${currency} / ${priceUnitDisplayLabel}`} />
        <PreviewRow label={t("purchase.minimumQuantity")} value={minimumQuantityLabel} />
        <PreviewRow label={t("purchase.availableStock")} value={availableQuantityLabel} />
        <PreviewRow
          label={t("purchase.expectedPayment")}
          value={`${expectedAmount} ${currency}`}
          strong
        />
      </div>

      <button
        type="button"
        onClick={requestPurchase}
        disabled={!quantityStatus.isValid || isSubmitting || Boolean(result)}
        className={
          quantityStatus.isValid
            ? "mt-5 w-full rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-sm font-black text-[var(--gg-inverse-text)] transition hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            : "mt-5 w-full rounded-xl bg-slate-400 px-4 py-4 text-sm font-black text-white opacity-60"
        }
      >
        {isSubmitting
          ? t("purchase.creating")
          : quantityStatus.isValid
            ? t("purchase.instantBuy")
            : t("purchase.quantityCheckNeeded")}
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-[var(--gg-muted)]">
        <span className="rounded-lg bg-[var(--gg-card-soft-bg)] px-2 py-2">{t("listingDetail.escrow")}</span>
        <span className="rounded-lg bg-[var(--gg-card-soft-bg)] px-2 py-2">{t("common.chat")}</span>
        <span className="rounded-lg bg-[var(--gg-card-soft-bg)] px-2 py-2">{t("purchase.receiptConfirmation")}</span>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] p-4">
          <p className="text-sm font-black text-[var(--gg-accent)]">{t("purchase.orderCreated")}</p>
          <p className="mt-2 text-xs font-bold text-[var(--gg-accent)]">
            {result.orderNumber} · {getPurchaseStatusLabel(result.status)}
          </p>
          <div className="mt-3 grid gap-2 rounded-lg border border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[var(--gg-card-bg)] p-3 text-xs font-bold text-[var(--gg-muted)]">
            <span>
              {t("purchase.purchaseAmount")}: {result.amount} {currency}
            </span>
            <span>
              {t("purchase.remainingStock")}:{" "}
              {isGameMoneyListing
                ? formatGameMoneyQuantityWithUnit(
                    result.inventory.availableQuantity,
                    normalizedPriceUnitQuantity,
                    tradeUnitLabel,
                  )
                : formatTradeQuantity(result.inventory.availableQuantity, tradeUnitLabel)}
            </span>
            <span>{t("purchase.escrowLocked")}: {result.buyerWallet.escrowBalance}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/my/orders/${result.orderId}`}
              className="rounded-lg border border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[var(--gg-card-bg)] px-3 py-2 text-center text-xs font-black hover:bg-[color-mix(in_srgb,var(--gg-accent)_18%,transparent)]"
            >
              {t("purchase.orderDetail")}
            </Link>
            <Link
              href={`/my/orders/${result.orderId}/chat`}
              className="rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-center text-xs font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              {t("purchase.openChat")}
            </Link>
          </div>
        </div>
      ) : null}

      <TradeSafetyConfirmDialog
        isOpen={isConfirmOpen}
        eyebrow="SAFE ESCROW"
        title={t("purchase.confirmTitle")}
        body={t("purchase.confirmBody")}
        confirmLabel={t("purchase.confirmLabel")}
        cancelLabel={t("common.cancel")}
        isSubmitting={isSubmitting}
        serverLabel={safetyServerLabel}
        requireCharacterName
        characterNameLabel={t("listingForm.buyerGameNickname")}
        characterNamePlaceholder={t("listingForm.buyerGameNicknamePlaceholder")}
        summaryRows={[
          { label: String(t("purchase.quantity")), value: actualQuantityLabel },
          { label: String(t("purchase.unitPrice")), value: `${displayUnitPrice} ${currency} / ${priceUnitDisplayLabel}` },
          { label: String(t("purchase.expectedPayment")), value: `${expectedAmount} ${currency}` },
        ]}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handlePurchase}
      />
    </section>
  );
}

function getPurchaseStatusLabel(status: string) {
  const labels: Record<string, TranslationKey> = {
    ESCROW_LOCKED: "orderStatus.escrowLocked",
    SELLER_RESPONSE_PENDING: "orderStatus.sellerResponsePending",
    DELIVERY_IN_PROGRESS: "orderStatus.deliveryInProgress",
    DELIVERY_COMPLETED: "orderStatus.deliveryCompleted",
    BUYER_CONFIRM_PENDING: "orderStatus.buyerConfirmPending",
    COMPLETED: "orderStatus.completed",
    CANCELED: "orderStatus.canceled",
    DISPUTED: "orderStatus.disputed",
    REFUNDED: "orderStatus.refunded",
  };

  const key = labels[status];
  return key ? <TranslatedStatus labelKey={key} /> : status;
}

function TranslatedStatus({ labelKey }: { labelKey: TranslationKey }) {
  const { t } = useCountryTranslation();
  return <>{t(labelKey)}</>;
}

function formatTradeQuantity(quantity: string, unitLabel: string) {
  const formattedQuantity = formatUnitPrice(quantity);
  return unitLabel ? `${formattedQuantity} ${unitLabel}` : formattedQuantity;
}

function formatUnitPrice(value: string) {
  if (!value.includes(".")) {
    return value;
  }

  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function PreviewRow({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] px-4 py-3">
      <span className="text-xs font-bold text-[var(--gg-muted)]">{label}</span>
      <span
        className={
          strong
            ? "text-lg font-black text-[var(--gg-accent)]"
            : "text-sm font-black"
        }
      >
        {value}
      </span>
    </div>
  );
}

function formatMessage(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  );
}

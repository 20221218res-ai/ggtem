"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { TradeSafetyConfirmDialog } from "@/components/trade-safety-confirm-dialog";
import useCountryTranslation from "@/app/use-country-translation";
import type { TranslationKey } from "@/app/i18n";
import {
  isGameMoneyDisplayQuantity,
  normalizeGameMoneyPriceUnit,
  toGameMoneyActualQuantity,
  toGameMoneyDisplayQuantity,
} from "@/lib/market/trade-unit";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";

const FIXED_AMOUNT_SCALE = 1_000_000n;

type InstantSaleResult = {
  orderId?: string;
  orderNumber?: string;
  status?: string;
  redirectHref?: string;
  message?: string;
};

export default function BuyRequestOfferForm({
  buyRequestId,
  category,
  defaultQuantity,
  minimumQuantity,
  tradeMode,
  defaultUnitPrice,
  canonicalUnitPrice,
  priceUnitQuantity,
  priceUnitLabel,
  totalAmount,
  currency,
  serverLabel,
}: {
  buyRequestId: string;
  category: string;
  defaultQuantity: string;
  minimumQuantity: string;
  tradeMode: string;
  defaultUnitPrice: string;
  canonicalUnitPrice: string;
  priceUnitQuantity: string;
  priceUnitLabel: string;
  totalAmount: string;
  currency: string;
  serverLabel?: string;
}) {
  const { t } = useCountryTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<InstantSaleResult | null>(null);
  const isGameMoneyRequest = category === "GAME_MONEY";
  const isSplitMode = tradeMode === "SPLIT";
  const isBulkMode = tradeMode === "BULK";
  const normalizedPriceUnitQuantity = isGameMoneyRequest
    ? normalizeGameMoneyPriceUnit(priceUnitQuantity)
    : "1";
  const displayDefaultQuantity = isGameMoneyRequest
    ? toGameMoneyDisplayQuantity(defaultQuantity, normalizedPriceUnitQuantity)
    : defaultQuantity;
  const displayMinimumQuantity = isGameMoneyRequest
    ? toGameMoneyDisplayQuantity(minimumQuantity, normalizedPriceUnitQuantity)
    : minimumQuantity;
  const [quantity, setQuantity] = useState(displayDefaultQuantity);
  const actualQuantity = isGameMoneyRequest && isGameMoneyDisplayQuantity(quantity)
    ? toGameMoneyActualQuantity(quantity, normalizedPriceUnitQuantity)
    : quantity;
  const actualQuantityLabel = isGameMoneyRequest
    ? `${quantity} x ${priceUnitLabel}`
    : actualQuantity;
  const displayDefaultQuantityLabel = isGameMoneyRequest
    ? `${displayDefaultQuantity} x ${priceUnitLabel}`
    : defaultQuantity;
  const displayMinimumQuantityLabel = isGameMoneyRequest
    ? `${displayMinimumQuantity} x ${priceUnitLabel}`
    : minimumQuantity;

  useEffect(() => {
    if (isBulkMode) {
      setQuantity(displayDefaultQuantity);
    }
  }, [displayDefaultQuantity, isBulkMode]);

  const quantityStatus = useMemo(() => {
    try {
      if (isGameMoneyRequest && !isGameMoneyDisplayQuantity(quantity)) {
        return {
          isValid: false,
          message: t("listingForm.selectedUnitQuantityInvalid"),
        };
      }

      const normalizedQuantity = parseFixedAmount(actualQuantity || "0");
      const normalizedMinimum = parseFixedAmount(minimumQuantity);
      const normalizedDefault = parseFixedAmount(defaultQuantity);

      if (normalizedQuantity <= 0n) {
        return { isValid: false, message: t("sale.quantityPositive") };
      }

      if (isBulkMode && normalizedQuantity !== normalizedDefault) {
        return {
          isValid: false,
          message: t("sale.bulkOnlyFullQuantity"),
        };
      }

      if (normalizedQuantity < normalizedMinimum) {
        return {
          isValid: false,
          message: formatMessage(t("sale.minimumQuantityMessage"), { quantity: displayMinimumQuantityLabel }),
        };
      }

      if (normalizedQuantity > normalizedDefault) {
        return {
          isValid: false,
          message: formatMessage(t("sale.availableQuantityMessage"), { quantity: displayDefaultQuantityLabel }),
        };
      }

      return { isValid: true, message: t("sale.quantityValid") };
    } catch {
      return { isValid: false, message: t("purchase.numberOnly") };
    }
  }, [
    actualQuantity,
    defaultQuantity,
    displayDefaultQuantity,
    displayDefaultQuantityLabel,
    displayMinimumQuantity,
    displayMinimumQuantityLabel,
    isBulkMode,
    isGameMoneyRequest,
    minimumQuantity,
    quantity,
  ]);

  const effectiveTotalAmount = useMemo(() => {
    if (!quantityStatus.isValid) {
      return "0";
    }

    try {
      const normalizedQuantity = parseFixedAmount(actualQuantity || "0");
      const normalizedUnitPrice = parseFixedAmount(canonicalUnitPrice);
      return formatFixedAmount((normalizedQuantity * normalizedUnitPrice) / FIXED_AMOUNT_SCALE);
    } catch {
      return totalAmount;
    }
  }, [actualQuantity, canonicalUnitPrice, quantityStatus.isValid, totalAmount]);

  async function submitInstantSale(input: { password: string; characterName: string }) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/market/buy-request-instant-sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyRequestId,
          quantity: actualQuantity,
          paymentPin: input.password,
          characterName: input.characterName,
        }),
      });
      const nextResult = (await response.json()) as InstantSaleResult;

      if (!response.ok) {
        throw new Error(nextResult.message || t("sale.failed"));
      }

      setResult(nextResult);
      setIsConfirmOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("sale.failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
      >
        {t("sale.instantSale")}
      </button>

      {isOpen ? (
        <div className="mt-3 grid gap-3 rounded-xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-bg)] p-3">
          <div className="grid gap-2 rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-sm">
            {isSplitMode ? (
              <label className="grid gap-1 text-xs font-black text-[var(--gg-muted)]">
                {t("sale.quantity")}
                <input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="numeric"
                  step={isGameMoneyRequest ? 1 : undefined}
                  placeholder={isGameMoneyRequest ? `${t("listingForm.exampleUnitQuantity")} = ${priceUnitLabel}` : undefined}
                  className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-black text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
                />
                <span className={quantityStatus.isValid ? "text-[var(--gg-accent)]" : "text-rose-500"}>
                  {quantityStatus.message}
                </span>
              </label>
            ) : (
              <SummaryRow label={t("sale.quantity")} value={displayDefaultQuantityLabel} />
            )}
            {isBulkMode ? (
              <p className="text-xs font-bold leading-5 text-[var(--gg-muted)]">
                {t("sale.bulkOnlyFullQuantity")}
              </p>
            ) : null}
            <SummaryRow label={t("listingForm.minimumSellQuantity")} value={displayMinimumQuantityLabel} />
            <SummaryRow label={t("sale.unitPrice")} value={`${defaultUnitPrice} ${currency} / ${priceUnitLabel}`} />
            <div className="flex items-center justify-between gap-3 border-t border-[var(--gg-border-soft)] pt-2">
              <span className="font-bold text-[var(--gg-muted)]">{t("sale.expectedTotal")}</span>
              <span className="font-black text-[var(--gg-accent)]">
                {effectiveTotalAmount} {currency}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[color-mix(in_srgb,var(--gg-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,transparent)] px-3 py-3 text-xs font-bold leading-5 text-[var(--gg-text)]">
            {t("sale.guide")}
          </div>

          {message ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-600">
              {message}
              <span className="mt-2 block">{t("sale.errorHint")}</span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isSubmitting || Boolean(result) || !quantityStatus.isValid}
            className="rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? t("sale.creating")
              : result
                ? t("sale.created")
                : t("sale.startOrderChat")}
          </button>

          {result ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-800">
              <p className="text-sm font-black">{t("sale.orderCreatedMessage")}</p>
              <p className="mt-1 text-emerald-700">
                {result.orderNumber ?? t("sale.orderFallback")} · {getInstantSaleStatusLabel(result.status)}
              </p>
              <p className="mt-2">{t("sale.successBody")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link
                  href={result.redirectHref || "/my/listings"}
                  className="rounded-lg border border-emerald-300 bg-[var(--gg-card-bg)] px-3 py-2 text-center text-xs font-black text-[var(--gg-text)] hover:bg-emerald-100"
                >
                  {t("sale.orderDetail")}
                </Link>
                {result.orderId ? (
                  <Link
                    href={`/my/listings/orders/${result.orderId}/chat`}
                    className="rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-center text-xs font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
                  >
                    {t("purchase.openChat")}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <TradeSafetyConfirmDialog
        isOpen={isConfirmOpen}
        eyebrow="SAFE ESCROW"
        title={t("sale.confirmTitle")}
        body={t("sale.confirmBody")}
        confirmLabel={t("sale.confirmLabel")}
        cancelLabel={t("common.cancel")}
        isSubmitting={isSubmitting}
        serverLabel={serverLabel}
        requireCharacterName
        characterNameLabel={t("listingForm.sellerGameNickname")}
        characterNamePlaceholder={t("listingForm.sellerGameNicknamePlaceholder")}
        summaryRows={[
          { label: String(t("sale.quantity")), value: actualQuantityLabel },
          { label: String(t("sale.unitPrice")), value: `${defaultUnitPrice} ${currency} / ${priceUnitLabel}` },
          { label: String(t("sale.expectedTotal")), value: `${effectiveTotalAmount} ${currency}` },
        ]}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={submitInstantSale}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold text-[var(--gg-muted)]">{label}</span>
      <span className="font-black text-[var(--gg-text)]">{value}</span>
    </div>
  );
}

function getInstantSaleStatusLabel(status?: string) {
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

  if (!status) {
    return <TranslatedStatus labelKey="orderStatus.orderCreating" />;
  }

  const key = labels[status];
  return key ? <TranslatedStatus labelKey={key} /> : status;
}

function TranslatedStatus({ labelKey }: { labelKey: TranslationKey }) {
  const { t } = useCountryTranslation();
  return <>{t(labelKey)}</>;
}

function formatMessage(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

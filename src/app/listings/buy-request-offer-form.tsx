"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";
import useCountryTranslation from "@/app/use-country-translation";
import type { TranslationKey } from "@/app/i18n";

type InstantSaleResult = {
  orderId?: string;
  orderNumber?: string;
  status?: string;
  redirectHref?: string;
  message?: string;
};

export default function BuyRequestOfferForm({
  buyRequestId,
  defaultQuantity,
  defaultUnitPrice,
  totalAmount,
  currency,
}: {
  buyRequestId: string;
  defaultQuantity: string;
  defaultUnitPrice: string;
  totalAmount: string;
  currency: string;
}) {
  const { t } = useCountryTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<InstantSaleResult | null>(null);

  async function submitInstantSale() {
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
        }),
      });
      const nextResult = (await response.json()) as InstantSaleResult;

      if (!response.ok) {
        throw new Error(
          nextResult.message || t("sale.failed"),
        );
      }

      setResult(nextResult);
      setIsConfirmOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("sale.failed"),
      );
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
            <SummaryRow label={t("sale.quantity")} value={defaultQuantity} />
            <SummaryRow label={t("sale.unitPrice")} value={`${defaultUnitPrice} ${currency}`} />
            <div className="flex items-center justify-between gap-3 border-t border-[var(--gg-border-soft)] pt-2">
              <span className="font-bold text-[var(--gg-muted)]">{t("sale.expectedTotal")}</span>
              <span className="font-black text-[var(--gg-accent)]">
                {totalAmount} {currency}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[color-mix(in_srgb,var(--gg-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,transparent)] px-3 py-3 text-xs font-bold leading-5 text-[var(--gg-text)]">
            {t("sale.guide")}
          </div>

          {message ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-600">
              {message}
              <span className="mt-2 block">
                {t("sale.errorHint")}
              </span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isSubmitting || Boolean(result)}
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
              <p className="mt-2">
                {t("sale.successBody")}
              </p>
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

      <ActionConfirmDialog
        isOpen={isConfirmOpen}
        eyebrow={t("sale.instantSale")}
        title={t("sale.confirmTitle")}
        body={t("sale.confirmBody")}
        confirmLabel={t("sale.confirmLabel")}
        cancelLabel={t("common.cancel")}
        isSubmitting={isSubmitting}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={submitInstantSale}
      >
        <div className="space-y-2 text-sm font-bold text-[var(--gg-muted)]">
          <SummaryRow label={t("sale.quantity")} value={defaultQuantity} />
          <SummaryRow label={t("sale.unitPrice")} value={`${defaultUnitPrice} ${currency}`} />
          <SummaryRow label={t("sale.expectedTotal")} value={`${totalAmount} ${currency}`} />
        </div>
      </ActionConfirmDialog>
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

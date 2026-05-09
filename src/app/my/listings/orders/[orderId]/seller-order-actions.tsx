"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

type SellerOrderActionsProps = {
  orderId: string;
  status: string;
};

type SellerOrderAction =
  | "START_DELIVERY"
  | "MARK_DELIVERED"
  | "REQUEST_BUYER_CONFIRM";

type SellerOrderActionResponse = {
  orderId: string;
  status: string;
  message: string;
};

export function SellerOrderActions({ orderId, status }: SellerOrderActionsProps) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<SellerOrderAction | null>(null);

  const canStartDelivery = status === "ESCROW_LOCKED" || status === "SELLER_RESPONSE_PENDING";
  const canMarkDelivered = status === "DELIVERY_IN_PROGRESS";
  const canRequestBuyerConfirm = status === "BUYER_CONFIRM_PENDING";

  if (!canStartDelivery && !canMarkDelivered && !canRequestBuyerConfirm) {
    return null;
  }

  async function runPendingAction() {
    if (!pendingAction) return;

    const action = pendingAction;
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/seller-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, action }),
      });
      const result = (await response.json()) as SellerOrderActionResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in result && result.message ? result.message : t("orderManage.updateFailed"));
      }

      setSuccess((result as SellerOrderActionResponse).message || t("common.confirm"));
      setPendingAction(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("orderManage.updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const dialog = pendingAction ? getActionDialog(pendingAction, t) : null;

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{t("orderManage.nextAction")}</h2>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--gg-accent)_14%,transparent)] px-3 py-1 text-xs font-black text-[var(--gg-accent)]">
          {t("orderManage.sellerRole")}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {canStartDelivery ? (
          <button
            type="button"
            onClick={() => setPendingAction("START_DELIVERY")}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:opacity-60"
          >
            {isSubmitting ? t("orderManage.processing") : t("orderManage.startDelivery")}
          </button>
        ) : null}

        {canMarkDelivered ? (
          <button
            type="button"
            onClick={() => setPendingAction("MARK_DELIVERED")}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:opacity-60"
          >
            {isSubmitting ? t("orderManage.processing") : t("orderManage.markDelivered")}
          </button>
        ) : null}

        {canRequestBuyerConfirm ? (
          <button
            type="button"
            onClick={() => setPendingAction("REQUEST_BUYER_CONFIRM")}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:opacity-60"
          >
            {isSubmitting ? t("orderManage.processing") : t("orderManage.requestBuyerConfirm")}
          </button>
        ) : null}
      </div>

      {success ? (
        <p className="mt-3 rounded-md bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-xs font-black text-red-800">
          {error}
        </p>
      ) : null}

      {dialog ? (
        <ActionConfirmDialog
          isOpen
          eyebrow={dialog.eyebrow}
          title={dialog.title}
          body={dialog.body}
          confirmLabel={dialog.confirmLabel}
          isSubmitting={isSubmitting}
          onCancel={() => setPendingAction(null)}
          onConfirm={runPendingAction}
        >
          <div className="space-y-2 text-sm font-bold text-[var(--gg-muted)]">
            {dialog.lines.map((line) => (
              <div key={line} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--gg-accent)]" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </ActionConfirmDialog>
      ) : null}
    </section>
  );
}

function getActionDialog(action: SellerOrderAction, t: ReturnType<typeof useCountryTranslation>["t"]) {
  if (action === "START_DELIVERY") {
    return {
      eyebrow: "DELIVERY",
      title: t("orderManage.startDeliveryTitle"),
      body: t("orderManage.startDeliveryBody"),
      confirmLabel: t("orderManage.startDelivery"),
      lines: [t("orderManage.startDeliveryLineA"), t("orderManage.startDeliveryLineB")],
    };
  }

  if (action === "MARK_DELIVERED") {
    return {
      eyebrow: "DELIVERED",
      title: t("orderManage.markDeliveredTitle"),
      body: t("orderManage.markDeliveredBody"),
      confirmLabel: t("orderManage.markDelivered"),
      lines: [t("orderManage.markDeliveredLineA"), t("orderManage.markDeliveredLineB")],
    };
  }

  return {
    eyebrow: "CONFIRM REQUEST",
    title: t("orderManage.requestConfirmTitle"),
    body: t("orderManage.requestConfirmBody"),
    confirmLabel: t("orderManage.requestConfirmLabel"),
    lines: [t("orderManage.requestConfirmLineA"), t("orderManage.requestConfirmLineB")],
  };
}

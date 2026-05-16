"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TranslationKey } from "@/app/i18n";
import useCountryTranslation from "@/app/use-country-translation";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

type OfferAction = "ACCEPT" | "REJECT";

type OfferActionPayload = {
  message?: string;
  messageKey?: TranslationKey;
};

export default function OfferActions({ offerId }: { offerId: string }) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [pendingAction, setPendingAction] = useState<OfferAction | null>(null);
  const [submittingAction, setSubmittingAction] = useState<OfferAction | null>(null);
  const [error, setError] = useState("");

  async function updateOffer() {
    if (!pendingAction) return;

    const action = pendingAction;
    setError("");
    setSubmittingAction(action);

    try {
      const response = await fetch("/api/market/buy-request-offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, action }),
      });
      const result = (await response.json()) as OfferActionPayload;

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "offerAction.statusFailed"));
      }

      setPendingAction(null);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("offerAction.statusFailed"),
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  const dialog = pendingAction ? getOfferDialog(pendingAction) : null;
  const isBusy = submittingAction !== null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => setPendingAction("ACCEPT")}
        className="rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-xs font-black text-[var(--gg-inverse-text)] disabled:opacity-60"
      >
        {submittingAction === "ACCEPT" ? t("offerAction.accepting") : t("offerAction.accept")}
      </button>
      <button
        type="button"
        disabled={isBusy}
        onClick={() => setPendingAction("REJECT")}
        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-60"
      >
        {submittingAction === "REJECT" ? t("offerAction.rejecting") : t("offerAction.reject")}
      </button>

      {error ? (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-xs font-black text-red-700">
          {error}
        </p>
      ) : null}

      {dialog ? (
        <ActionConfirmDialog
          isOpen
          eyebrow={t(dialog.eyebrowKey)}
          title={t(dialog.titleKey)}
          body={t(dialog.bodyKey)}
          confirmLabel={t(dialog.confirmLabelKey)}
          tone={dialog.tone}
          isSubmitting={isBusy}
          onCancel={() => setPendingAction(null)}
          onConfirm={updateOffer}
        />
      ) : null}
    </div>
  );
}

function getOfferDialog(action: OfferAction) {
  if (action === "ACCEPT") {
    return {
      eyebrowKey: "offerAction.acceptEyebrow",
      titleKey: "offerAction.acceptTitle",
      bodyKey: "offerAction.acceptBody",
      confirmLabelKey: "offerAction.acceptConfirm",
      tone: "primary" as const,
    } satisfies OfferDialog;
  }

  return {
    eyebrowKey: "offerAction.rejectEyebrow",
    titleKey: "offerAction.rejectTitle",
    bodyKey: "offerAction.rejectBody",
    confirmLabelKey: "offerAction.rejectConfirm",
    tone: "danger" as const,
  } satisfies OfferDialog;
}

type OfferDialog = {
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  confirmLabelKey: TranslationKey;
  tone: "primary" | "danger";
};

function getApiMessage(
  result: OfferActionPayload,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
) {
  return result.messageKey ? t(result.messageKey) : result.message ?? t(fallbackKey);
}

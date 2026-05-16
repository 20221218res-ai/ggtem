"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TranslationKey } from "@/app/i18n";
import useCountryTranslation from "@/app/use-country-translation";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

type BuyRequestActionPayload = {
  message?: string;
  messageKey?: TranslationKey;
};

export default function BuyRequestActions({
  buyRequestId,
  status,
}: {
  buyRequestId: string;
  status: string;
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  async function handleCancel() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/buy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "CANCEL", buyRequestId }),
      });
      const result = (await response.json()) as BuyRequestActionPayload;

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "buyRequestAction.cancelFailed"));
      }

      setIsConfirmOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("buyRequestAction.cancelFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== "ACTIVE") return null;

  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => setIsConfirmOpen(true)}
        className="rounded-xl bg-red-50 px-4 py-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-60"
      >
        {isSubmitting ? t("buyRequestAction.canceling") : t("buyRequestAction.cancel")}
      </button>

      {error ? (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">
          {error}
        </p>
      ) : null}

      <ActionConfirmDialog
        isOpen={isConfirmOpen}
        eyebrow={t("buyRequestAction.dialogEyebrow")}
        title={t("buyRequestAction.cancelTitle")}
        body={t("buyRequestAction.cancelBody")}
        confirmLabel={t("buyRequestAction.confirmCancel")}
        tone="danger"
        isSubmitting={isSubmitting}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleCancel}
      >
        <div className="space-y-2 text-sm font-bold text-[var(--gg-muted)]">
          <p>{t("buyRequestAction.cancelNoteActiveOnly")}</p>
          <p>{t("buyRequestAction.cancelNoteNoResume")}</p>
        </div>
      </ActionConfirmDialog>
    </div>
  );
}

function getApiMessage(
  result: BuyRequestActionPayload,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
) {
  return result.messageKey ? t(result.messageKey) : result.message ?? t(fallbackKey);
}

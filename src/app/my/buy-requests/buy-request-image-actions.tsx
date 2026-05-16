"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TranslationKey } from "@/app/i18n";
import useCountryTranslation from "@/app/use-country-translation";

type ApiResult = {
  message?: string;
  messageKey?: TranslationKey;
};

export default function BuyRequestImageActions({
  buyRequestId,
  imageId,
}: {
  buyRequestId: string;
  imageId: string;
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [isRemoving, setIsRemoving] = useState(false);
  const [message, setMessage] = useState("");

  async function removeImage() {
    if (isRemoving) return;

    setIsRemoving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/market/buy-request-images?buyRequestId=${encodeURIComponent(buyRequestId)}&imageId=${encodeURIComponent(imageId)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "listingEdit.imageRemoveFailed"));
      }

      setMessage(getApiMessage(result, t, "listingEdit.imageRemoveSuccess"));
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("listingEdit.imageRemoveFailed"),
      );
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="absolute inset-x-2 bottom-2">
      <button
        type="button"
        onClick={removeImage}
        disabled={isRemoving}
        className="w-full rounded-lg bg-white/95 px-2 py-1.5 text-xs font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRemoving ? t("listingEdit.removing") : t("listingEdit.imageRemove")}
      </button>
      {message ? (
        <p className="mt-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-[var(--gg-muted)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function getApiMessage(
  result: ApiResult,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
) {
  if (result.messageKey) {
    return t(result.messageKey);
  }

  return result.message || t(fallbackKey);
}

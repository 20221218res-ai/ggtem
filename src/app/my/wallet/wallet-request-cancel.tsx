"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CountryText from "../../country-text";
import useCountryTranslation from "../../use-country-translation";

export default function WalletRequestCancel({
  kind,
  requestId,
}: {
  kind: "DEPOSIT" | "WITHDRAWAL";
  requestId: string;
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCancel() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "CANCEL",
          kind,
          requestId,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? t("wallet.cancelFailed"));
      }

      router.refresh();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : t("wallet.cancelFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={() => void handleCancel()}
        disabled={isSubmitting}
        className="rounded-xl border border-red-400/30 bg-white/60 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <CountryText id="wallet.canceling" /> : <CountryText id="wallet.cancelRequest" />}
      </button>
      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

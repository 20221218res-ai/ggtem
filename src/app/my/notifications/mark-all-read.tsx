"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TranslationKey } from "@/app/i18n";
import useCountryTranslation from "@/app/use-country-translation";

export default function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function markAllRead() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "READ_ALL",
        }),
      });
      const result = (await response.json()) as { message?: string; messageKey?: TranslationKey };

      if (!response.ok) {
        throw new Error(
          result.messageKey ? t(result.messageKey) : result.message || t("notification.markFailed"),
        );
      }

      router.refresh();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : t("notification.markFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={markAllRead}
        disabled={disabled || isSubmitting}
        className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? t("notification.processing") : t("notification.markAllRead")}
      </button>
      {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
    </div>
  );
}

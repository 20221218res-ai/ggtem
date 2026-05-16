"use client";

import { useEffect, useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";

type PaymentPinStatus = {
  hasPaymentPin: boolean;
  paymentPinSetAt?: string | null;
};

function cleanPin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function PaymentPinSetupPanel() {
  const { t } = useCountryTranslation();
  const [status, setStatus] = useState<PaymentPinStatus | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/user/payment-pin", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(t("paymentPin.statusFailed"));
        }
        return (await response.json()) as PaymentPinStatus;
      })
      .then((result) => {
        if (!isMounted) return;
        setStatus(result);
      })
      .catch((statusError) => {
        if (!isMounted) return;
        setError(statusError instanceof Error ? statusError.message : t("paymentPin.statusFailed"));
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function submitPin() {
    setMessage("");
    setError("");

    if (!/^\d{4,6}$/.test(newPin)) {
      setError(t("paymentPin.newPinInvalid"));
      return;
    }

    if (newPin !== confirmPin) {
      setError(t("paymentPin.confirmMismatch"));
      return;
    }

    if (status?.hasPaymentPin && !/^\d{4,6}$/.test(currentPin)) {
      setError(t("paymentPin.currentPinInvalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/user/payment-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPaymentPin: status?.hasPaymentPin ? currentPin : undefined,
          paymentPin: newPin,
        }),
      });
      const result = (await response.json()) as {
        hasPaymentPin?: boolean;
        paymentPinSetAt?: string | null;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? t("paymentPin.saveFailed"));
      }

      setStatus({
        hasPaymentPin: true,
        paymentPinSetAt: result.paymentPinSetAt ?? new Date().toISOString(),
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setMessage(result.message ?? (status?.hasPaymentPin ? t("paymentPin.changed") : t("paymentPin.saved")));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("paymentPin.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id="payment-pin"
      className="rounded-2xl border border-[color-mix(in_srgb,var(--gg-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_7%,white)] p-5 shadow-sm shadow-[var(--gg-shadow)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">{t("paymentPin.eyebrow")}</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--gg-text)]">{t("paymentPin.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[var(--gg-muted)]">
            {t("paymentPin.description")}
          </p>
        </div>
        <span className="w-fit rounded-full border border-[var(--gg-border)] bg-white px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
          {isLoading ? t("paymentPin.statusChecking") : status?.hasPaymentPin ? t("paymentPin.statusSet") : t("paymentPin.statusMissing")}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {status?.hasPaymentPin ? (
          <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
            {t("paymentPin.currentPin")}
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={currentPin}
              onChange={(event) => {
                setCurrentPin(cleanPin(event.target.value));
                setError("");
              }}
              autoComplete="one-time-code"
              className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 font-bold outline-none focus:border-[var(--gg-accent)]"
              placeholder={t("paymentPin.currentPin")}
            />
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
          {t("paymentPin.newPin")}
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(event) => {
              setNewPin(cleanPin(event.target.value));
              setError("");
            }}
            autoComplete="new-password"
            className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 font-bold outline-none focus:border-[var(--gg-accent)]"
            placeholder={t("paymentPin.pinDigitsPlaceholder")}
          />
        </label>
        <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
          {t("paymentPin.confirmPin")}
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(event) => {
              setConfirmPin(cleanPin(event.target.value));
              setError("");
            }}
            autoComplete="new-password"
            className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 font-bold outline-none focus:border-[var(--gg-accent)]"
            placeholder={t("paymentPin.confirmPlaceholder")}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void submitPin()}
          disabled={isLoading || isSubmitting}
          className="h-12 rounded-xl bg-[var(--gg-accent)] px-6 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? t("paymentPin.saving") : status?.hasPaymentPin ? t("paymentPin.change") : t("paymentPin.set")}
        </button>
        <p className="text-xs font-bold text-[var(--gg-muted)]">
          {t("paymentPin.forgotNotice")}
        </p>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

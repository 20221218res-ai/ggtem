"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

type SummaryRow = {
  label: string;
  value: string;
};

type PaymentPinStatus = "idle" | "loading" | "set" | "missing" | "error";

type TradeSafetyConfirmDialogProps = {
  isOpen: boolean;
  eyebrow?: string;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  isSubmitting?: boolean;
  summaryRows?: SummaryRow[];
  serverLabel?: string;
  requireCharacterName?: boolean;
  characterNameLabel?: string;
  characterNamePlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  warningLabel?: string;
  paymentPinSetupHref?: string;
  onCancel: () => void;
  onConfirm: (input: { password: string; characterName: string }) => void;
};

export function TradeSafetyConfirmDialog({
  isOpen,
  eyebrow,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  isSubmitting = false,
  summaryRows = [],
  serverLabel,
  requireCharacterName = false,
  characterNameLabel,
  characterNamePlaceholder,
  passwordLabel,
  passwordPlaceholder,
  warningLabel,
  paymentPinSetupHref = "/my/wallet?action=payment-pin#payment-pin",
  onCancel,
  onConfirm,
}: TradeSafetyConfirmDialogProps) {
  const { t } = useCountryTranslation();
  const [paymentPin, setPaymentPin] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [isAcknowledged, setIsAcknowledged] = useState(true);
  const [error, setError] = useState("");
  const [pinStatus, setPinStatus] = useState<PaymentPinStatus>("idle");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPaymentPin("");
    setCharacterName("");
    setIsAcknowledged(true);
    setError("");
    setPinStatus("loading");

    let isMounted = true;

    fetch("/api/user/payment-pin", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(t("tradeSafety.paymentPinStatusCheckFailed"));
        }
        return (await response.json()) as { hasPaymentPin?: boolean };
      })
      .then((result) => {
        if (!isMounted) return;
        setPinStatus(result.hasPaymentPin ? "set" : "missing");
      })
      .catch(() => {
        if (!isMounted) return;
        setPinStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, t]);

  function confirm() {
    const trimmedPaymentPin = paymentPin.trim();
    const trimmedCharacterName = characterName.trim();
    const nextCharacterNameLabel = characterNameLabel ?? t("tradeSafety.characterName");

    if (pinStatus === "loading") {
      setError(t("tradeSafety.paymentPinChecking"));
      return;
    }

    if (pinStatus === "missing") {
      setError(t("tradeSafety.paymentPinMissing"));
      return;
    }

    if (pinStatus === "error") {
      setError(t("tradeSafety.paymentPinStatusError"));
      return;
    }

    if (!/^\d{4,6}$/.test(trimmedPaymentPin)) {
      setError(t("tradeSafety.paymentPinInvalid"));
      return;
    }

    if (requireCharacterName && !trimmedCharacterName) {
      setError(`${nextCharacterNameLabel}${t("tradeSafety.requiredSuffix")}`);
      return;
    }

    if (!isAcknowledged) {
      setError(t("tradeSafety.acknowledgeRequired"));
      return;
    }

    onConfirm({
      password: trimmedPaymentPin,
      characterName: trimmedCharacterName,
    });
  }

  return (
    <ActionConfirmDialog
      isOpen={isOpen}
      eyebrow={eyebrow ?? t("tradeSafety.safeTrade")}
      title={title}
      body={body}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={tone}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className="space-y-4">
        {serverLabel ? (
          <div className="rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-bg)] p-4 text-center">
            <p className="text-xs font-black text-[var(--gg-subtle)]">{t("tradeSafety.server")}</p>
            <p className="mt-2 inline-flex rounded-lg bg-[var(--gg-control-bg)] px-4 py-2 text-sm font-black text-[var(--gg-text)]">
              {serverLabel}
            </p>
          </div>
        ) : null}

        {summaryRows.length ? (
          <div className="space-y-2 text-sm font-bold text-[var(--gg-muted)]">
            {summaryRows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3">
                <span>{row.label}</span>
                <span className="font-black text-[var(--gg-text)]">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
          <p>{t("tradeSafety.gameIdNoticeA")}</p>
          <p className="mt-1">
            {t("tradeSafety.gameIdNoticeB")}
          </p>
        </div>

        {pinStatus === "missing" ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold leading-6 text-sky-900">
            <p className="font-black">{t("tradeSafety.paymentPinSetupRequired")}</p>
            <p>{t("tradeSafety.paymentPinSetupBody")}</p>
            <Link
              href={paymentPinSetupHref}
              className="mt-3 inline-flex rounded-xl bg-[var(--gg-accent)] px-4 py-2 text-xs font-black text-[var(--gg-inverse-text)]"
            >
              {t("tradeSafety.paymentPinSetupAction")}
            </Link>
          </div>
        ) : (
          <label className="block">
            <span className="text-xs font-black text-[var(--gg-text)]">{passwordLabel ?? t("tradeSafety.paymentPinLabel")}</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={paymentPin}
              onChange={(event) => {
                setPaymentPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              autoComplete="one-time-code"
              placeholder={pinStatus === "loading" ? t("tradeSafety.paymentPinLoadingPlaceholder") : passwordPlaceholder ?? t("tradeSafety.paymentPinPlaceholder")}
              disabled={pinStatus !== "set"}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>
        )}

        {requireCharacterName ? (
          <label className="block">
            <span className="text-xs font-black text-[var(--gg-text)]">{characterNameLabel ?? t("tradeSafety.characterName")}</span>
            <input
              value={characterName}
              onChange={(event) => {
                setCharacterName(event.target.value);
                setError("");
              }}
              placeholder={characterNamePlaceholder ?? t("tradeSafety.characterNamePlaceholder")}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
            />
          </label>
        ) : null}

        <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-black text-red-600">
          <input
            type="checkbox"
            checked={isAcknowledged}
            onChange={(event) => {
              setIsAcknowledged(event.target.checked);
              setError("");
            }}
            className="mt-1 h-4 w-4 accent-red-500"
          />
          <span>{warningLabel ?? t("tradeSafety.warningLabel")}</span>
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </ActionConfirmDialog>
  );
}

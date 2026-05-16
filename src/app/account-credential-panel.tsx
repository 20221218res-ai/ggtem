"use client";

import { useCallback, useEffect, useState } from "react";

import type { TranslationKey } from "./i18n";
import useCountryTranslation from "./use-country-translation";

type TFunction = (key: TranslationKey) => string;

type CredentialView = {
  exists: boolean;
  canSubmit: boolean;
  canReveal: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  buyerFirstViewedAt: string | null;
  buyerViewCount: number;
  accountId?: string;
  password?: string;
  note?: string | null;
};

type AccountCredentialPanelProps = {
  orderId: string;
  mode: "seller" | "buyer";
};

export default function AccountCredentialPanel({
  orderId,
  mode,
}: AccountCredentialPanelProps) {
  const { t } = useCountryTranslation();
  const [view, setView] = useState<CredentialView | null>(null);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loadCredential = useCallback(
    async (reveal: boolean) => {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          `/api/market/order-account-credentials?orderId=${encodeURIComponent(orderId)}${reveal ? "&reveal=1" : ""}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as CredentialView & {
          message?: string;
          messageKey?: TranslationKey;
        };

        if (!response.ok) {
          throw new Error(
            getApiMessage(data, t, "accountCredential.loadFailed"),
          );
        }

        setView(data);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : t("accountCredential.processingFailed"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orderId, t],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCredential(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCredential]);

  async function submitCredential() {
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/market/order-account-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          accountId,
          password,
          note,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        messageKey?: TranslationKey;
      };

      if (!response.ok) {
        throw new Error(getApiMessage(data, t, "accountCredential.saveFailed"));
      }

      setAccountId("");
      setPassword("");
      setNote("");
      setMessage(getApiMessage(data, t, "accountCredential.saveSuccess"));
      await loadCredential(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("accountCredential.processingFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copySecret(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(""), 1500);
    } catch {
      setMessage(t("accountCredential.copyFailed"));
    }
  }

  if (isLoading && !view) {
    return (
      <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
        <h2 className="text-lg font-black">{t("accountCredential.title")}</h2>
        <p className="mt-3 text-sm font-bold text-[var(--gg-muted)]">
          {t("accountCredential.loading")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">
            {t("accountCredential.eyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-black">
            {t("accountCredential.title")}
          </h2>
        </div>
        <span className="rounded-full bg-[var(--gg-control-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
          {view?.exists
            ? t("accountCredential.statusRegistered")
            : t("accountCredential.statusNotRegistered")}
        </span>
      </div>

      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-black leading-5 text-amber-800">
        {t("accountCredential.safetyNotice")}
      </p>

      {mode === "seller" ? (
        <SellerCredentialForm
          t={t}
          accountId={accountId}
          password={password}
          note={note}
          canSubmit={Boolean(view?.canSubmit)}
          exists={Boolean(view?.exists)}
          isSubmitting={isSubmitting}
          showPassword={showPassword}
          onAccountIdChange={setAccountId}
          onPasswordChange={setPassword}
          onNoteChange={setNote}
          onTogglePassword={() => setShowPassword((value) => !value)}
          onSubmit={submitCredential}
        />
      ) : (
        <BuyerCredentialView
          t={t}
          view={view}
          showPassword={showPassword}
          copiedField={copiedField}
          onTogglePassword={() => setShowPassword((value) => !value)}
          onReveal={() => loadCredential(true)}
          onCopy={copySecret}
        />
      )}

      {view?.updatedAt ? (
        <p className="mt-3 text-xs font-bold text-[var(--gg-muted)]">
          {t("accountCredential.updatedAtLabel")} {view.updatedAt}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl bg-[var(--gg-control-bg)] p-3 text-sm font-bold text-[var(--gg-text)]">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function SellerCredentialForm({
  t,
  accountId,
  password,
  note,
  canSubmit,
  exists,
  isSubmitting,
  showPassword,
  onAccountIdChange,
  onPasswordChange,
  onNoteChange,
  onTogglePassword,
  onSubmit,
}: {
  t: TFunction;
  accountId: string;
  password: string;
  note: string;
  canSubmit: boolean;
  exists: boolean;
  isSubmitting: boolean;
  showPassword: boolean;
  onAccountIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-5 space-y-3">
      <p className="text-xs font-bold leading-5 text-[var(--gg-muted)]">
        {t("accountCredential.sellerGuide")}
      </p>
      <input
        aria-label={t("accountCredential.accountLabel")}
        value={accountId}
        onChange={(event) => onAccountIdChange(event.target.value)}
        placeholder={t("accountCredential.accountIdPlaceholder")}
        className="w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-input-bg)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
        disabled={!canSubmit || isSubmitting}
      />
      <div className="relative">
        <input
          aria-label={t("accountCredential.passwordLabel")}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder={t("accountCredential.passwordPlaceholder")}
          type={showPassword ? "text" : "password"}
          className="w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-input-bg)] px-4 py-3 pr-20 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
          disabled={!canSubmit || isSubmitting}
        />
        <button
          type="button"
          aria-label={
            showPassword
              ? t("accountCredential.hide")
              : t("accountCredential.show")
          }
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--gg-muted)] hover:text-[var(--gg-accent)]"
        >
          {showPassword
            ? t("accountCredential.hide")
            : t("accountCredential.show")}
        </button>
      </div>
      <textarea
        aria-label={t("accountCredential.noteLabel")}
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder={t("accountCredential.notePlaceholder")}
        className="min-h-24 w-full resize-y rounded-xl border border-[var(--gg-border)] bg-[var(--gg-input-bg)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
        disabled={!canSubmit || isSubmitting}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
        className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? t("accountCredential.saving")
          : exists
            ? t("accountCredential.update")
            : t("accountCredential.register")}
      </button>
      {!canSubmit ? (
        <p className="text-xs font-bold text-[var(--gg-muted)]">
          {t("accountCredential.submitDisabled")}
        </p>
      ) : null}
    </div>
  );
}

function BuyerCredentialView({
  t,
  view,
  showPassword,
  copiedField,
  onTogglePassword,
  onReveal,
  onCopy,
}: {
  t: TFunction;
  view: CredentialView | null;
  showPassword: boolean;
  copiedField: string;
  onTogglePassword: () => void;
  onReveal: () => void;
  onCopy: (field: string, value: string) => void;
}) {
  return (
    <div className="mt-5 space-y-3">
      {!view?.exists ? (
        <p className="rounded-xl bg-[var(--gg-control-bg)] p-4 text-sm font-bold text-[var(--gg-muted)]">
          {t("accountCredential.notSubmittedYet")}
        </p>
      ) : null}

      {view?.accountId && view.password ? (
        <div className="space-y-2 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label={
                showPassword
                  ? t("accountCredential.hide")
                  : t("accountCredential.show")
              }
              onClick={onTogglePassword}
              className="rounded-full border border-[var(--gg-border)] px-3 py-1 text-xs font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              {t("accountCredential.passwordLabel")}{" "}
              {showPassword
                ? t("accountCredential.hide")
                : t("accountCredential.show")}
            </button>
          </div>
          <SecretRow
            t={t}
            label={t("accountCredential.accountLabel")}
            value={view.accountId}
            copied={copiedField === "accountId"}
            onCopy={() => onCopy("accountId", view.accountId ?? "")}
          />
          <SecretRow
            t={t}
            label={t("accountCredential.passwordLabel")}
            value={view.password}
            masked={!showPassword}
            copied={copiedField === "password"}
            onCopy={() => onCopy("password", view.password ?? "")}
          />
          {view.note ? (
            <SecretRow
              t={t}
              label={t("accountCredential.noteLabel")}
              value={view.note}
              copied={copiedField === "note"}
              onCopy={() => onCopy("note", view.note ?? "")}
            />
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          disabled={!view?.canReveal}
          className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("accountCredential.reveal")}
        </button>
      )}
      {!view?.canReveal && view?.exists ? (
        <p className="text-xs font-bold text-[var(--gg-muted)]">
          {t("accountCredential.revealDisabled")}
        </p>
      ) : null}
      <p className="text-xs font-bold leading-5 text-[var(--gg-muted)]">
        {t("accountCredential.viewCountLabel")} {view?.buyerViewCount ?? 0}
        {t("accountCredential.countSuffix")}
        {view?.buyerFirstViewedAt
          ? ` / ${t("accountCredential.firstViewedLabel")} ${view.buyerFirstViewedAt}`
          : ""}
        <br />
        {t("accountCredential.viewAuditNotice")}
      </p>
    </div>
  );
}

function SecretRow({
  t,
  label,
  value,
  masked = false,
  copied,
  onCopy,
}: {
  t: TFunction;
  label: string;
  value: string;
  masked?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const displayValue = masked
    ? "*".repeat(Math.min(Math.max(value.length, 6), 12))
    : value;

  return (
    <div>
      <p className="text-xs font-black text-[var(--gg-muted)]">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-lg bg-[var(--gg-card-bg)] px-3 py-2">
        <p className="min-w-0 flex-1 break-all text-sm font-black">
          {displayValue}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-full border border-[var(--gg-border)] px-3 py-1 text-xs font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
        >
          {copied
            ? t("accountCredential.copied")
            : t("accountCredential.copy")}
        </button>
      </div>
    </div>
  );
}

function getApiMessage(
  result: { message?: string; messageKey?: TranslationKey },
  t: TFunction,
  fallbackKey: TranslationKey,
) {
  return result.messageKey ? t(result.messageKey) : result.message ?? t(fallbackKey);
}

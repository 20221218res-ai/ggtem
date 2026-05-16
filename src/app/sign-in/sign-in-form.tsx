"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Field,
  TextInput,
} from "@/components/ui";
import PasswordVisibilityInput from "@/components/password-visibility-input";
import CountryText from "../country-text";
import useCountryTranslation from "../use-country-translation";
import { getAuthApiMessage } from "../auth-api-message";

type DemoAccount = {
  email: string;
  password: string;
  displayName: string;
  role: string;
};

const EMAIL_VERIFICATION_POLL_INTERVAL_MS = 5_000;

export default function SignInForm({ accounts }: { accounts: DemoAccount[] }) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [email, setEmail] = useState(accounts[0]?.email ?? "");
  const [password, setPassword] = useState(accounts[0]?.password ?? "");
  const [error, setError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState<{
    email: string;
    verificationUrl: string | null;
  } | null>(null);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!verificationNotice) return;

    let isActive = true;

    async function checkVerificationStatus() {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const response = await fetch("/api/auth/email-verification/status", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          code?: string;
          status?: string;
          redirectPath?: string;
          message?: string;
        };

        if (!isActive) return;

        if (result.status === "verified") {
          setResendMessage(t("auth.emailVerificationCompletedSignIn"));
          setVerificationNotice(null);
          router.replace(result.redirectPath ?? "/my");
          router.refresh();
        } else if (result.status === "blocked") {
          setError(getAuthApiMessage(result, t, "auth.accountUnavailable"));
          setVerificationNotice(null);
        } else if (result.status === "expired") {
          setResendError(t("auth.emailVerificationExpired"));
          setVerificationNotice(null);
        }
      } catch {
        // Temporary polling failures should not interrupt the sign-in flow.
      }
    }

    void checkVerificationStatus();
    const timer = window.setInterval(
      () => void checkVerificationStatus(),
      EMAIL_VERIFICATION_POLL_INTERVAL_MS,
    );

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, [router, verificationNotice]);

  async function resendVerificationEmail() {
    if (!verificationNotice) return;

    setResendMessage("");
    setResendError("");
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/email-verification/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: verificationNotice.email,
        }),
      });
      const result = (await response.json()) as {
        code?: string;
        message?: string;
        verificationUrl?: string | null;
      };

      if (!response.ok) {
        throw new Error(getAuthApiMessage(result, t, "auth.resendVerificationFailed"));
      }

      setResendMessage(getAuthApiMessage(result, t, "auth.resendVerificationSent"));
      setVerificationNotice({
        email: verificationNotice.email,
        verificationUrl: result.verificationUrl ?? null,
      });
    } catch (submitError) {
      setResendError(
        submitError instanceof Error
          ? submitError.message
          : t("auth.resendVerificationFailed"),
      );
    } finally {
      setIsResending(false);
    }
  }

  async function signIn(
    nextEmail: string,
    nextPassword: string,
    redirectPath?: string,
  ) {
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: nextEmail,
        password: nextPassword,
        surface: "market",
      }),
    });
    const result = (await response.json()) as {
      code?: string;
      email?: string;
      message?: string;
      redirectPath?: string;
      verificationUrl?: string | null;
    };

    if (!response.ok) {
      if (result.code === "EMAIL_VERIFICATION_REQUIRED") {
        setVerificationNotice({
          email: result.email ?? nextEmail,
          verificationUrl: result.verificationUrl ?? null,
        });
        return;
      }

      throw new Error(getAuthApiMessage(result, t, "auth.signInFailed"));
    }

    router.push(redirectPath ?? result.redirectPath ?? "/");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResendMessage("");
    setResendError("");
    setVerificationNotice(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("auth.signInFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickSignIn(redirectPath: string) {
    const account = accounts[0];

    if (!account) {
      setError(t("auth.noTestAccount"));
      return;
    }

    setEmail(account.email);
    setPassword(account.password);
    setError("");
    setResendMessage("");
    setResendError("");
    setVerificationNotice(null);
    setIsSubmitting(true);

    try {
      await signIn(account.email, account.password, redirectPath);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("auth.testSignInFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-xl shadow-[var(--gg-shadow)] sm:p-8"
      >
        <div className="text-center">
          <p className="text-sm font-black text-[var(--gg-accent)]">
            <CountryText id="auth.emailLoginEyebrow" />
          </p>
          <h2 className="mt-2 text-2xl font-black text-[var(--gg-text)]">
            <CountryText id="auth.emailLogin" />
          </h2>
        </div>

        <div className="mt-7 grid gap-4">
          <Field label={<span className="sr-only"><CountryText id="auth.email" /></span>}>
            <TextInput
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder={t("auth.email")}
              className="h-14 px-5 text-base font-bold"
            />
          </Field>

          <Field label={<span className="sr-only"><CountryText id="auth.password" /></span>}>
            <PasswordVisibilityInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={t("auth.password")}
              className="h-14 px-5 text-base font-bold"
            />
          </Field>
        </div>

        <div className="mt-6 grid gap-3">
          <Button type="submit" disabled={isSubmitting} className="h-14 w-full text-lg font-black">
            {isSubmitting ? <CountryText id="auth.signingIn" /> : <CountryText id="common.signIn" />}
          </Button>
          <Link
            href="/sign-up"
            className="inline-flex h-14 w-full items-center justify-center rounded-lg border border-[var(--gg-accent)] bg-white px-4 text-lg font-black text-[var(--gg-accent)] transition hover:bg-[color-mix(in_srgb,var(--gg-accent)_7%,white)]"
          >
            <CountryText id="common.signUp" />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 text-sm font-black text-[var(--gg-text)]">
            <Link href="/email-recovery" className="hover:text-[var(--gg-accent)]">
              <CountryText id="auth.emailRecoveryTitle" />
            </Link>
            <span className="text-[var(--gg-border)]">|</span>
            <Link href="/password-reset" className="hover:text-[var(--gg-accent)]">
              <CountryText id="auth.forgotPassword" />
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        {resendMessage && !verificationNotice ? (
          <div className="mt-4">
            <Alert tone="success">{resendMessage}</Alert>
          </div>
        ) : null}
      </form>

      <section className="rounded-xl bg-transparent px-2 py-3 text-center">
        <img
          src="/brand/minor-19.png"
          alt=""
          aria-hidden="true"
          className="mx-auto h-48 w-48 rounded-full object-cover"
        />
        <p className="mx-auto mt-6 max-w-[520px] text-left text-base font-black leading-7 text-slate-950 sm:text-center">
          <CountryText id="auth.minorRestrictionNotice" />
        </p>
        <a
          href="https://www.google.com"
          className="mt-7 inline-flex h-14 w-full items-center justify-center rounded-lg border border-red-500 bg-white px-4 text-lg font-black text-red-500 transition hover:bg-red-50"
        >
          <CountryText id="auth.minorExit" />
        </a>
      </section>

      {verificationNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase text-[var(--gg-accent)]">
              <CountryText id="auth.emailVerification" />
            </p>
            <h2 className="mt-2 text-2xl font-black text-[var(--gg-text)]">
              <CountryText id="auth.emailVerificationRequiredTitle" />
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--gg-muted)]">
              <CountryText
                id="auth.emailVerificationSentDescription"
                values={{ email: verificationNotice.email }}
              />
            </p>
            <div className="mt-5 rounded-xl bg-[var(--gg-card-soft-bg)] p-4 text-sm font-semibold text-[var(--gg-text)]">
              <CountryText id="auth.verificationChecking" />
            </div>
            {resendMessage ? (
              <div className="mt-4">
                <Alert tone="success">{resendMessage}</Alert>
              </div>
            ) : null}
            {resendError ? (
              <div className="mt-4">
                <Alert tone="danger">{resendError}</Alert>
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                tone="secondary"
                disabled={isResending}
                onClick={() => void resendVerificationEmail()}
              >
                {isResending ? (
                  <CountryText id="auth.resendingVerification" />
                ) : (
                  <CountryText id="auth.resendVerificationEmail" />
                )}
              </Button>
              {verificationNotice.verificationUrl ? (
                <Link
                  href={verificationNotice.verificationUrl}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 py-2 text-sm font-semibold text-[var(--gg-text)] transition hover:border-[var(--gg-accent)]"
                >
                  <CountryText id="auth.openVerificationLink" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {accounts.length > 0 ? (
        <details className="rounded-xl border border-dashed border-[var(--gg-border)] bg-white p-4">
          <summary className="cursor-pointer text-sm font-black text-[var(--gg-muted)]">
            <CountryText id="auth.quickLogin" />
          </summary>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => void handleQuickSignIn("/my/orders")}
              disabled={isSubmitting}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4 text-left transition hover:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-semibold text-[var(--gg-text)]">
                <CountryText id="auth.buyerOrderTest" />
              </span>
              <span className="mt-1 block text-sm text-[var(--gg-muted)]">
                <CountryText id="auth.buyerOrderTestDescription" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleQuickSignIn("/my/listings")}
              disabled={isSubmitting}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4 text-left transition hover:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-semibold text-[var(--gg-text)]">
                <CountryText id="auth.sellerManageTest" />
              </span>
              <span className="mt-1 block text-sm text-[var(--gg-muted)]">
                <CountryText id="auth.sellerManageTestDescription" />
              </span>
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
                className="w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4 text-left transition hover:border-[var(--gg-accent)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--gg-text)]">
                    {account.displayName}
                  </span>
                  <span className="rounded-md bg-[var(--gg-card-soft-bg)] px-2 py-1 text-xs font-semibold text-[var(--gg-muted)]">
                    <CountryText id="auth.select" />
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--gg-muted)]">
                  {account.email}
                </p>
                <p className="mt-1 text-xs text-[var(--gg-subtle)]">
                  <CountryText id="auth.password" />: {account.password}
                </p>
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

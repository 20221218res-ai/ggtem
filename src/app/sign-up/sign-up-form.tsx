"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeading,
  Field,
  TextInput,
} from "@/components/ui";
import PasswordVisibilityInput from "@/components/password-visibility-input";
import CountryText from "../country-text";
import useCountryTranslation from "../use-country-translation";
import { getAuthApiMessage } from "../auth-api-message";

const EMAIL_VERIFICATION_POLL_INTERVAL_MS = 5_000;

export default function SignUpForm() {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!pendingVerificationEmail) return;

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
          setMessage(t("auth.emailVerificationCompletedSignIn"));
          setPendingVerificationEmail("");
          router.replace(result.redirectPath ?? "/my/payment-pin/setup");
          router.refresh();
        } else if (result.status === "blocked") {
          setError(getAuthApiMessage(result, t, "auth.accountUnavailable"));
          setPendingVerificationEmail("");
        } else if (result.status === "expired") {
          setResendError(t("auth.emailVerificationExpired"));
          setPendingVerificationEmail("");
        }
      } catch {
        // Temporary polling failures should not interrupt the sign-up flow.
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
  }, [pendingVerificationEmail, router, t]);

  async function resendVerificationEmail() {
    if (!pendingVerificationEmail) return;

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
          email: pendingVerificationEmail,
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
      setVerificationUrl(result.verificationUrl ?? null);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setResendMessage("");
    setResendError("");
    setVerificationUrl(null);

    if (password !== passwordConfirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          email,
          password,
        }),
      });
      const result = (await response.json()) as {
        code?: string;
        message?: string;
        verificationUrl?: string | null;
      };

      if (!response.ok) {
        throw new Error(getAuthApiMessage(result, t, "auth.signUpFailed"));
      }

      setMessage(getAuthApiMessage(result, t, "auth.signUpCompleted"));
      setVerificationUrl(result.verificationUrl ?? null);
      setPendingVerificationEmail(email);
      setPassword("");
      setPasswordConfirm("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("auth.signUpFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-lg shadow-[var(--gg-shadow)]"
      >
        <CardHeading
          eyebrow={<CountryText id="auth.createAccountEyebrow" />}
          title={<CountryText id="auth.createAccount" />}
          description={<CountryText id="auth.createAccountDescription" />}
        />

        <div className="mt-5 grid gap-4">
          <Field label={<CountryText id="auth.nickname" />}>
            <TextInput
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
            />
          </Field>

          <Field label={<CountryText id="auth.email" />}>
            <TextInput
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </Field>

          <Field label={<CountryText id="auth.password" />}>
            <PasswordVisibilityInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </Field>

          <Field label={<CountryText id="auth.passwordConfirm" />}>
            <PasswordVisibilityInput
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>

        <Button type="submit" disabled={isSubmitting} className="mt-5">
          {isSubmitting ? <CountryText id="auth.signingUp" /> : <CountryText id="common.signUp" />}
        </Button>

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 space-y-3">
            <Alert tone="success">{message}</Alert>
            {verificationUrl ? (
              <ButtonLink href={verificationUrl} tone="secondary">
                <CountryText id="auth.openVerificationLink" />
              </ButtonLink>
            ) : null}
          </div>
        ) : null}
      </form>

      {pendingVerificationEmail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase text-[var(--gg-accent)]">
              <CountryText id="auth.emailVerification" />
            </p>
            <h2 className="mt-2 text-2xl font-black text-[var(--gg-text)]">
              <CountryText id="auth.checkVerificationEmailTitle" />
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--gg-muted)]">
              <CountryText
                id="auth.emailVerificationSentDescription"
                values={{ email: pendingVerificationEmail }}
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
              {verificationUrl ? (
                <ButtonLink href={verificationUrl} tone="secondary">
                  <CountryText id="auth.openVerificationLink" />
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeading
          eyebrow={<CountryText id="auth.afterSignUpEyebrow" />}
          title={<CountryText id="auth.afterSignUpTitle" />}
          description={<CountryText id="auth.afterSignUpDescription" />}
        />
        <div className="mt-5 space-y-3 text-sm leading-6 text-[var(--gg-muted)]">
          <p><CountryText id="auth.normalAccountStart" /></p>
          <p><CountryText id="auth.sellAndBuySameAccount" /></p>
          <p><CountryText id="auth.walletEscrowManaged" /></p>
        </div>

        <Link
          href="/sign-in"
          className="mt-5 inline-flex text-sm font-semibold text-[var(--gg-accent)] hover:opacity-80"
        >
          <CountryText id="auth.alreadyHaveAccount" />
        </Link>
      </Card>
    </div>
  );
}

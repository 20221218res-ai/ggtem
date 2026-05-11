"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardHeading,
  Field,
  TextInput,
} from "@/components/ui";
import PasswordVisibilityInput from "@/components/password-visibility-input";
import CountryText from "../country-text";
import useCountryTranslation from "../use-country-translation";

type DemoAccount = {
  email: string;
  password: string;
  displayName: string;
  role: string;
};

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
    if (!verificationNotice) {
      return;
    }

    let isActive = true;

    async function checkVerificationStatus() {
      try {
        const response = await fetch("/api/auth/email-verification/status", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          status?: string;
          redirectPath?: string;
          message?: string;
        };

        if (!isActive) {
          return;
        }

        if (result.status === "verified") {
          router.replace(result.redirectPath ?? "/my");
          router.refresh();
        } else if (result.status === "blocked") {
          setError(result.message ?? "현재 사용할 수 없는 계정입니다.");
          setVerificationNotice(null);
        } else if (result.status === "expired") {
          setResendError("인증 대기 시간이 만료되었습니다. 다시 로그인하거나 인증 메일을 재발송해 주세요.");
          setVerificationNotice(null);
        }
      } catch {
        // Temporary polling failures should not interrupt the sign-in flow.
      }
    }

    void checkVerificationStatus();
    const timer = window.setInterval(() => void checkVerificationStatus(), 3000);

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, [router, verificationNotice]);

  async function resendVerificationEmail() {
    if (!verificationNotice) {
      return;
    }

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
        message?: string;
        verificationUrl?: string | null;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "인증 메일을 다시 보내지 못했습니다.");
      }

      setResendMessage(result.message ?? "인증 메일을 다시 발송했습니다.");
      setVerificationNotice({
        email: verificationNotice.email,
        verificationUrl: result.verificationUrl ?? null,
      });
    } catch (submitError) {
      setResendError(
        submitError instanceof Error
          ? submitError.message
          : "인증 메일을 다시 보내지 못했습니다.",
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

      throw new Error(result.message ?? t("auth.signInFailed"));
    }

    router.push(redirectPath ?? result.redirectPath ?? "/");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-lg shadow-[var(--gg-shadow)]"
      >
        <CardHeading
          eyebrow={<CountryText id="auth.emailLoginEyebrow" />}
          title={<CountryText id="auth.emailLogin" />}
          description={<CountryText id="auth.emailLoginDescription" />}
        />

        <div className="mt-5 grid gap-4">
          <Field label={<CountryText id="auth.email" />}>
            <TextInput
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </Field>

          <Field label={<CountryText id="auth.password" />}>
            <PasswordVisibilityInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <CountryText id="auth.signingIn" /> : <CountryText id="common.signIn" />}
          </Button>
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-[var(--gg-accent)]">
            <Link href="/password-reset" className="hover:opacity-80">
              <CountryText id="auth.forgotPassword" />
            </Link>
            <Link href="/email-recovery" className="hover:opacity-80">
              이메일 찾기
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
      </form>

      {verificationNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase text-[var(--gg-accent)]">
              Email verification
            </p>
            <h2 className="mt-2 text-2xl font-black text-[var(--gg-text)]">
              이메일 인증이 필요합니다
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--gg-muted)]">
              {verificationNotice.email} 주소로 인증 링크를 발송했습니다. 휴대폰에서
              인증해도 이 PC 화면에서 자동으로 로그인 완료를 확인합니다.
            </p>
            <div className="mt-5 rounded-xl bg-[var(--gg-card-soft-bg)] p-4 text-sm font-semibold text-[var(--gg-text)]">
              인증 완료 여부를 확인하는 중입니다...
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
                {isResending ? "재발송 중" : "인증 메일 다시 보내기"}
              </Button>
              {verificationNotice.verificationUrl ? (
                <Link
                  href={verificationNotice.verificationUrl}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 py-2 text-sm font-semibold text-[var(--gg-text)] transition hover:border-[var(--gg-accent)]"
                >
                  인증 링크 열기
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {accounts.length > 0 ? (
        <Card>
          <CardHeading
            eyebrow={<CountryText id="auth.testAccount" />}
            title={<CountryText id="auth.quickLogin" />}
            description={<CountryText id="auth.quickLoginDescription" />}
          />

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
        </Card>
      ) : null}
    </div>
  );
}

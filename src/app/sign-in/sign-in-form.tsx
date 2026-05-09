"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardHeading,
  Field,
  TextInput,
} from "@/components/ui";
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      message?: string;
      redirectPath?: string;
    };

    if (!response.ok) {
      throw new Error(result.message ?? t("auth.signInFailed"));
    }

    router.push(redirectPath ?? result.redirectPath ?? "/");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
            <TextInput
              type="password"
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
          <Link
            href="/password-reset"
            className="text-sm font-semibold text-[var(--gg-accent)] hover:opacity-80"
          >
            <CountryText id="auth.forgotPassword" />
          </Link>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
      </form>

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

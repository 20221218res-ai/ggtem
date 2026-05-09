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

export default function SignUpForm() {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
        message?: string;
        verificationUrl?: string | null;
      };

      if (!response.ok) {
        throw new Error(result.message ?? t("auth.signUpFailed"));
      }

      router.push("/");
      router.refresh();
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
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
      </form>

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

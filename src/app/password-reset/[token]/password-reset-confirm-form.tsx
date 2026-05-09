"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Alert, Button, CardHeading, Field, TextInput } from "@/components/ui";
import CountryText from "../../country-text";
import useCountryTranslation from "../../use-country-translation";

export default function PasswordResetConfirmForm({ token }: { token: string }) {
  const { t } = useCountryTranslation();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? t("auth.passwordChangeFailed"));
      }

      setMessage(result.message ?? t("auth.passwordChanged"));
      setPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth.passwordChangeFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-lg shadow-[var(--gg-shadow)]"
    >
      <CardHeading
        eyebrow={<CountryText id="auth.accountRecovery" />}
        title={<CountryText id="auth.newPasswordTitle" />}
        description={<CountryText id="auth.newPasswordHelp" />}
      />
      <div className="mt-5">
        <Field label={<CountryText id="auth.newPassword" />}>
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <Button type="submit" disabled={isSubmitting} className="mt-5">
        {isSubmitting ? <CountryText id="auth.passwordChanging" /> : <CountryText id="auth.passwordChange" />}
      </Button>
      {message ? (
        <div className="mt-4">
          <Alert tone="success">
            <p>{message}</p>
            <Link href="/sign-in" className="mt-2 inline-flex font-semibold underline underline-offset-4">
              <CountryText id="auth.signInNow" />
            </Link>
          </Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </form>
  );
}

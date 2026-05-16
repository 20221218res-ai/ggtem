"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Alert, Button, CardHeading, Field } from "@/components/ui";
import PasswordVisibilityInput from "@/components/password-visibility-input";
import CountryText from "../../country-text";
import useCountryTranslation from "../../use-country-translation";
import { getAuthApiMessage } from "../../auth-api-message";

export default function PasswordResetConfirmForm({ token }: { token: string }) {
  const { t } = useCountryTranslation();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (password !== passwordConfirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });
      const result = (await response.json()) as { code?: string; message?: string };

      if (!response.ok) {
        throw new Error(getAuthApiMessage(result, t, "auth.passwordChangeFailed"));
      }

      setMessage(getAuthApiMessage(result, t, "auth.passwordChanged"));
      setPassword("");
      setPasswordConfirm("");
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
          <PasswordVisibilityInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <div className="mt-4">
          <Field label={<CountryText id="auth.passwordConfirm" />}>
            <PasswordVisibilityInput
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
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

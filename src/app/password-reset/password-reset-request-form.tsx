"use client";

import { FormEvent, useState } from "react";
import {
  Alert,
  Button,
  ButtonLink,
  CardHeading,
  Field,
  TextInput,
} from "@/components/ui";
import CountryText from "../country-text";
import useCountryTranslation from "../use-country-translation";

export default function PasswordResetRequestForm() {
  const { t } = useCountryTranslation();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setResetUrl(null);
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as {
        message?: string;
        resetUrl?: string | null;
      };

      if (!response.ok) {
        throw new Error(result.message ?? t("auth.resetLinkFailed"));
      }

      setMessage(result.message ?? t("auth.resetLinkCreated"));
      setResetUrl(result.resetUrl ?? null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth.resetLinkFailed"));
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
        title={<CountryText id="auth.resetLinkTitle" />}
        description={<CountryText id="auth.resetLinkDescription" />}
      />
      <div className="mt-5">
        <Field label={<CountryText id="auth.email" />}>
          <TextInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </Field>
      </div>
      <Button type="submit" disabled={isSubmitting} className="mt-5">
        {isSubmitting ? <CountryText id="auth.resetLinkCreating" /> : <CountryText id="auth.resetLinkCreate" />}
      </Button>
      {message ? (
        <div className="mt-4">
          <Alert tone="success">{message}</Alert>
        </div>
      ) : null}
      {resetUrl ? (
        <div className="mt-3">
          <ButtonLink href={resetUrl} tone="secondary">
            <CountryText id="auth.resetLinkOpen" />
          </ButtonLink>
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

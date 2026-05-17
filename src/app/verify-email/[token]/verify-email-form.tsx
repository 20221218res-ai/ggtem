"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardHeading } from "@/components/ui";
import CountryText from "../../country-text";
import useCountryTranslation from "../../use-country-translation";
import { getAuthApiMessage } from "../../auth-api-message";

export default function VerifyEmailForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [redirectPath, setRedirectPath] = useState("/my/payment-pin/setup");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const didAutoSubmit = useRef(false);

  const submit = useCallback(async () => {
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/email-verification/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as {
        code?: string;
        message?: string;
        redirectPath?: string;
      };

      if (!response.ok) {
        throw new Error(getAuthApiMessage(result, t, "auth.verifyEmailFailed"));
      }

      setMessage(getAuthApiMessage(result, t, "auth.verifyEmailCompleted"));
      setRedirectPath(result.redirectPath ?? "/my/payment-pin/setup");
      setTimeout(() => {
        router.replace(result.redirectPath ?? "/my/payment-pin/setup");
        router.refresh();
      }, 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth.verifyEmailFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }, [router, t, token]);

  useEffect(() => {
    if (didAutoSubmit.current) {
      return;
    }

    didAutoSubmit.current = true;
    void submit();
  }, [submit]);

  return (
    <Card>
      <CardHeading
        eyebrow={<CountryText id="auth.emailVerification" />}
        title={<CountryText id="auth.verifyEmailTitle" />}
        description={<CountryText id="auth.verifyEmailHelp" />}
      />
      <Button type="button" onClick={() => void submit()} disabled={isSubmitting} className="mt-5">
        {isSubmitting ? <CountryText id="auth.verifyingEmail" /> : <CountryText id="auth.verifyEmail" />}
      </Button>
      {message ? (
        <div className="mt-4">
          <Alert tone="success">
            <p>{message}</p>
            <Link href={redirectPath} className="mt-2 inline-flex font-semibold underline underline-offset-4">
              <CountryText id="paymentPin.set" />
            </Link>
          </Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}

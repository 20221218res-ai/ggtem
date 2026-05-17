"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, TextInput } from "@/components/ui";

type SignInResult = {
  code?: string;
  message?: string;
  redirectPath?: string;
  challengeToken?: string;
};

export default function AdminSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOtpStep = Boolean(challengeToken);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        isOtpStep ? "/api/auth/admin-mfa/confirm" : "/api/auth/sign-in",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isOtpStep
              ? {
                  challengeToken,
                  code: otpCode,
                }
              : {
                  email,
                  password,
                  surface: "admin",
                },
          ),
        },
      );
      const result = (await response.json()) as SignInResult;

      if (!response.ok) {
        throw new Error(result.message ?? "로그인에 실패했습니다.");
      }

      if (result.code === "AUTH_ADMIN_MFA_REQUIRED" && result.challengeToken) {
        setChallengeToken(result.challengeToken);
        setNotice(result.message ?? "관리자 인증번호를 이메일로 보냈습니다.");
        setOtpCode("");
        return;
      }

      router.push(result.redirectPath ?? "/admin");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "로그인에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetOtpStep() {
    setChallengeToken("");
    setOtpCode("");
    setNotice("");
    setError("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/80"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">
          {isOtpStep ? "관리자 인증" : "로그인"}
        </h1>
      </div>

      {!isOtpStep ? (
        <div className="grid gap-4">
          <Field label="이메일">
            <TextInput
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </Field>

          <Field label="비밀번호">
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4">
          <Field label="이메일 인증번호">
            <TextInput
              value={otpCode}
              onChange={(event) =>
                setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6자리 숫자"
            />
          </Field>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isOtpStep
              ? "인증 중..."
              : "로그인 중..."
            : isOtpStep
              ? "인증 완료"
              : "로그인"}
        </Button>
        {isOtpStep ? (
          <button
            type="button"
            onClick={resetOtpStep}
            className="text-sm font-semibold text-sky-700 hover:text-sky-600"
          >
            다시 로그인
          </button>
        ) : (
          <Link
            href="/password-reset"
            className="text-sm font-semibold text-sky-700 hover:text-sky-600"
          >
            비밀번호 재설정
          </Link>
        )}
      </div>

      {notice ? (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
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

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Field, TextInput } from "@/components/ui";

export default function AdminSignInForm({
  accounts,
}: {
  accounts: Array<{
    email: string;
    password: string;
    displayName: string;
    role: string;
  }>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(accounts[0]?.email ?? "");
  const [password, setPassword] = useState(accounts[0]?.password ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          surface: "admin",
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        redirectPath?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "관리자 로그인에 실패했습니다.");
      }

      router.push(result.redirectPath ?? "/admin");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "관리자 로그인에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5">
          <p className="text-sm font-black text-slate-500">운영자 로그인</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">
            이메일과 비밀번호 입력
          </h3>
        </div>

        <div className="grid gap-4">
          <Field label="운영자 이메일">
            <TextInput
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
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

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "관리자 로그인 중..." : "관리자 로그인"}
          </Button>
          <Link
            href="/password-reset"
            className="text-sm font-semibold text-sky-700 hover:text-sky-600"
          >
            비밀번호 재설정
          </Link>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-black text-slate-500">개발 확인용</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            관리자 테스트 계정
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            일반 유저 로그인 화면에는 표시되지 않는 운영자 전용 테스트 계정입니다.
          </p>
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
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-950">
                  {account.displayName}
                </span>
                <Badge>{formatAdminRoleLabel(account.role)}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">{account.email}</p>
              <p className="mt-1 text-xs text-slate-500">
                비밀번호: {account.password}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatAdminRoleLabel(role: string) {
  const labels: Record<string, string> = {
    ADMIN: "관리자",
    SUPER: "최고 관리자",
    CS: "CS",
    MODERATOR: "운영 검토",
    FINANCE: "재무",
  };

  return labels[role] ?? role;
}

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function AdminInviteAcceptForm({ token }: { token: string }) {
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
      const response = await fetch("/api/admin/invite/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "관리자 초대를 수락하지 못했습니다.");
      }

      setMessage(result.message ?? "관리자 계정이 활성화되었습니다.");
      setPassword("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "관리자 초대를 수락하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/80"
    >
      <div>
        <p className="text-sm font-black text-emerald-700">ADMIN INVITE</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          관리자 초기 비밀번호 설정
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          초대 링크는 1회만 사용할 수 있습니다. 다른 서비스에서 사용하지 않는
          8자 이상의 비밀번호를 설정해 주세요.
        </p>
      </div>

      <label className="mt-6 flex flex-col gap-2 text-sm font-black text-slate-700">
        초기 비밀번호
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-500"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "활성화 중..." : "관리자 계정 활성화"}
      </button>

      {message ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <p>{message}</p>
          <Link
            href="/admin/sign-in"
            className="mt-2 inline-flex underline underline-offset-4"
          >
            관리자 로그인으로 이동
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

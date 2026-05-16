"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UserNoteForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitNote() {
    const trimmedBody = body.trim();
    setError("");

    if (trimmedBody.length < 5) {
      setError("운영 메모를 5자 이상 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/users/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          body: trimmedBody,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "운영 메모를 추가하지 못했습니다.");
      }

      setBody("");
      router.refresh();
    } catch (noteError) {
      setError(
        noteError instanceof Error
          ? noteError.message
          : "운영 메모를 추가하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">운영 메모</p>
      <h2 className="mt-1 text-xl font-black text-slate-950">메모 추가</h2>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        className="mt-4 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
        placeholder="예: 주문번호 / 확인 근거 / 다음 조치"
      />
      <p className="mt-2 text-xs font-semibold text-slate-500">{body.length}자</p>
      <button
        type="button"
        onClick={() => void submitNote()}
        disabled={isSubmitting || body.trim().length < 5}
        className="mt-3 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-slate-950 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "저장 중..." : "메모 추가"}
      </button>
      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

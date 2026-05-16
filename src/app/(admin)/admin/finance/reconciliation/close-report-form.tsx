"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CloseReportForm({
  range,
  blockedCount,
  reviewCount,
  criticalCount,
}: {
  range: string;
  blockedCount: number;
  reviewCount: number;
  criticalCount: number;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const confirmed = window.confirm(
      [
        "현재 정산 대조 내용을 마감 리포트로 저장할까요?",
        `범위: ${rangeLabel(range)}`,
        `메모: ${note.trim() || "메모 없음"}`,
        "저장된 리포트는 감사 검토용 운영 기록으로 남습니다.",
      ].join("\n"),
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/finance/reconciliation/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range,
          note,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "마감 리포트를 저장하지 못했습니다.");
      }

      setMessage(result.message ?? "마감 리포트가 저장되었습니다.");
      setNote("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "마감 리포트를 저장하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
      <p className="text-sm font-black text-emerald-700">마감 리포트</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">
        정산 대조 기록 저장
      </h2>

      <div
        className={`mt-4 rounded-md border p-3 text-sm font-semibold leading-6 ${readinessTone({
          blockedCount,
          reviewCount,
          criticalCount,
        })}`}
      >
        <p className="mt-1">
          마감 보류 {blockedCount}건 / 검토 필요 {reviewCount}건 / 긴급 신호{" "}
          {criticalCount}건
        </p>
        <p className="mt-1">
          {getCloseReportReadinessMessage({
            blockedCount,
            reviewCount,
            criticalCount,
          })}
        </p>
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={4}
        placeholder="예: 입출금 대기 건 확인 완료, 이상 신호 없음, CSV 별도 보관"
        className="mt-5 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
      />
      <p className="mt-2 text-xs font-semibold text-emerald-700">
        {note.length}자 입력
      </p>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={isSubmitting}
        className="mt-3 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "저장 중..." : "마감 리포트 저장"}
      </button>

      {message ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function rangeLabel(range: string) {
  const labels: Record<string, string> = {
    today: "오늘",
    "7d": "7일",
    "30d": "30일",
  };

  return labels[range] ?? range;
}

function readinessTone({
  blockedCount,
  criticalCount,
  reviewCount,
}: {
  blockedCount: number;
  criticalCount: number;
  reviewCount: number;
}) {
  if (blockedCount > 0 || criticalCount > 0) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (reviewCount > 0) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-white text-emerald-800";
}

function getCloseReportReadinessMessage({
  blockedCount,
  reviewCount,
  criticalCount,
}: {
  blockedCount: number;
  criticalCount: number;
  reviewCount: number;
}) {
  if (blockedCount > 0 || criticalCount > 0) {
    return "보류 또는 긴급";
  }

  if (reviewCount > 0) {
    return "검토 필요";
  }

  return "마감 가능";
}

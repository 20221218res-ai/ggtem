"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const reviewStatuses = ["UNDER_REVIEW", "HIDDEN", "RESTORED"];

export default function ReviewModerationReviewActions({
  reviewId,
  currentStatus,
}: {
  reviewId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(getInitialStatus(currentStatus));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      setError("운영 메모를 10자 이상 입력해 주세요.");
      return;
    }

    const confirmed = window.confirm(
      [
        "리뷰 공개 상태를 변경할까요?",
        `상태: ${reviewStatusLabel(currentStatus)} -> ${reviewStatusLabel(status)}`,
        `메모: ${trimmedReason}`,
        "숨김/복구는 공개 리뷰 노출에 영향을 주며 감사 로그에 기록됩니다.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/review-moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: "REVIEW",
          reviewId,
          status,
          reason: trimmedReason,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "리뷰 상태를 저장하지 못했습니다.");
      }

      setMessage(result.message ?? "저장되었습니다.");
      setReason("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "리뷰 상태를 저장하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDisabled = isSubmitting || reason.trim().length < 10;

  return (
    <div className="mt-4 rounded-md border border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-white/80 p-3">
      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
          리뷰 상태
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
          >
            {reviewStatuses.map((item) => (
              <option key={item} value={item}>
                {reviewStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
          운영 메모
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="처리 근거를 10자 이상 입력"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isDisabled}
            className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-black shadow-sm hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "저장 중..." : "리뷰 저장"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          {message} 감사 로그에 기록됐습니다.
        </p>
      ) : null}
    </div>
  );
}

function getInitialStatus(currentStatus: string) {
  if (currentStatus === "HIDDEN") {
    return "RESTORED";
  }

  if (reviewStatuses.includes(currentStatus)) {
    return currentStatus;
  }

  return "UNDER_REVIEW";
}

function reviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    VISIBLE: "공개",
    UNDER_REVIEW: "검토 중",
    HIDDEN: "숨김",
    RESTORED: "복구",
  };

  return labels[status] ?? status;
}

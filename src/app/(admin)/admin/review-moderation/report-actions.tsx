"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const reportStatuses = ["UNDER_REVIEW", "RESOLVED", "DISMISSED"];

export default function ReviewModerationReportActions({
  reportId,
  currentStatus,
}: {
  reportId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(
    reportStatuses.includes(currentStatus) ? currentStatus : "UNDER_REVIEW",
  );
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const trimmedNote = resolutionNote.trim();

    if (trimmedNote.length < 10) {
      setError("운영 메모를 10자 이상 입력해 주세요.");
      return;
    }

    const confirmed = window.confirm(
      [
        "신고 상태를 변경할까요?",
        `상태: ${reportStatusLabel(currentStatus)} -> ${reportStatusLabel(status)}`,
        `메모: ${trimmedNote}`,
        "이 작업은 감사 로그에 기록됩니다.",
      ].join("\n"),
    );

    if (!confirmed) return;

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
          reportId,
          status,
          resolutionNote: trimmedNote,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "신고 상태를 저장하지 못했습니다.");
      }

      setMessage(result.message ?? "저장되었습니다.");
      setResolutionNote("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "신고 상태를 저장하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDisabled = isSubmitting || resolutionNote.trim().length < 10;

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white/80 p-3">
      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
          신고 상태
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-[var(--gg-accent)]"
          >
            {reportStatuses.map((item) => (
              <option key={item} value={item}>
                {reportStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
          운영 메모
          <input
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            placeholder="처리 근거를 10자 이상 입력"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--gg-accent)]"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isDisabled}
            className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "저장 중..." : "상태 저장"}
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

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "접수",
    UNDER_REVIEW: "검토 중",
    RESOLVED: "처리 완료",
    DISMISSED: "기각",
  };

  return labels[status] ?? status;
}

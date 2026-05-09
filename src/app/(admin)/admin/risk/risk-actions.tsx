"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const reportStatuses = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];
const reportSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const targetStatuses = [
  "UNCHANGED",
  "ACTIVE",
  "SUSPENDED",
  "SELLING_RESTRICTED",
  "WITHDRAWAL_HOLD",
  "BANNED",
];

export default function RiskActions({
  reportId,
  currentStatus,
  currentSeverity,
}: {
  reportId: string;
  currentStatus: string;
  currentSeverity: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [severity, setSeverity] = useState(currentSeverity);
  const [targetStatus, setTargetStatus] = useState("UNCHANGED");
  const [resolutionNote, setResolutionNote] = useState(
    "신고 내용과 주문 기록을 확인했습니다.",
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsDecisionNote =
    ["RESOLVED", "DISMISSED"].includes(status) || targetStatus !== "UNCHANGED";
  const requiresMemo = needsDecisionNote && resolutionNote.trim().length < 10;

  async function submitReview() {
    const trimmedNote = resolutionNote.trim();

    if (requiresMemo) {
      setError("최종 처리 또는 계정 조치에는 10자 이상의 검토 메모가 필요합니다.");
      return;
    }

    const confirmed = window.confirm(
      [
        "신고 검토 결과를 저장할까요?",
        `신고 상태: ${reportStatusLabel(currentStatus)} -> ${reportStatusLabel(status)}`,
        `위험도: ${severityLabel(currentSeverity)} -> ${severityLabel(severity)}`,
        `대상 계정 조치: ${targetStatusLabel(targetStatus)}`,
        `메모: ${trimmedNote || "메모 없음"}`,
      ].join("\n"),
    );

    if (!confirmed) return;

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/risk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId,
          status,
          severity,
          targetStatus,
          resolutionNote: trimmedNote,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "신고 검토 결과를 저장하지 못했습니다.");
      }

      router.refresh();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "신고 검토 결과를 저장하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
        최종 처리, 기각, 계정 제한에는 검토 메모가 반드시 필요합니다.
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.8fr_0.8fr_1fr_1.4fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          신고 상태
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--color-primary)]"
          >
            {reportStatuses.map((item) => (
              <option key={item} value={item}>
                {reportStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          위험도
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--color-primary)]"
          >
            {reportSeverities.map((item) => (
              <option key={item} value={item}>
                {severityLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          대상 계정 조치
          <select
            value={targetStatus}
            onChange={(event) => setTargetStatus(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--color-primary)]"
          >
            {targetStatuses.map((item) => (
              <option key={item} value={item}>
                {targetStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          검토 메모
          <input
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--color-primary)]"
            placeholder="증거, 판단 근거, 후속 조치"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void submitReview()}
            disabled={isSubmitting || requiresMemo}
            className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "저장 중..." : "검토 저장"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
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

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    LOW: "낮음",
    MEDIUM: "중간",
    HIGH: "높음",
    CRITICAL: "긴급",
  };

  return labels[severity] ?? severity;
}

function targetStatusLabel(status: string) {
  const labels: Record<string, string> = {
    UNCHANGED: "변경 없음",
    ACTIVE: "정상",
    SUSPENDED: "정지",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
    BANNED: "차단",
  };

  return labels[status] ?? status;
}

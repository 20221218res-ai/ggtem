"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SellerRiskCandidateActions({
  userId,
  currentStatus,
  defaultReason,
}: {
  userId: string;
  currentStatus: string;
  defaultReason: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canApplyRestriction = ![
    "SELLING_RESTRICTED",
    "SUSPENDED",
    "BANNED",
  ].includes(currentStatus);
  const canRestoreAccess = currentStatus === "SELLING_RESTRICTED";
  const isLockedAccount = ["SUSPENDED", "BANNED"].includes(currentStatus);

  async function submitAction(action: string) {
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      setError("운영 사유를 10자 이상 입력해야 합니다.");
      return;
    }

    const confirmed = window.confirm(
      action === "APPLY_SELLING_RESTRICTION"
        ? `판매 제한을 적용할까요?\n현재 상태: ${statusLabel(currentStatus)}\n사유: ${trimmedReason}`
        : `판매 접근을 복구할까요?\n현재 상태: ${statusLabel(currentStatus)}\n사유: ${trimmedReason}`,
    );

    if (!confirmed) return;

    const adminPassword = window.prompt("관리자 비밀번호를 다시 입력해 주세요.");
    if (!adminPassword) return;

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/risk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          userId,
          resolutionNote: trimmedReason,
          adminPassword: adminPassword.trim(),
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "판매 접근 상태를 변경하지 못했습니다.");
      }

      setMessage(
        action === "APPLY_SELLING_RESTRICTION"
          ? "판매 제한을 적용했습니다."
          : "판매 접근을 복구했습니다.",
      );
      router.refresh();
    } catch (accessError) {
      setError(
        accessError instanceof Error
          ? accessError.message
          : "판매 접근 상태를 변경하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 grid gap-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={isLockedAccount}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--color-primary)] disabled:bg-slate-100 disabled:text-slate-500"
        placeholder="운영 사유"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void submitAction("APPLY_SELLING_RESTRICTION")}
          disabled={!canApplyRestriction || isSubmitting || reason.trim().length < 10}
          className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "처리 중..." : "판매 제한 적용"}
        </button>
        <button
          type="button"
          onClick={() => void submitAction("RESTORE_SELLING_ACCESS")}
          disabled={!canRestoreAccess || isSubmitting || reason.trim().length < 10}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "처리 중..." : "판매 접근 복구"}
        </button>
      </div>

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "정상",
    SUSPENDED: "정지",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
    BANNED: "차단",
    PENDING_EMAIL_VERIFICATION: "이메일 확인 대기",
  };

  return labels[status] ?? status;
}

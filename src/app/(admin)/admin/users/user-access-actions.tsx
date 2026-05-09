"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const roleOptions = ["CUSTOMER", "CS", "MODERATOR", "FINANCE", "ADMIN", "SUPER"];
const statusOptions = [
  "ACTIVE",
  "SUSPENDED",
  "SELLING_RESTRICTED",
  "WITHDRAWAL_HOLD",
  "BANNED",
];
const operatorRoles = ["CS", "MODERATOR", "FINANCE", "ADMIN", "SUPER"];

export default function UserAccessActions({
  userId,
  currentRole,
  currentStatus,
}: {
  userId: string;
  currentRole: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("운영상 계정 상태 점검");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roleChanged = role !== currentRole;
  const statusChanged = status !== currentStatus;
  const isOperatorRoleChange =
    operatorRoles.includes(role) || operatorRoles.includes(currentRole);
  const canSubmit =
    !isSubmitting && reason.trim().length >= 10 && (roleChanged || statusChanged);

  async function submitUpdate() {
    const trimmedReason = reason.trim();

    if (!roleChanged && !statusChanged) {
      setError("변경된 권한 또는 계정 상태가 없습니다.");
      return;
    }

    if (trimmedReason.length < 10) {
      setError("계정 조치 사유를 10자 이상 입력해 주세요.");
      return;
    }

    const confirmed = window.confirm(
      [
        "유저 계정 조치를 저장할까요?",
        "",
        `[권한] ${roleLabel(currentRole)} -> ${roleLabel(role)}`,
        `[상태] ${statusLabel(currentStatus)} -> ${statusLabel(status)}`,
        "",
        `영향: ${buildImpactSummary(role, status)}`,
        `사유: ${trimmedReason}`,
      ].join("\n"),
    );

    if (!confirmed) return;

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          role,
          status,
          reason: trimmedReason,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "유저 계정 상태를 변경하지 못했습니다.");
      }

      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "유저 계정 상태를 변경하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.5fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
          권한
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {roleLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
          상태
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-black text-slate-600">
          사유
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
            placeholder="신고번호, 주문번호, 판단 근거"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void submitUpdate()}
            disabled={!canSubmit}
            className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
        영향: {buildImpactSummary(role, status)}
      </div>

      {isOperatorRoleChange ? (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] px-3 py-2 text-xs font-bold text-[var(--gg-accent)]">
          운영 권한 변경이 포함됩니다. 최고관리자 또는 책임자의 승인 근거를 사유에 남겨 주세요.
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    CUSTOMER: "일반 유저",
    CS: "CS",
    MODERATOR: "모더레이터",
    FINANCE: "재무",
    ADMIN: "관리자",
    SUPER: "최고관리자",
  };
  return labels[role] ?? role;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "정상",
    SUSPENDED: "정지",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
    BANNED: "차단",
  };
  return labels[status] ?? status;
}

function buildImpactSummary(role: string, status: string) {
  const impacts = [];

  if (operatorRoles.includes(role)) {
    impacts.push("관리자 페이지 접근 가능");
  } else {
    impacts.push("일반 유저 권한");
  }

  if (status === "ACTIVE") impacts.push("로그인/거래 가능");
  if (status === "SELLING_RESTRICTED") impacts.push("판매 등록 제한");
  if (status === "WITHDRAWAL_HOLD") impacts.push("출금 요청 보류");
  if (status === "SUSPENDED") impacts.push("계정 이용 정지");
  if (status === "BANNED") impacts.push("계정 차단");

  return impacts.join(" / ");
}

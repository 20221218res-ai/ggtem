"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FinanceAction =
  | "CONFIRM_DEPOSIT"
  | "REJECT_DEPOSIT"
  | "COMPLETE_WITHDRAWAL"
  | "REJECT_WITHDRAWAL";

type FinanceActionsProps = {
  kind: "DEPOSIT" | "WITHDRAWAL";
  requestId: string;
  primaryAction: "CONFIRM_DEPOSIT" | "COMPLETE_WITHDRAWAL";
  primaryLabel: string;
  secondaryAction: "REJECT_DEPOSIT" | "REJECT_WITHDRAWAL";
  secondaryLabel: string;
  confirmationSummary?: string;
  completionPhrase?: string;
  completionPhraseLabel?: string;
};

export default function FinanceActions({
  kind,
  requestId,
  primaryAction,
  primaryLabel,
  secondaryAction,
  secondaryLabel,
  confirmationSummary,
  completionPhrase,
  completionPhraseLabel = "확인 문구",
}: FinanceActionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<FinanceAction | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [evidenceTxId, setEvidenceTxId] = useState("");
  const [evidenceMemo, setEvidenceMemo] = useState("");

  const effectiveCompletionPhrase =
    completionPhrase ??
    (primaryAction === "COMPLETE_WITHDRAWAL" ? "출금완료" : undefined);
  const needsWithdrawalEvidence = primaryAction === "COMPLETE_WITHDRAWAL";
  const needsCompletionPhrase = Boolean(effectiveCompletionPhrase);
  const hasWithdrawalEvidence =
    !needsWithdrawalEvidence || Boolean(evidenceTxId.trim());
  const canSubmitPrimary =
    hasWithdrawalEvidence &&
    (!needsCompletionPhrase ||
      confirmationText.trim() === effectiveCompletionPhrase);

  async function submit(action: FinanceAction) {
    const confirmed = window.confirm(
      [
        getActionTitle(action),
        getActionWarning(action),
        confirmationSummary,
        action === "COMPLETE_WITHDRAWAL"
          ? `처리 증빙: ${formatEvidenceForConfirm({
              txId: evidenceTxId,
              memo: evidenceMemo,
            })}`
          : null,
        `${kind === "DEPOSIT" ? "입금" : "출금"} 요청 ${requestId}을 처리할까요?`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setIsSubmitting(true);
    setActiveAction(action);

    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          requestId,
          action,
          adminEvidence:
            action === "COMPLETE_WITHDRAWAL" || action === "REJECT_WITHDRAWAL"
              ? {
                  txId: evidenceTxId.trim(),
                  memo: evidenceMemo.trim(),
                }
              : undefined,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "요청을 처리하지 못했습니다.");
      }

      setSuccess(result.message ?? "요청 처리가 완료되었습니다.");
      setConfirmationText("");
      setEvidenceTxId("");
      setEvidenceMemo("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "요청을 처리하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  }

  return (
    <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
      <div
        className={`rounded-lg border px-4 py-3 text-sm font-black leading-6 ${
          primaryAction === "COMPLETE_WITHDRAWAL"
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`}
      >
        {getActionRiskLabel(primaryAction)}
      </div>

      {needsCompletionPhrase ? (
        <label className="grid gap-2 rounded-lg border border-amber-200 bg-white p-4 text-sm text-amber-900">
          <span className="font-black">{completionPhraseLabel}</span>
          <span className="text-xs font-bold leading-5">
            아래 입력칸에 <strong>{effectiveCompletionPhrase}</strong>를 정확히 입력해야 최종 처리할 수 있습니다.
          </span>
          <input
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            className="rounded-md border border-amber-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400"
            placeholder={effectiveCompletionPhrase}
          />
        </label>
      ) : null}

      {needsWithdrawalEvidence ? (
        <div className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-black">송금 TXID</span>
            <input
              value={evidenceTxId}
              onChange={(event) => setEvidenceTxId(event.target.value)}
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
              placeholder="실제 송금 후 발급된 TXID"
            />
          </label>
          <label className="grid gap-2">
            <span className="font-black">증빙 메모</span>
            <input
              value={evidenceMemo}
              onChange={(event) => setEvidenceMemo(event.target.value)}
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
              placeholder="필요 시 처리 메모 입력"
            />
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit(primaryAction)}
          disabled={isSubmitting || !canSubmitPrimary}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeAction === primaryAction ? `${primaryLabel} 처리 중...` : primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => void submit(secondaryAction)}
          disabled={isSubmitting}
          className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeAction === secondaryAction ? `${secondaryLabel} 처리 중...` : secondaryLabel}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          {success} 목록과 감사 로그를 새로 반영했습니다.
        </p>
      ) : null}
    </div>
  );
}

function getActionWarning(action: FinanceAction) {
  if (action === "CONFIRM_DEPOSIT") {
    return "입금 승인 시 유저 지갑의 사용 가능 금액이 즉시 증가합니다. TXID, 네트워크, 입금 주소를 먼저 확인하세요.";
  }
  if (action === "COMPLETE_WITHDRAWAL") {
    return "출금 완료는 실제 송금이 끝난 뒤에만 누르세요. 입력한 TXID는 감사 로그와 출금 로그에 저장됩니다.";
  }
  if (action === "REJECT_WITHDRAWAL") {
    return "출금 거절 시 잠긴 금액이 유저 지갑으로 반환됩니다.";
  }
  return "입금 요청을 반려합니다. 유저 지갑 금액은 변경되지 않습니다.";
}

function getActionTitle(action: FinanceAction) {
  const labels = {
    CONFIRM_DEPOSIT: "[입금 승인 최종 확인]",
    REJECT_DEPOSIT: "[입금 반려 최종 확인]",
    COMPLETE_WITHDRAWAL: "[출금 완료 최종 확인]",
    REJECT_WITHDRAWAL: "[출금 거절 최종 확인]",
  };
  return labels[action];
}

function getActionRiskLabel(action: "CONFIRM_DEPOSIT" | "COMPLETE_WITHDRAWAL") {
  if (action === "CONFIRM_DEPOSIT") {
    return "입금 승인은 유저 사용 가능 금액을 증가시키는 작업입니다.";
  }

  return "출금 완료는 실제 송금 후 TXID를 남기는 최종 처리 작업입니다.";
}

function formatEvidenceForConfirm({ txId, memo }: { txId: string; memo: string }) {
  const trimmedTxId = txId.trim();
  const trimmedMemo = memo.trim();
  if (trimmedTxId && trimmedMemo) return `${trimmedTxId} / ${trimmedMemo}`;
  return trimmedTxId || trimmedMemo || "증빙 없음";
}

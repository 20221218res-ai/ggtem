"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

type OfferAction = "ACCEPT" | "REJECT";

export default function OfferActions({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<OfferAction | null>(null);
  const [submittingAction, setSubmittingAction] = useState<OfferAction | null>(null);
  const [error, setError] = useState("");

  async function updateOffer() {
    if (!pendingAction) return;

    const action = pendingAction;
    setError("");
    setSubmittingAction(action);

    try {
      const response = await fetch("/api/market/buy-request-offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, action }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "판매 제안 상태 변경에 실패했습니다.");
      }

      setPendingAction(null);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "판매 제안 상태 변경에 실패했습니다.",
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  const dialog = pendingAction ? getOfferDialog(pendingAction) : null;
  const isBusy = submittingAction !== null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => setPendingAction("ACCEPT")}
        className="rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-xs font-black text-[var(--gg-inverse-text)] disabled:opacity-60"
      >
        {submittingAction === "ACCEPT" ? "수락 중..." : "수락"}
      </button>
      <button
        type="button"
        disabled={isBusy}
        onClick={() => setPendingAction("REJECT")}
        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-60"
      >
        {submittingAction === "REJECT" ? "거절 중..." : "거절"}
      </button>

      {error ? (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-xs font-black text-red-700">
          {error}
        </p>
      ) : null}

      {dialog ? (
        <ActionConfirmDialog
          isOpen
          eyebrow={dialog.eyebrow}
          title={dialog.title}
          body={dialog.body}
          confirmLabel={dialog.confirmLabel}
          tone={dialog.tone}
          isSubmitting={isBusy}
          onCancel={() => setPendingAction(null)}
          onConfirm={updateOffer}
        />
      ) : null}
    </div>
  );
}

function getOfferDialog(action: OfferAction) {
  if (action === "ACCEPT") {
    return {
      eyebrow: "OFFER ACCEPT",
      title: "판매 제안을 수락할까요?",
      body: "수락하면 해당 제안을 기준으로 거래가 진행됩니다. 금액과 수량을 다시 확인해 주세요.",
      confirmLabel: "수락 확정",
      tone: "primary" as const,
    };
  }

  return {
    eyebrow: "OFFER REJECT",
    title: "판매 제안을 거절할까요?",
    body: "거절 후에는 같은 제안을 다시 수락할 수 없습니다.",
    confirmLabel: "거절 확정",
    tone: "danger" as const,
  };
}

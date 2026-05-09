"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

export default function BuyRequestActions({
  buyRequestId,
  status,
}: {
  buyRequestId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  async function handleCancel() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/buy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "CANCEL", buyRequestId }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "구매 등록글 취소에 실패했습니다.");
      }

      setIsConfirmOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "구매 등록글 취소에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== "ACTIVE") return null;

  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => setIsConfirmOpen(true)}
        className="rounded-xl bg-red-50 px-4 py-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-60"
      >
        {isSubmitting ? "취소 중..." : "구매 등록글 취소"}
      </button>

      {error ? (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">
          {error}
        </p>
      ) : null}

      <ActionConfirmDialog
        isOpen={isConfirmOpen}
        eyebrow="BUY REQUEST"
        title="구매 등록글을 취소할까요?"
        body="취소하면 이 구매요청은 더 이상 노출되지 않고, 잠겨 있던 예치금은 지갑 잔액으로 반환됩니다."
        confirmLabel="취소 확정"
        tone="danger"
        isSubmitting={isSubmitting}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleCancel}
      >
        <div className="space-y-2 text-sm font-bold text-[var(--gg-muted)]">
          <p>진행 중인 주문이 없는 구매요청만 취소할 수 있습니다.</p>
          <p>취소 후 같은 글을 다시 활성화할 수 없습니다.</p>
        </div>
      </ActionConfirmDialog>
    </div>
  );
}

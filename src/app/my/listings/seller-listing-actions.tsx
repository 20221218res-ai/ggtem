"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SellerListingStatusAction = "PAUSE" | "RESUME" | "HIDE";

export default function SellerListingActions({
  listingId,
  status,
  availableQuantity,
}: {
  listingId: string;
  status: string;
  availableQuantity: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canOpenPublicDetail =
    status === "ACTIVE" && Number(availableQuantity) > 0;
  const canPause = status === "ACTIVE";
  const canHide = status === "ACTIVE" || status === "PAUSED";
  const canResume =
    (status === "PAUSED" || status === "HIDDEN" || status === "SOLD_OUT") &&
    Number(availableQuantity) > 0;

  async function handleDuplicate() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/seller-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "DUPLICATE", listingId }),
      });
      const result = (await response.json()) as {
        listingId?: string;
        message?: string;
      };

      if (!response.ok || !result.listingId) {
        throw new Error(result.message ?? "판매글 복제에 실패했습니다.");
      }

      router.push(`/my/listings/${result.listingId}/edit`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "판매글 복제에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusAction(action: SellerListingStatusAction) {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/seller-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "STATUS", listingId, action }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "판매글 상태 변경에 실패했습니다.");
      }

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "판매글 상태 변경에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      {canOpenPublicDetail ? (
        <Link
          href={`/listings/${listingId}`}
          className="rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-xs font-black text-[var(--gg-inverse-text)]"
        >
          보기
        </Link>
      ) : null}
      <Link
        href={`/my/listings/${listingId}/edit`}
        className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-xs font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)]"
      >
        수정
      </Link>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleDuplicate()}
        className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-xs font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] disabled:opacity-60"
      >
        복제
      </button>
      {canPause ? (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleStatusAction("PAUSE")}
          className="rounded-lg bg-[#ffefc2] px-3 py-2 text-xs font-black text-[#9a6700] disabled:opacity-60"
        >
          중지
        </button>
      ) : null}
      {canHide ? (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleStatusAction("HIDE")}
          className="rounded-lg bg-[var(--gg-control-bg)] px-3 py-2 text-xs font-black text-[var(--gg-muted)] disabled:opacity-60"
        >
          숨김
        </button>
      ) : null}
      {canResume ? (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleStatusAction("RESUME")}
          className="rounded-lg bg-[#eaf8ef] px-3 py-2 text-xs font-black text-[#18a84a] disabled:opacity-60"
        >
          재개
        </button>
      ) : null}
      {error ? (
        <p className="w-full rounded-md bg-[#fee2e2] px-3 py-2 text-xs font-black text-[#dc2626]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderReviewFormProps = {
  orderId: string;
  sellerName: string;
  existing?: {
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
};

const ratingLabels: Record<number, string> = {
  5: "매우 만족",
  4: "만족",
  3: "보통",
  2: "아쉬움",
  1: "문제 있음",
};

const reviewTemplates = [
  "응답이 빠르고 약속한 시간에 전달받았습니다.",
  "거래 과정이 깔끔했습니다.",
  "등록된 내용과 실제 전달 내용이 일치했습니다.",
  "거래 중 확인이 필요한 부분이 있었습니다.",
];

export default function OrderReviewForm({
  orderId,
  sellerName,
  existing,
}: OrderReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyTemplate = (template: string) => {
    setComment((current) => {
      const next = current.trim() ? `${current.trim()}\n${template}` : template;
      return next.slice(0, 1000);
    });
  };

  const submit = async () => {
    if (existing || isSubmitting) {
      return;
    }

    if (
      rating <= 2 &&
      !window.confirm("낮은 평점으로 리뷰를 등록할까요?")
    ) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/market/order-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, rating, comment }),
    });

    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload?.message ?? "리뷰를 등록하지 못했습니다.");
      return;
    }

    setMessage(payload?.message ?? "리뷰가 등록되었습니다.");
    router.refresh();
  };

  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-black text-[var(--gg-accent)]">리뷰</p>
        <h2 className="mt-1 text-xl font-black">
          {existing ? "작성한 리뷰" : "판매자 평가"}
        </h2>
        <p className="mt-1 text-sm font-bold text-[#6b7280]">{sellerName}</p>
      </div>

      {existing ? (
        <p className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
          {existing.createdAt}에 {existing.rating}점 리뷰를 작성했습니다.
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md bg-red-100 px-3 py-2 text-xs font-black text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2 text-sm font-black">
          평점
          <select
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
            disabled={Boolean(existing)}
            className="h-11 rounded-xl border border-[#d8dde5] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[#f3f4f6]"
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}점 - {ratingLabels[value]}
              </option>
            ))}
          </select>
        </label>

        {!existing ? (
          <div className="flex flex-wrap gap-2">
            {reviewTemplates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => applyTemplate(template)}
                className="rounded-full border border-[#d8dde5] bg-[#f8fafc] px-3 py-2 text-xs font-black text-[#6b7280] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
              >
                {template}
              </button>
            ))}
          </div>
        ) : null}

        <label className="grid gap-2 text-sm font-black">
          내용
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={Boolean(existing)}
            rows={4}
            className="resize-none rounded-xl border border-[#d8dde5] bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[#f3f4f6]"
            placeholder="거래 경험을 입력해 주세요."
            maxLength={1000}
          />
        </label>
        <p className="text-xs font-bold text-[#9ca3af]">{comment.length}/1000</p>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={Boolean(existing) || isSubmitting}
        className="mt-4 w-full rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-sm font-black text-white disabled:bg-[#d1d5db]"
      >
        {existing ? "등록 완료" : isSubmitting ? "저장 중" : "리뷰 등록"}
      </button>
    </section>
  );
}

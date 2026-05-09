"use client";

import { useState } from "react";

const reportCategories = [
  { value: "NO_DELIVERY", label: "전달 지연/미전달" },
  { value: "WRONG_ITEM", label: "다른 물품 전달" },
  { value: "OFF_PLATFORM_PAYMENT", label: "외부 결제 유도" },
  { value: "ABUSIVE_CHAT", label: "부적절한 채팅" },
  { value: "FRAUD", label: "사기 의심" },
  { value: "OTHER", label: "기타" },
];

const reportTemplates = [
  "약속한 시간까지 물품을 받지 못했습니다.",
  "등록 내용과 실제 전달 내용이 다릅니다.",
  "외부 연락 또는 외부 결제를 요구했습니다.",
  "채팅에서 부적절한 표현이 있었습니다.",
];

export default function TrustReportForm({ orderId }: { orderId: string }) {
  const [category, setCategory] = useState("NO_DELIVERY");
  const [description, setDescription] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitReport() {
    setMessage("");
    setError("");

    const mainDescription = description.trim();
    if (mainDescription.length < 10) {
      setError("신고 내용은 10자 이상 입력해 주세요.");
      return;
    }

    const fullDescription = buildReportDescription({
      description: mainDescription,
      evidenceSummary,
      evidenceLinks,
    });

    if (fullDescription.length > 2000) {
      setError("신고 내용과 증거 기록은 합쳐서 2,000자 이하로 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/trust-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          category,
          description: fullDescription,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "신고 접수에 실패했습니다.");
      }

      setDescription("");
      setEvidenceSummary("");
      setEvidenceLinks("");
      setMessage(result.message ?? "신고가 접수되었습니다.");
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "신고 접수에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyTemplate(template: string) {
    setDescription((current) => {
      const next = current.trim() ? `${current.trim()}\n${template}` : template;
      return next.slice(0, 1200);
    });
  }

  const previewLength = buildReportDescription({
    description,
    evidenceSummary,
    evidenceLinks,
  }).length;

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-red-600">REPORT</p>
          <h2 className="mt-1 text-lg font-black text-red-900">신고/분쟁 접수</h2>
        </div>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
          관리자 검토
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <p className="text-sm font-black text-red-900">문제 유형</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {reportCategories.map((item) => {
              const active = category === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={
                    active
                      ? "rounded-xl border border-red-500 bg-red-600 px-3 py-3 text-left text-sm font-black text-white"
                      : "rounded-xl border border-red-200 bg-[var(--gg-card-bg)] px-3 py-3 text-left text-sm font-black text-[var(--gg-text)] hover:border-red-400"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {reportTemplates.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => applyTemplate(template)}
              className="rounded-full border border-red-200 bg-[var(--gg-card-bg)] px-3 py-2 text-xs font-black text-red-700 hover:border-red-500"
            >
              {template}
            </button>
          ))}
        </div>

        <label className="grid gap-2 text-sm font-black text-red-900">
          신고 내용
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="resize-none rounded-xl border border-red-200 bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-red-500"
            placeholder="무슨 문제가 있었는지 적어 주세요."
            maxLength={1200}
          />
        </label>

        <label className="grid gap-2 text-sm font-black text-red-900">
          증거 요약
          <textarea
            value={evidenceSummary}
            onChange={(event) => setEvidenceSummary(event.target.value)}
            rows={3}
            className="resize-none rounded-xl border border-red-200 bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-red-500"
            placeholder="채팅 시간, 전달받은 내용, 누락 수량처럼 운영자가 바로 볼 핵심만 적어 주세요."
            maxLength={500}
          />
        </label>

        <label className="grid gap-2 text-sm font-black text-red-900">
          증거 링크 / TXID
          <textarea
            value={evidenceLinks}
            onChange={(event) => setEvidenceLinks(event.target.value)}
            rows={3}
            className="resize-none rounded-xl border border-red-200 bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-red-500"
            placeholder="스크린샷 링크, TXID, 채팅 캡처 링크 등을 한 줄에 하나씩 입력"
            maxLength={600}
          />
        </label>

        <p className="text-right text-xs font-bold text-red-500">
          {previewLength}/2000
        </p>
      </div>

      <button
        type="button"
        onClick={() => void submitReport()}
        disabled={isSubmitting}
        className="mt-4 w-full rounded-xl bg-red-600 px-4 py-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
      >
        {isSubmitting ? "접수 중..." : "신고 접수"}
      </button>

      {message ? (
        <p className="mt-3 rounded-md bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-xs font-black text-red-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function buildReportDescription(input: {
  description: string;
  evidenceSummary: string;
  evidenceLinks: string;
}) {
  const links = input.evidenceLinks
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  return [
    "[신고 내용]",
    input.description.trim(),
    "",
    "[증거 요약]",
    input.evidenceSummary.trim() || "미입력",
    "",
    "[증거 링크/TXID]",
    links.length ? links.map((link) => `- ${link}`).join("\n") : "미입력",
  ].join("\n");
}

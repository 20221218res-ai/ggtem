"use client";

import { useState } from "react";
import type { TranslationKey } from "./i18n";
import useCountryTranslation from "./use-country-translation";

const reportCategories = [
  { value: "NO_DELIVERY", labelKey: "trustReport.categoryNoDelivery" },
  { value: "WRONG_ITEM", labelKey: "trustReport.categoryWrongItem" },
  { value: "OFF_PLATFORM_PAYMENT", labelKey: "trustReport.categoryOffPlatformPayment" },
  { value: "ABUSIVE_CHAT", labelKey: "trustReport.categoryAbusiveChat" },
  { value: "FRAUD", labelKey: "trustReport.categoryFraud" },
  { value: "OTHER", labelKey: "trustReport.categoryOther" },
] satisfies Array<{ value: string; labelKey: TranslationKey }>;

const reportTemplates = [
  "trustReport.templateNoDelivery",
  "trustReport.templateWrongItem",
  "trustReport.templateOffPlatform",
  "trustReport.templateAbusiveChat",
] satisfies TranslationKey[];

type TrustReportApiPayload = {
  message?: string;
  messageKey?: TranslationKey;
};

export default function TrustReportForm({ orderId }: { orderId: string }) {
  const { t } = useCountryTranslation();
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
      setError(t("trustReport.descriptionMin"));
      return;
    }

    const fullDescription = buildReportDescription({
      description: mainDescription,
      evidenceSummary,
      evidenceLinks,
    });

    if (fullDescription.length > 2000) {
      setError(t("trustReport.descriptionMax"));
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
      const result = (await response.json()) as TrustReportApiPayload;

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "trustReport.submitFailed"));
      }

      setDescription("");
      setEvidenceSummary("");
      setEvidenceLinks("");
      setMessage(getApiMessage(result, t, "trustReport.submitted"));
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : t("trustReport.submitFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyTemplate(templateKey: TranslationKey) {
    const template = t(templateKey);
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
          <p className="text-xs font-black text-red-600">{t("trustReport.eyebrow")}</p>
          <h2 className="mt-1 text-lg font-black text-red-900">
            {t("trustReport.title")}
          </h2>
        </div>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
          {t("trustReport.adminReview")}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <p className="text-sm font-black text-red-900">{t("trustReport.category")}</p>
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
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {reportTemplates.map((templateKey) => (
            <button
              key={templateKey}
              type="button"
              onClick={() => applyTemplate(templateKey)}
              className="rounded-full border border-red-200 bg-[var(--gg-card-bg)] px-3 py-2 text-xs font-black text-red-700 hover:border-red-500"
            >
              {t(templateKey)}
            </button>
          ))}
        </div>

        <label className="grid gap-2 text-sm font-black text-red-900">
          {t("trustReport.description")}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="resize-none rounded-xl border border-red-200 bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-red-500"
            placeholder={t("trustReport.descriptionPlaceholder")}
            maxLength={1200}
          />
        </label>

        <label className="grid gap-2 text-sm font-black text-red-900">
          {t("trustReport.evidenceSummary")}
          <textarea
            value={evidenceSummary}
            onChange={(event) => setEvidenceSummary(event.target.value)}
            rows={3}
            className="resize-none rounded-xl border border-red-200 bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-red-500"
            placeholder={t("trustReport.evidenceSummaryPlaceholder")}
            maxLength={500}
          />
        </label>

        <label className="grid gap-2 text-sm font-black text-red-900">
          {t("trustReport.evidenceLinks")}
          <textarea
            value={evidenceLinks}
            onChange={(event) => setEvidenceLinks(event.target.value)}
            rows={3}
            className="resize-none rounded-xl border border-red-200 bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-red-500"
            placeholder={t("trustReport.evidenceLinksPlaceholder")}
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
        {isSubmitting ? t("trustReport.submitting") : t("trustReport.submit")}
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

function getApiMessage(
  result: TrustReportApiPayload,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
) {
  return result.messageKey ? t(result.messageKey) : result.message ?? t(fallbackKey);
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

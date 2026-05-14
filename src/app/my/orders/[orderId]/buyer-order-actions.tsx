"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useCountryTranslation from "@/app/use-country-translation";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";
import { TradeSafetyConfirmDialog } from "@/components/trade-safety-confirm-dialog";

type BuyerOrderActionsProps = {
  orderId: string;
  status: string;
};

type BuyerOrderAction = "CANCEL_ORDER" | "CONFIRM_DELIVERY" | "REPORT_PROBLEM";

type BuyerOrderActionResponse = {
  orderId: string;
  status: string;
  message: string;
};

export function BuyerOrderActions({ orderId, status }: BuyerOrderActionsProps) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [pendingAction, setPendingAction] = useState<BuyerOrderAction | null>(null);

  const canCancel = status === "ESCROW_LOCKED" || status === "SELLER_RESPONSE_PENDING";
  const canConfirm = status === "DELIVERY_COMPLETED" || status === "BUYER_CONFIRM_PENDING";
  const canReportProblem = [
    "ESCROW_LOCKED",
    "SELLER_RESPONSE_PENDING",
    "DELIVERY_IN_PROGRESS",
    "DELIVERY_COMPLETED",
    "BUYER_CONFIRM_PENDING",
  ].includes(status);

  if (!canCancel && !canConfirm && !canReportProblem) {
    return null;
  }

  function requestAction(action: BuyerOrderAction) {
    setError("");
    setSuccess("");

    if (action === "REPORT_PROBLEM") {
      const disputeReason = buildDisputeReason({
        reason,
        evidenceSummary,
        evidenceLinks,
        t,
      });

      if (reason.trim().length < 10) {
        setError(t("orderManage.disputeReasonMin"));
        return;
      }

      if (disputeReason.length > 1200) {
        setError(t("orderManage.disputeReasonMax"));
        return;
      }
    }

    setPendingAction(action);
  }

  async function runPendingAction(input?: { password: string; characterName: string }) {
    if (!pendingAction) return;

    const action = pendingAction;
    const disputeReason =
      action === "REPORT_PROBLEM"
        ? buildDisputeReason({
            reason,
            evidenceSummary,
            evidenceLinks,
            t,
          })
        : undefined;

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/buyer-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          action,
          reason: disputeReason,
          paymentPin: input?.password,
        }),
      });
      const result = (await response.json()) as BuyerOrderActionResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in result && result.message ? result.message : t("orderManage.updateFailed"));
      }

      setSuccess((result as BuyerOrderActionResponse).message || t("common.confirm"));
      setPendingAction(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("orderManage.updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const dialog = pendingAction ? getActionDialog(pendingAction, t) : null;

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{t("orderManage.nextAction")}</h2>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--gg-accent)_14%,transparent)] px-3 py-1 text-xs font-black text-[var(--gg-accent)]">
          {t("orderManage.buyerRole")}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {canConfirm ? (
          <button
            type="button"
            onClick={() => requestAction("CONFIRM_DELIVERY")}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:opacity-60"
          >
            {isSubmitting ? t("orderManage.processing") : t("orderManage.receiptConfirm")}
          </button>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            onClick={() => requestAction("CANCEL_ORDER")}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-4 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] disabled:opacity-60"
          >
            {isSubmitting ? t("orderManage.processing") : t("orderManage.cancelOrder")}
          </button>
        ) : null}

        {canReportProblem ? (
          <details className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
            <summary className="cursor-pointer text-sm font-black">
              {t("orderManage.openDispute")}
            </summary>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-lg border border-red-200 bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-bold text-[var(--gg-text)] outline-none"
              placeholder={t("orderManage.problemPlaceholder")}
              maxLength={700}
            />
            <textarea
              value={evidenceSummary}
              onChange={(event) => setEvidenceSummary(event.target.value)}
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-red-200 bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-bold text-[var(--gg-text)] outline-none"
              placeholder={t("orderManage.evidencePlaceholder")}
              maxLength={300}
            />
            <textarea
              value={evidenceLinks}
              onChange={(event) => setEvidenceLinks(event.target.value)}
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-red-200 bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-bold text-[var(--gg-text)] outline-none"
              placeholder={t("orderManage.linksPlaceholder")}
              maxLength={300}
            />
            <button
              type="button"
              onClick={() => requestAction("REPORT_PROBLEM")}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {isSubmitting ? t("orderManage.processing") : t("orderManage.openDispute")}
            </button>
          </details>
        ) : null}
      </div>

      {success ? (
        <p className="mt-3 rounded-md bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-xs font-black text-red-800">
          {error}
        </p>
      ) : null}

      {dialog && pendingAction === "CONFIRM_DELIVERY" ? (
        <TradeSafetyConfirmDialog
          isOpen
          eyebrow={dialog.eyebrow}
          title="결제 비밀번호 확인"
          body="인수확정을 누르면 거래가 완료되고 에스크로 금액이 판매자에게 정산됩니다. 물품을 받은 뒤에만 진행해 주세요."
          confirmLabel={dialog.confirmLabel}
          tone={dialog.tone}
          isSubmitting={isSubmitting}
          warningLabel="인수확정 후에는 정산이 진행됩니다. 서버/캐릭터명 또는 물품 수령 여부를 다시 확인해 주세요."
          summaryRows={dialog.lines.map((line, index) => ({
            label: index === 0 ? "확인 사항" : "주의 사항",
            value: line,
          }))}
          onCancel={() => setPendingAction(null)}
          onConfirm={runPendingAction}
        />
      ) : dialog ? (
        <ActionConfirmDialog
          isOpen
          eyebrow={dialog.eyebrow}
          title={dialog.title}
          body={dialog.body}
          confirmLabel={dialog.confirmLabel}
          tone={dialog.tone}
          isSubmitting={isSubmitting}
          onCancel={() => setPendingAction(null)}
          onConfirm={runPendingAction}
        >
          <div className="space-y-2 text-sm font-bold text-[var(--gg-muted)]">
            {dialog.lines.map((line) => (
              <div key={line} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--gg-accent)]" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </ActionConfirmDialog>
      ) : null}
    </section>
  );
}

function buildDisputeReason(input: {
  reason: string;
  evidenceSummary: string;
  evidenceLinks: string;
  t: ReturnType<typeof useCountryTranslation>["t"];
}) {
  const links = input.evidenceLinks
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  return [
    input.t("orderManage.disputeReasonHeader"),
    input.reason.trim(),
    "",
    input.t("orderManage.evidenceHeader"),
    input.evidenceSummary.trim() || input.t("orderManage.notEntered"),
    "",
    input.t("orderManage.linksHeader"),
    links.length ? links.map((link) => `- ${link}`).join("\n") : input.t("orderManage.notEntered"),
  ].join("\n");
}

function getActionDialog(action: BuyerOrderAction, t: ReturnType<typeof useCountryTranslation>["t"]) {
  if (action === "CANCEL_ORDER") {
    return {
      eyebrow: "ORDER CANCEL",
      title: t("orderManage.cancelTitle"),
      body: t("orderManage.cancelBody"),
      confirmLabel: t("orderManage.cancelOrder"),
      tone: "danger" as const,
      lines: [t("orderManage.cancelLineA"), t("orderManage.cancelLineB")],
    };
  }

  if (action === "CONFIRM_DELIVERY") {
    return {
      eyebrow: "RELEASE ESCROW",
      title: t("orderManage.confirmTitle"),
      body: t("orderManage.confirmBody"),
      confirmLabel: t("orderManage.receiptConfirm"),
      tone: "primary" as const,
      lines: [t("orderManage.confirmLineA"), t("orderManage.confirmLineB")],
    };
  }

  return {
    eyebrow: "DISPUTE",
    title: t("orderManage.disputeTitle"),
    body: t("orderManage.disputeBody"),
    confirmLabel: t("orderManage.openDispute"),
    tone: "danger" as const,
    lines: [t("orderManage.disputeLineA"), t("orderManage.disputeLineB")],
  };
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

type SummaryRow = {
  label: string;
  value: string;
};

type PaymentPinStatus = "idle" | "loading" | "set" | "missing" | "error";

type TradeSafetyConfirmDialogProps = {
  isOpen: boolean;
  eyebrow?: string;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  isSubmitting?: boolean;
  summaryRows?: SummaryRow[];
  serverLabel?: string;
  requireCharacterName?: boolean;
  characterNameLabel?: string;
  characterNamePlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  warningLabel?: string;
  paymentPinSetupHref?: string;
  onCancel: () => void;
  onConfirm: (input: { password: string; characterName: string }) => void;
};

export function TradeSafetyConfirmDialog({
  isOpen,
  eyebrow = "SAFE TRADE",
  title,
  body,
  confirmLabel,
  cancelLabel = "취소",
  tone = "primary",
  isSubmitting = false,
  summaryRows = [],
  serverLabel,
  requireCharacterName = false,
  characterNameLabel = "거래 캐릭터명",
  characterNamePlaceholder = "거래 캐릭터명을 입력해 주세요.",
  passwordLabel = "결제 PIN 확인",
  passwordPlaceholder = "4~6자리 결제 PIN",
  warningLabel = "서버/캐릭터명 오류 시 보상받을 수 없습니다. 결제 전 반드시 확인해 주세요.",
  paymentPinSetupHref = "/my/wallet?action=payment-pin#payment-pin",
  onCancel,
  onConfirm,
}: TradeSafetyConfirmDialogProps) {
  const [paymentPin, setPaymentPin] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [isAcknowledged, setIsAcknowledged] = useState(true);
  const [error, setError] = useState("");
  const [pinStatus, setPinStatus] = useState<PaymentPinStatus>("idle");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPaymentPin("");
    setCharacterName("");
    setIsAcknowledged(true);
    setError("");
    setPinStatus("loading");

    let isMounted = true;

    fetch("/api/user/payment-pin", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("결제 PIN 상태를 확인하지 못했습니다.");
        }
        return (await response.json()) as { hasPaymentPin?: boolean };
      })
      .then((result) => {
        if (!isMounted) return;
        setPinStatus(result.hasPaymentPin ? "set" : "missing");
      })
      .catch(() => {
        if (!isMounted) return;
        setPinStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  function confirm() {
    const trimmedPaymentPin = paymentPin.trim();
    const trimmedCharacterName = characterName.trim();

    if (pinStatus === "loading") {
      setError("결제 PIN 상태를 확인 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (pinStatus === "missing") {
      setError("결제 PIN을 먼저 설정해 주세요.");
      return;
    }

    if (pinStatus === "error") {
      setError("결제 PIN 상태 확인에 실패했습니다. 새로고침 후 다시 시도해 주세요.");
      return;
    }

    if (!/^\d{4,6}$/.test(trimmedPaymentPin)) {
      setError("결제 PIN은 숫자 4~6자리로 입력해 주세요.");
      return;
    }

    if (requireCharacterName && !trimmedCharacterName) {
      setError("거래 캐릭터명을 입력해 주세요.");
      return;
    }

    if (!isAcknowledged) {
      setError("서버와 캐릭터명 확인 안내에 동의해 주세요.");
      return;
    }

    onConfirm({
      password: trimmedPaymentPin,
      characterName: trimmedCharacterName,
    });
  }

  return (
    <ActionConfirmDialog
      isOpen={isOpen}
      eyebrow={eyebrow}
      title={title}
      body={body}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={tone}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className="space-y-4">
        {serverLabel ? (
          <div className="rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-bg)] p-4 text-center">
            <p className="text-xs font-black text-[var(--gg-subtle)]">서버</p>
            <p className="mt-2 inline-flex rounded-lg bg-[var(--gg-control-bg)] px-4 py-2 text-sm font-black text-[var(--gg-text)]">
              {serverLabel}
            </p>
          </div>
        ) : null}

        {summaryRows.length ? (
          <div className="space-y-2 text-sm font-bold text-[var(--gg-muted)]">
            {summaryRows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3">
                <span>{row.label}</span>
                <span className="font-black text-[var(--gg-text)]">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">
          <p>반드시 판매자 및 구매자의 게임 아이디를 확인 후 거래하시기 바랍니다.</p>
          <p className="mt-1">
            게임 아이디 미확인으로 인한 사칭 및 사기 피해 발생 시 본 업체는 책임지지 않습니다.
          </p>
        </div>

        {pinStatus === "missing" ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold leading-6 text-sky-900">
            <p className="font-black">결제 PIN 설정이 필요합니다.</p>
            <p>구매, 즉시판매, 인수확정, 출금에 사용할 4~6자리 PIN을 먼저 설정해 주세요.</p>
            <Link
              href={paymentPinSetupHref}
              className="mt-3 inline-flex rounded-xl bg-[var(--gg-accent)] px-4 py-2 text-xs font-black text-[var(--gg-inverse-text)]"
            >
              결제 PIN 설정하기
            </Link>
          </div>
        ) : (
          <label className="block">
            <span className="text-xs font-black text-[var(--gg-text)]">{passwordLabel}</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={paymentPin}
              onChange={(event) => {
                setPaymentPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              autoComplete="one-time-code"
              placeholder={pinStatus === "loading" ? "결제 PIN 상태 확인 중..." : passwordPlaceholder}
              disabled={pinStatus !== "set"}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>
        )}

        {requireCharacterName ? (
          <label className="block">
            <span className="text-xs font-black text-[var(--gg-text)]">{characterNameLabel}</span>
            <input
              value={characterName}
              onChange={(event) => {
                setCharacterName(event.target.value);
                setError("");
              }}
              placeholder={characterNamePlaceholder}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
            />
          </label>
        ) : null}

        <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-black text-red-600">
          <input
            type="checkbox"
            checked={isAcknowledged}
            onChange={(event) => {
              setIsAcknowledged(event.target.checked);
              setError("");
            }}
            className="mt-1 h-4 w-4 accent-red-500"
          />
          <span>{warningLabel}</span>
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </ActionConfirmDialog>
  );
}

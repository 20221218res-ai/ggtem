"use client";

import { useEffect, useState } from "react";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";

type SummaryRow = {
  label: string;
  value: string;
};

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
  characterNamePlaceholder = "거래 캐릭터명을 입력해 주세요",
  passwordLabel = "결제 비밀번호 확인",
  passwordPlaceholder = "로그인 비밀번호를 입력해 주세요",
  warningLabel = "서버/캐릭터명 틀릴 시 보상받을 수 없습니다. 결제 전 반드시 확인해 주세요.",
  onCancel,
  onConfirm,
}: TradeSafetyConfirmDialogProps) {
  const [password, setPassword] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [isAcknowledged, setIsAcknowledged] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setCharacterName("");
      setIsAcknowledged(true);
      setError("");
    }
  }, [isOpen]);

  function confirm() {
    const trimmedPassword = password.trim();
    const trimmedCharacterName = characterName.trim();

    if (!trimmedPassword) {
      setError("결제 비밀번호를 입력해 주세요.");
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
      password: trimmedPassword,
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

        <label className="block">
          <span className="text-xs font-black text-[var(--gg-text)]">{passwordLabel}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            autoComplete="current-password"
            placeholder={passwordPlaceholder}
            className="mt-2 h-12 w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
          />
        </label>

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

"use client";

import type { ReactNode } from "react";
import CountryText from "@/app/country-text";

type ActionConfirmDialogProps = {
  isOpen: boolean;
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  tone?: "primary" | "danger";
  isSubmitting?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ActionConfirmDialog({
  isOpen,
  eyebrow,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  isSubmitting = false,
  children,
  onConfirm,
  onCancel,
}: ActionConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-[var(--gg-accent)] text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-confirm-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-2xl shadow-black/20">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
          {eyebrow ?? <CountryText id="common.confirm" />}
        </p>
        <h2 id="action-confirm-title" className="mt-2 text-2xl font-black text-[var(--gg-text)]">
          {title}
        </h2>
        {body ? (
          <p className="mt-3 text-sm font-bold leading-6 text-[var(--gg-muted)]">
            {body}
          </p>
        ) : null}

        {children ? (
          <div className="mt-4 rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] p-4">
            {children}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel ?? <CountryText id="common.cancel" />}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`rounded-xl px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {isSubmitting ? <CountryText id="common.processing" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SlaIncidentActions({
  incidentId,
  status,
  acknowledgedAt,
}: {
  incidentId: string;
  status: string;
  acknowledgedAt: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const isDisabled = status !== "OPEN" || Boolean(acknowledgedAt);
  const isResolved = status !== "OPEN";

  async function submitAction(action: string, fallbackMessage: string, actionNote?: string) {
    const response = await fetch("/api/admin/sla-incidents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        incidentId,
        note: actionNote,
      }),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      throw new Error(result.message ?? fallbackMessage);
    }
  }

  async function acknowledge() {
    const confirmed = window.confirm("SLA 알림을 확인 처리할까요?");

    if (!confirmed) return;

    setError("");
    setIsSubmitting(true);

    try {
      await submitAction("ACKNOWLEDGE", "SLA 알림을 확인 처리하지 못했습니다.");
      router.refresh();
    } catch (acknowledgeError) {
      setError(
        acknowledgeError instanceof Error
          ? acknowledgeError.message
          : "SLA 알림을 확인 처리하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addNote() {
    const trimmedNote = note.trim();

    if (trimmedNote.length < 3) return;

    setError("");
    setIsSavingNote(true);

    try {
      await submitAction("ADD_NOTE", "운영 메모를 추가하지 못했습니다.", trimmedNote);
      setNote("");
      router.refresh();
    } catch (noteError) {
      setError(
        noteError instanceof Error
          ? noteError.message
          : "운영 메모를 추가하지 못했습니다.",
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  async function resolveIncident() {
    const trimmedNote = note.trim();

    if (trimmedNote.length < 3) {
      setError("해결 메모를 3자 이상 입력해 주세요.");
      return;
    }

    const confirmed = window.confirm(`SLA 알림을 해결 처리할까요?\n메모: ${trimmedNote}`);

    if (!confirmed) return;

    setError("");
    setIsResolving(true);

    try {
      await submitAction("RESOLVE", "SLA 알림을 해결 처리하지 못했습니다.", trimmedNote);
      setNote("");
      router.refresh();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "SLA 알림을 해결 처리하지 못했습니다.",
      );
    } finally {
      setIsResolving(false);
    }
  }

  async function reopenIncident() {
    const trimmedNote = note.trim();

    if (trimmedNote.length < 3) {
      setError("재오픈 메모를 3자 이상 입력해 주세요.");
      return;
    }

    const confirmed = window.confirm(`SLA 알림을 다시 열까요?\n메모: ${trimmedNote}`);

    if (!confirmed) return;

    setError("");
    setIsReopening(true);

    try {
      await submitAction("REOPEN", "SLA 알림을 다시 열지 못했습니다.", trimmedNote);
      setNote("");
      router.refresh();
    } catch (reopenError) {
      setError(
        reopenError instanceof Error
          ? reopenError.message
          : "SLA 알림을 다시 열지 못했습니다.",
      );
    } finally {
      setIsReopening(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void acknowledge();
          }}
          disabled={isDisabled || isSubmitting}
          className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {acknowledgedAt ? "확인됨" : isSubmitting ? "처리 중..." : "확인 처리"}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void resolveIncident();
          }}
          disabled={isResolved || isResolving || note.trim().length < 3}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {isResolved ? "해결됨" : isResolving ? "해결 중..." : "해결 처리"}
        </button>
        {isResolved ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void reopenIncident();
            }}
            disabled={isReopening || note.trim().length < 3}
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isReopening ? "다시 여는 중..." : "다시 열기"}
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="처리 내용, 확인 근거, 다음 담당자가 볼 메모를 입력"
          rows={2}
          className="min-h-16 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400"
        />
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void addNote();
          }}
          disabled={note.trim().length < 3 || isSavingNote}
          className="rounded-md border border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--gg-accent)] hover:bg-[color-mix(in_srgb,var(--gg-accent)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingNote ? "저장 중..." : "메모 추가"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

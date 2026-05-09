"use client";

import { useEffect, useState } from "react";

type CredentialView = {
  exists: boolean;
  canSubmit: boolean;
  canReveal: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  buyerFirstViewedAt: string | null;
  buyerViewCount: number;
  accountId?: string;
  password?: string;
  note?: string | null;
};

type AccountCredentialPanelProps = {
  orderId: string;
  mode: "seller" | "buyer";
};

export default function AccountCredentialPanel({
  orderId,
  mode,
}: AccountCredentialPanelProps) {
  const [view, setView] = useState<CredentialView | null>(null);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadCredential(false);
  }, [orderId]);

  async function loadCredential(reveal: boolean) {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/market/order-account-credentials?orderId=${encodeURIComponent(orderId)}${reveal ? "&reveal=1" : ""}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as CredentialView & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "계정 전달 정보를 확인하지 못했습니다.");
      }

      setView(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitCredential() {
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/market/order-account-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          accountId,
          password,
          note,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "계정 전달 정보를 저장하지 못했습니다.");
      }

      setAccountId("");
      setPassword("");
      setNote("");
      setMessage(data.message ?? "저장했습니다.");
      await loadCredential(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처리하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !view) {
    return (
      <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
        <h2 className="text-lg font-black">계정 보안 전달함</h2>
        <p className="mt-3 text-sm font-bold text-[var(--gg-muted)]">확인 중입니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">ACCOUNT SAFE BOX</p>
          <h2 className="mt-1 text-xl font-black">계정 보안 전달함</h2>
        </div>
        <span className="rounded-full bg-[var(--gg-control-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
          {view?.exists ? "등록됨" : "미등록"}
        </span>
      </div>

      {mode === "seller" ? (
        <div className="mt-5 space-y-3">
          <input
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            placeholder="전달할 계정 ID"
            className="w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-input-bg)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
            disabled={!view?.canSubmit || isSubmitting}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="전달할 비밀번호"
            type="password"
            className="w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-input-bg)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
            disabled={!view?.canSubmit || isSubmitting}
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="추가 메모. 보안 질문, 이전 안내, 변경 가능 정보 등"
            className="min-h-24 w-full resize-y rounded-xl border border-[var(--gg-border)] bg-[var(--gg-input-bg)] px-4 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
            disabled={!view?.canSubmit || isSubmitting}
          />
          <button
            type="button"
            onClick={submitCredential}
            disabled={!view?.canSubmit || isSubmitting}
            className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "저장 중" : view?.exists ? "계정 전달 정보 수정" : "계정 전달 정보 등록"}
          </button>
          <p className="text-xs font-bold text-[var(--gg-muted)]">
            에스크로 잠금 이후에만 등록할 수 있고, 구매자 열람은 감사 로그에 기록됩니다.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {!view?.exists ? (
            <p className="rounded-xl bg-[var(--gg-control-bg)] p-4 text-sm font-bold text-[var(--gg-muted)]">
              아직 판매자가 계정 전달 정보를 등록하지 않았습니다.
            </p>
          ) : null}

          {view?.accountId && view.password ? (
            <div className="space-y-2 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4">
              <SecretRow label="계정" value={view.accountId} />
              <SecretRow label="비밀번호" value={view.password} />
              {view.note ? <SecretRow label="메모" value={view.note} /> : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => loadCredential(true)}
              disabled={!view?.canReveal}
              className="w-full rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              계정 전달 정보 열람
            </button>
          )}
          <p className="text-xs font-bold text-[var(--gg-muted)]">
            열람 횟수 {view?.buyerViewCount ?? 0}회
            {view?.buyerFirstViewedAt ? ` / 최초 열람 ${view.buyerFirstViewedAt}` : ""}
          </p>
        </div>
      )}

      {view?.updatedAt ? (
        <p className="mt-3 text-xs font-bold text-[var(--gg-muted)]">최근 등록 {view.updatedAt}</p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl bg-[var(--gg-control-bg)] p-3 text-sm font-bold text-[var(--gg-text)]">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-1 break-all rounded-lg bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-black">
        {value}
      </p>
    </div>
  );
}

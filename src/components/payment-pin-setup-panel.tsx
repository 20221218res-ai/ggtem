"use client";

import { useEffect, useState } from "react";

type PaymentPinStatus = {
  hasPaymentPin: boolean;
  paymentPinSetAt?: string | null;
};

function cleanPin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function PaymentPinSetupPanel() {
  const [status, setStatus] = useState<PaymentPinStatus | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/user/payment-pin", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("결제 PIN 상태를 확인하지 못했습니다.");
        }
        return (await response.json()) as PaymentPinStatus;
      })
      .then((result) => {
        if (!isMounted) return;
        setStatus(result);
      })
      .catch((statusError) => {
        if (!isMounted) return;
        setError(statusError instanceof Error ? statusError.message : "결제 PIN 상태를 확인하지 못했습니다.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function submitPin() {
    setMessage("");
    setError("");

    if (!/^\d{4,6}$/.test(newPin)) {
      setError("새 결제 PIN은 숫자 4~6자리로 입력해 주세요.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("새 결제 PIN 확인값이 일치하지 않습니다.");
      return;
    }

    if (status?.hasPaymentPin && !/^\d{4,6}$/.test(currentPin)) {
      setError("현재 결제 PIN을 숫자 4~6자리로 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/user/payment-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPaymentPin: status?.hasPaymentPin ? currentPin : undefined,
          paymentPin: newPin,
        }),
      });
      const result = (await response.json()) as {
        hasPaymentPin?: boolean;
        paymentPinSetAt?: string | null;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "결제 PIN을 저장하지 못했습니다.");
      }

      setStatus({
        hasPaymentPin: true,
        paymentPinSetAt: result.paymentPinSetAt ?? new Date().toISOString(),
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setMessage(result.message ?? "결제 PIN을 저장했습니다.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "결제 PIN을 저장하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id="payment-pin"
      className="rounded-2xl border border-[color-mix(in_srgb,var(--gg-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_7%,white)] p-5 shadow-sm shadow-[var(--gg-shadow)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">SECURITY PIN</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--gg-text)]">결제 PIN 설정</h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[var(--gg-muted)]">
            구매, 즉시판매, 인수확정, 출금 요청에 사용하는 4~6자리 숫자 PIN입니다.
            로그인 비밀번호와 별도로 보관되며 운영자는 원문을 확인할 수 없습니다.
          </p>
        </div>
        <span className="w-fit rounded-full border border-[var(--gg-border)] bg-white px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
          {isLoading ? "확인 중" : status?.hasPaymentPin ? "설정됨" : "미설정"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {status?.hasPaymentPin ? (
          <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
            현재 PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={currentPin}
              onChange={(event) => {
                setCurrentPin(cleanPin(event.target.value));
                setError("");
              }}
              autoComplete="one-time-code"
              className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 font-bold outline-none focus:border-[var(--gg-accent)]"
              placeholder="현재 PIN"
            />
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
          새 PIN
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(event) => {
              setNewPin(cleanPin(event.target.value));
              setError("");
            }}
            autoComplete="new-password"
            className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 font-bold outline-none focus:border-[var(--gg-accent)]"
            placeholder="4~6자리 숫자"
          />
        </label>
        <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
          새 PIN 확인
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(event) => {
              setConfirmPin(cleanPin(event.target.value));
              setError("");
            }}
            autoComplete="new-password"
            className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 font-bold outline-none focus:border-[var(--gg-accent)]"
            placeholder="한 번 더 입력"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void submitPin()}
          disabled={isLoading || isSubmitting}
          className="h-12 rounded-xl bg-[var(--gg-accent)] px-6 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "저장 중..." : status?.hasPaymentPin ? "결제 PIN 변경" : "결제 PIN 설정"}
        </button>
        <p className="text-xs font-bold text-[var(--gg-muted)]">
          PIN을 잊어버린 경우 고객센터 또는 관리자 초기화가 필요합니다.
        </p>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

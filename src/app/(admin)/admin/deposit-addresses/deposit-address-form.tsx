"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DepositAddressFormProps = {
  chain: "TRC20" | "BEP20";
  defaults: {
    label: string;
    asset: string;
    networkName: string;
    minimumAmount: string;
  };
  current?: {
    label: string;
    asset: string;
    networkName: string;
    address: string;
    minimumAmount: string;
    isActive: boolean;
  };
};

export function DepositAddressForm({ chain, defaults, current }: DepositAddressFormProps) {
  const router = useRouter();
  const [label, setLabel] = useState(current?.label ?? defaults.label);
  const [networkName, setNetworkName] = useState(current?.networkName ?? defaults.networkName);
  const [address, setAddress] = useState(current?.address ?? "");
  const [minimumAmount, setMinimumAmount] = useState(current?.minimumAmount ?? defaults.minimumAmount);
  const [isActive, setIsActive] = useState(current?.isActive ?? true);
  const [reason, setReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("저장 중입니다...");

    const response = await fetch("/api/admin/deposit-addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain,
        label,
        asset: defaults.asset,
        networkName,
        address,
        minimumAmount,
        isActive,
        reason,
        adminPassword,
      }),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setStatus("error");
      setMessage(result?.message ?? "입금 주소 저장에 실패했습니다.");
      return;
    }

    setStatus("success");
    setMessage(result?.message ?? "입금 주소 설정이 저장되었습니다.");
    setAdminPassword("");
    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <Field label="표시 이름" value={label} onChange={setLabel} />
      <Field label="네트워크" value={networkName} onChange={setNetworkName} />
      <Field
        label="입금 주소"
        value={address}
        onChange={setAddress}
        placeholder={chain === "TRC20" ? "T로 시작하는 TRC20 주소" : "0x로 시작하는 BEP20 주소"}
        monospace
      />
      <Field label="최소 입금액" value={minimumAmount} onChange={setMinimumAmount} inputMode="decimal" />
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        유저 충전 화면에 노출
      </label>
      <Field
        label="변경 사유"
        value={reason}
        onChange={setReason}
        placeholder="예: 운영 지갑 주소 교체 또는 보안 주소 변경"
      />
      <Field
        label="최고관리자 비밀번호"
        value={adminPassword}
        onChange={setAdminPassword}
        type="password"
        placeholder="주소 변경을 위해 비밀번호 재확인"
      />
      {message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm font-black ${
            status === "error"
              ? "bg-red-100 text-red-700"
              : status === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 rounded-md bg-[var(--color-primary)] px-4 text-sm font-black text-black hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "saving" ? "저장 중..." : `${chain} 주소 저장`}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = "text",
  monospace = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal";
  type?: "text" | "password";
  monospace?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className={`h-12 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-[var(--color-primary)] ${
          monospace ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const roleOptions = ["ADMIN", "FINANCE", "CS", "MODERATOR", "SUPER"];
const statusOptions = ["ACTIVE", "SUSPENDED", "BANNED"];

type AdminAccountOption = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  loginState?: string;
};

export function AdminAccountCreateForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("CS");
  const [reason, setReason] = useState("운영 업무 배정을 위한 관리자 계정 준비");
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitCreate() {
    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();
    const trimmedReason = reason.trim();

    if (!trimmedEmail || !trimmedName || trimmedReason.length < 10 || !adminPassword) {
      setError("이메일, 이름, 사유, 관리자 비밀번호를 입력해 주세요.");
      return;
    }

    if (!window.confirm("관리자 계정을 초대 준비 상태로 생성할까요?")) return;

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await postAdminAccount({
        intent: "create",
        email: trimmedEmail,
        displayName: trimmedName,
        role,
        reason: trimmedReason,
        adminPassword,
      });

      setEmail("");
      setDisplayName("");
      setAdminPassword("");
      setMessage(result.message ?? "관리자 계정을 준비했습니다.");
      router.refresh();
    } catch (createError) {
      setError(toErrorMessage(createError, "관리자 계정을 생성하지 못했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormShell title="관리자 계정 준비">
      <div className="grid gap-3 md:grid-cols-2">
        <InputField label="이메일" value={email} onChange={setEmail} placeholder="admin@example.com" />
        <InputField label="이름" value={displayName} onChange={setDisplayName} placeholder="운영자 이름" />
      </div>
      <SelectField label="역할" value={role} onChange={setRole} options={roleOptions} formatter={roleLabel} />
      <InputField label="생성 사유" value={reason} onChange={setReason} placeholder="관리자 계정 생성 사유" />
      <PasswordField label="관리자 비밀번호 재확인" value={adminPassword} onChange={setAdminPassword} />
      <ActionButton onClick={submitCreate} disabled={isSubmitting}>
        {isSubmitting ? "생성 중..." : "계정 준비"}
      </ActionButton>
      <Feedback message={message} error={error} />
    </FormShell>
  );
}

export function AdminAccountAccessForm({ accounts }: { accounts: AdminAccountOption[] }) {
  const router = useRouter();
  const [targetUserId, setTargetUserId] = useState(accounts[0]?.userId ?? "");
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.userId === targetUserId),
    [accounts, targetUserId],
  );
  const [role, setRole] = useState(selectedAccount?.role ?? "CS");
  const [status, setStatus] = useState(selectedAccount?.status ?? "ACTIVE");
  const [reason, setReason] = useState("관리자 역할과 상태 정기 점검");
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectAccount(nextUserId: string) {
    const nextAccount = accounts.find((account) => account.userId === nextUserId);
    setTargetUserId(nextUserId);
    setRole(nextAccount?.role ?? "CS");
    setStatus(nextAccount?.status ?? "ACTIVE");
    setMessage("");
    setError("");
  }

  async function submitUpdate() {
    const trimmedReason = reason.trim();

    if (!targetUserId || !selectedAccount || trimmedReason.length < 10 || !adminPassword) {
      setError("대상 관리자, 사유, 관리자 비밀번호를 입력해 주세요.");
      return;
    }

    if (!window.confirm("관리자 권한 또는 상태를 변경할까요?")) return;

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await postAdminAccount({
        intent: "update-access",
        targetUserId,
        role,
        status,
        reason: trimmedReason,
        adminPassword,
      });

      setAdminPassword("");
      setMessage(result.message ?? "관리자 권한을 변경했습니다.");
      router.refresh();
    } catch (updateError) {
      setError(toErrorMessage(updateError, "관리자 권한을 변경하지 못했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormShell title="권한 / 상태 변경">
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
        대상 관리자
        <select
          value={targetUserId}
          onChange={(event) => selectAccount(event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--gg-accent)]"
        >
          {accounts.map((account) => (
            <option key={account.userId} value={account.userId}>
              {account.name} / {account.email}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="역할" value={role} onChange={setRole} options={roleOptions} formatter={roleLabel} />
        <SelectField label="상태" value={status} onChange={setStatus} options={statusOptions} formatter={statusLabel} />
      </div>
      <InputField label="변경 사유" value={reason} onChange={setReason} placeholder="권한 또는 상태 변경 사유" />
      <PasswordField label="관리자 비밀번호 재확인" value={adminPassword} onChange={setAdminPassword} />
      <ActionButton onClick={submitUpdate} disabled={isSubmitting || accounts.length === 0}>
        {isSubmitting ? "변경 중..." : "권한 / 상태 변경"}
      </ActionButton>
      <Feedback message={message} error={error} />
    </FormShell>
  );
}

export function AdminAccountInviteForm({ accounts }: { accounts: AdminAccountOption[] }) {
  const router = useRouter();
  const inviteTargets = accounts.filter((account) => account.loginState === "초대 대기");
  const [targetUserId, setTargetUserId] = useState(inviteTargets[0]?.userId ?? "");
  const [reason, setReason] = useState("관리자 초대 링크 발급 승인");
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitInvite() {
    const trimmedReason = reason.trim();

    if (!targetUserId || trimmedReason.length < 10 || !adminPassword) {
      setError("초대 대상, 사유, 관리자 비밀번호를 입력해 주세요.");
      return;
    }

    if (!window.confirm("관리자 초대 링크를 발급할까요?")) return;

    setError("");
    setMessage("");
    setInviteUrl("");
    setIsSubmitting(true);

    try {
      const result = await postAdminAccount({
        intent: "create-invite",
        targetUserId,
        reason: trimmedReason,
        adminPassword,
      });

      setAdminPassword("");
      setMessage(result.message ?? "초대 링크를 생성했습니다.");
      setInviteUrl(result.inviteUrl ?? "");
      router.refresh();
    } catch (inviteError) {
      setError(toErrorMessage(inviteError, "초대 링크를 생성하지 못했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormShell title="초대 링크 발급">
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
        초대 대상
        <select
          value={targetUserId}
          onChange={(event) => setTargetUserId(event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--gg-accent)]"
        >
          {inviteTargets.map((account) => (
            <option key={account.userId} value={account.userId}>
              {account.name} / {roleLabel(account.role)} / {account.email}
            </option>
          ))}
        </select>
      </label>
      <InputField label="발급 사유" value={reason} onChange={setReason} placeholder="초대 링크 발급 사유" />
      <PasswordField label="관리자 비밀번호 재확인" value={adminPassword} onChange={setAdminPassword} />
      <ActionButton onClick={submitInvite} disabled={isSubmitting || inviteTargets.length === 0}>
        {isSubmitting ? "발급 중..." : "초대 링크 발급"}
      </ActionButton>
      {inviteUrl ? (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--gg-accent)_35%,white)] bg-[color-mix(in_srgb,var(--gg-accent)_8%,white)] p-3 text-xs font-bold text-slate-700">
          <p className="text-slate-500">발급된 초대 링크</p>
          <p className="mt-1 break-all text-[var(--gg-accent)]">{inviteUrl}</p>
        </div>
      ) : null}
      <Feedback message={message} error={error} />
    </FormShell>
  );
}

export function AdminInviteRevokeButton({ inviteId }: { inviteId: string; targetName?: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function revokeInvite() {
    const reason = window.prompt("초대 링크 취소 사유를 10자 이상 입력해 주세요.");
    if (!reason) return;

    const adminPassword = window.prompt("관리자 비밀번호를 다시 입력해 주세요.");
    if (!adminPassword) return;

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10) {
      window.alert("취소 사유는 10자 이상이어야 합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      await postAdminAccount({
        intent: "revoke-invite",
        inviteId,
        reason: trimmedReason,
        adminPassword: adminPassword.trim(),
      });
      router.refresh();
    } catch (revokeError) {
      window.alert(toErrorMessage(revokeError, "초대 링크를 취소하지 못했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void revokeInvite()}
      disabled={isSubmitting}
      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "취소 중..." : "초대 취소"}
    </button>
  );
}

function FormShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--gg-accent)]"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
      {label}
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="current-password"
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--gg-accent)]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  formatter,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  formatter: (value: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--gg-accent)]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatter(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-md bg-[var(--gg-accent)] px-4 py-2 text-sm font-black text-white hover:bg-[#009ed6] disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {children}
    </button>
  );
}

function Feedback({ message, error }: { message: string; error: string }) {
  if (!message && !error) return null;

  return (
    <p
      className={`rounded-md px-3 py-2 text-xs font-bold ${
        error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {error || message}
    </p>
  );
}

async function postAdminAccount(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/admin-accounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as {
    message?: string;
    inviteUrl?: string;
  };

  if (!response.ok) {
    throw new Error(result.message ?? "관리자 계정 작업을 처리하지 못했습니다.");
  }

  return result;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    SUPER: "최고관리자",
    ADMIN: "운영관리자",
    FINANCE: "재무 담당자",
    CS: "고객지원",
    MODERATOR: "모더레이터",
  };

  return labels[role] ?? role;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "활성",
    SUSPENDED: "정지",
    BANNED: "차단",
  };

  return labels[status] ?? status;
}

import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminUsersState } from "@/lib/admin/users";
import UserAccessActions from "./user-access-actions";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    role?: string;
    status?: string;
    query?: string;
  }>;
};

const roleFilters = [
  "ALL",
  "CUSTOMER",
  "CS",
  "MODERATOR",
  "FINANCE",
  "ADMIN",
  "SUPER",
];

const statusFilters = [
  "ALL",
  "ACTIVE",
  "SUSPENDED",
  "SELLING_RESTRICTED",
  "WITHDRAWAL_HOLD",
  "BANNED",
];

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS);
  const params = await searchParams;
  const state = await getAdminUsersState({
    role: params?.role,
    status: params?.status,
    query: params?.query,
  });
  const nextAction = getUsersNextAction(state.summary);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-emerald-600">USER DESK</p>
              <h1 className="mt-1 text-2xl font-black">유저 관리</h1>
              <p className="mt-2 text-sm font-bold text-slate-500">{nextAction.title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HeaderLink href="/admin/admin-accounts" label="관리자" />
              <HeaderLink href="/admin/finance/ledger" label="원장" />
              <HeaderLink href="/admin/audit?targetType=USER" label="감사 로그" />
              <HeaderLink href={nextAction.href} label={nextAction.actionLabel} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="전체" value={state.summary.totalUsers} tone="slate" />
            <Metric label="표시" value={state.summary.shownUsers} tone="blue" />
            <Metric label="정상" value={state.summary.activeUsers} tone="emerald" />
            <Metric label="운영 계정" value={state.summary.operatorUsers} tone="cyan" />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RiskMetric
            label="판매 제한"
            value={state.summary.restrictedUsers}
            href="/admin/users?status=SELLING_RESTRICTED"
            tone="amber"
          />
          <RiskMetric
            label="출금 보류"
            value={state.summary.withdrawalHoldUsers}
            href="/admin/users?status=WITHDRAWAL_HOLD"
            tone="red"
          />
          <RiskMetric
            label="정지"
            value={state.summary.suspendedUsers}
            href="/admin/users?status=SUSPENDED"
            tone="slate"
          />
          <RiskMetric
            label="차단"
            value={state.summary.bannedUsers}
            href="/admin/users?status=BANNED"
            tone="red"
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            <QuickFilter
              href="/admin/users"
              label="전체"
              active={state.filters.role === "ALL" && state.filters.status === "ALL"}
            />
            <QuickFilter
              href="/admin/users?role=CUSTOMER"
              label="일반 유저"
              active={state.filters.role === "CUSTOMER"}
            />
            <QuickFilter
              href="/admin/users?role=CS"
              label="CS"
              active={state.filters.role === "CS"}
            />
            <QuickFilter
              href="/admin/users?role=FINANCE"
              label="재무"
              active={state.filters.role === "FINANCE"}
            />
            <QuickFilter
              href="/admin/users?role=ADMIN"
              label="관리자"
              active={state.filters.role === "ADMIN"}
            />
            <QuickFilter
              href="/admin/users?status=WITHDRAWAL_HOLD"
              label="출금 보류"
              active={state.filters.status === "WITHDRAWAL_HOLD"}
            />
          </div>

          <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto]">
            <select
              name="role"
              defaultValue={state.filters.role}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              {roleFilters.map((role) => (
                <option key={role} value={role}>
                  {roleFilterLabel(role)}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={state.filters.status}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              {statusFilters.map((status) => (
                <option key={status} value={status}>
                  {statusFilterLabel(status)}
                </option>
              ))}
            </select>
            <input
              name="query"
              defaultValue={state.filters.query}
              placeholder="이메일 또는 닉네임 검색"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
            >
              검색
            </button>
            <Link
              href="/admin/users"
              className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              초기화
            </Link>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          {state.users.map((user) => (
            <article
              key={user.userId}
              className={`rounded-lg border p-4 shadow-sm ${
                user.isOperator
                  ? "border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)]/70"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-slate-950">
                      {user.displayName}
                    </p>
                    <Badge
                      label={roleFilterLabel(user.role)}
                      tone={user.isOperator ? "cyan" : "emerald"}
                    />
                    <Badge
                      label={statusFilterLabel(user.status)}
                      tone={statusTone(user.status)}
                    />
                    <Badge
                      label={user.isOperator ? "운영" : "일반"}
                      tone={user.isOperator ? "blue" : "slate"}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {user.email}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    가입 {user.createdAt} / 수정 {user.updatedAt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <HeaderLink href={`/admin/users/${user.userId}`} label="상세" />
                    <HeaderLink
                      href={`/admin/orders?query=${encodeURIComponent(user.email)}`}
                      label="주문"
                    />
                    <HeaderLink
                      href={`/admin/finance/ledger?q=${encodeURIComponent(user.userId)}`}
                      label="원장"
                    />
                  </div>
                </div>
                <div className="grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-3 xl:min-w-[420px]">
                  <MiniStat label="지갑" value={user.walletBalance ?? "없음"} />
                  <MiniStat
                    label="주문"
                    value={`${user.orderCount.toLocaleString("ko-KR")}건`}
                  />
                  <MiniStat
                    label="매물"
                    value={`${user.listingCount.toLocaleString("ko-KR")}건`}
                  />
                </div>
              </div>

              <UserAccessActions
                userId={user.userId}
                userEmail={user.email}
                currentRole={user.role}
                currentStatus={user.status}
              />
            </article>
          ))}

          {state.users.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              <p className="font-black text-slate-800">조건에 맞는 유저가 없습니다.</p>
              <Link
                href="/admin/users"
                className="mt-4 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
              >
                전체 보기
              </Link>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
    >
      {label}
    </Link>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "emerald" | "cyan";
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    cyan: "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
  }[tone];

  return (
    <div className={`rounded-lg border border-slate-200 p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-black">{label}</p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function RiskMetric({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "amber" | "red" | "slate";
}) {
  const toneClass = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  }[tone];

  return (
    <Link
      href={href}
      className={`rounded-lg border p-5 shadow-sm transition hover:brightness-95 ${toneClass}`}
    >
      <p className="text-sm font-black">{label}</p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("ko-KR")}</p>
    </Link>
  );
}

function QuickFilter({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-black text-slate-950"
          : "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
      }
    >
      {label}
    </Link>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "cyan" | "blue" | "slate" | "amber" | "red";
}) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cyan: "border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone];

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-black ${toneClass}`}>
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 break-all font-black text-slate-900">{value}</p>
    </div>
  );
}

function roleFilterLabel(role: string) {
  const labels: Record<string, string> = {
    ALL: "전체 역할",
    CUSTOMER: "일반 유저",
    CS: "CS",
    MODERATOR: "모더레이터",
    FINANCE: "재무",
    ADMIN: "관리자",
    SUPER: "최고관리자",
  };
  return labels[role] ?? role;
}

function statusFilterLabel(status: string) {
  const labels: Record<string, string> = {
    ALL: "전체 상태",
    ACTIVE: "정상",
    SUSPENDED: "정지",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
    BANNED: "차단",
  };
  return labels[status] ?? status;
}

function statusTone(status: string) {
  if (status === "ACTIVE") return "emerald";
  if (status === "SELLING_RESTRICTED" || status === "WITHDRAWAL_HOLD") {
    return "amber";
  }
  if (status === "SUSPENDED" || status === "BANNED") return "red";
  return "slate";
}

function getUsersNextAction(summary: {
  withdrawalHoldUsers: number;
  restrictedUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  operatorUsers: number;
}) {
  if (summary.withdrawalHoldUsers > 0) {
    return {
      title: `출금 보류 ${summary.withdrawalHoldUsers.toLocaleString("ko-KR")}명`,
      href: "/admin/users?status=WITHDRAWAL_HOLD",
      actionLabel: "바로 보기",
    };
  }

  if (summary.restrictedUsers > 0) {
    return {
      title: `판매 제한 ${summary.restrictedUsers.toLocaleString("ko-KR")}명`,
      href: "/admin/users?status=SELLING_RESTRICTED",
      actionLabel: "바로 보기",
    };
  }

  if (summary.suspendedUsers + summary.bannedUsers > 0) {
    return {
      title: `정지/차단 ${(summary.suspendedUsers + summary.bannedUsers).toLocaleString("ko-KR")}명`,
      href: "/admin/users?status=SUSPENDED",
      actionLabel: "바로 보기",
    };
  }

  return {
    title: `운영 계정 ${summary.operatorUsers.toLocaleString("ko-KR")}명`,
    href: "/admin/users?role=ADMIN",
    actionLabel: "권한 보기",
  };
}

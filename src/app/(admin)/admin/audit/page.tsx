import type { ReactNode } from "react";
import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  SENSITIVE_AUDIT_ACTIONS,
  getAdminAuditState,
} from "@/lib/admin/audit";
import { resolveMissingAuditReason } from "./actions";

type AdminAuditPageProps = {
  searchParams?: Promise<{
    action?: string;
    targetType?: string;
    query?: string;
    q?: string;
    adminId?: string;
    sensitivity?: string;
    reason?: string;
    followupStatus?: string;
    from?: string;
    to?: string;
  }>;
};

type AuditState = Awaited<ReturnType<typeof getAdminAuditState>>;
type AuditLog = AuditState["logs"][number];

export default async function AdminAuditPage({
  searchParams,
}: AdminAuditPageProps) {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
  });

  const params = searchParams ? await searchParams : undefined;
  const state = await getAdminAuditState({
    action: params?.action,
    targetType: params?.targetType,
    query: params?.query ?? params?.q,
    adminId: params?.adminId,
    sensitivity: params?.sensitivity,
    reason: params?.reason,
    followupStatus: params?.followupStatus,
    from: params?.from,
    to: params?.to,
  });
  const nextAction = getAuditNextAction(state);

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--color-primary)]">
              AUDIT LOG
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              감사 로그
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderLink href={buildAuditExportHref(state.filters, "csv")} label="CSV" />
            <HeaderLink href={buildAuditExportHref(state.filters, "xlsx")} label="XLSX" />
            <HeaderLink href="/admin/finance/ledger" label="원장 조회" />
            <HeaderLink href="/admin/reports" label="리포트" />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="전체 로그" value={`${state.summary.totalLogs}건`} tone="sky" />
          <MetricCard label="현재 표시" value={`${state.summary.shownLogs}건`} tone="sky" />
          <MetricCard label="액션 종류" value={`${state.summary.uniqueActions}개`} tone="slate" />
          <MetricCard label="대상 종류" value={`${state.summary.uniqueTargets}개`} tone="slate" />
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">다음 행동</p>
          <h2 className="mt-2 text-2xl font-black">{nextAction.title}</h2>
          <p className="sr-only">
            {nextAction.body}
          </p>
          <Link
            href={nextAction.href}
            className="mt-4 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700"
          >
            {nextAction.actionLabel}
          </Link>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black text-slate-600">필터</p>
                <h2 className="mt-1 text-xl font-black">로그 검색</h2>
              </div>
              <HeaderLink href="/admin/audit" label="초기화" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <FilterTab
                href={buildAuditHref({ ...state.filters, sensitivity: "", reason: "", followupStatus: "" })}
                active={!state.filters.sensitivity && !state.filters.reason && !state.filters.followupStatus}
                label="전체"
              />
              <FilterTab
                href={buildAuditHref({ ...state.filters, sensitivity: "sensitive" })}
                active={state.filters.sensitivity === "sensitive"}
                label="민감 작업"
              />
              <FilterTab
                href={buildAuditHref({ ...state.filters, reason: "missing", followupStatus: "unresolved" })}
                active={state.filters.reason === "missing" && state.filters.followupStatus === "unresolved"}
                label="사유 보완 필요"
              />
              <FilterTab
                href={buildAuditHref({ ...state.filters, followupStatus: "resolved" })}
                active={state.filters.followupStatus === "resolved"}
                label="보완 완료"
              />
            </div>

            <form action="/admin/audit" className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                name="query"
                defaultValue={state.filters.query}
                placeholder="주문 ID, 대상 ID, 액션, 사유 검색"
                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
              />
              <select
                name="adminId"
                defaultValue={state.filters.adminId}
                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">전체 관리자</option>
                {state.adminOptions.map((admin) => (
                  <option key={admin.userId} value={admin.userId}>
                    {admin.name} · {admin.role}
                  </option>
                ))}
              </select>
              <input
                name="targetType"
                defaultValue={state.filters.targetType}
                placeholder="대상 유형 예: ORDER"
                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
              />
              <input
                name="action"
                defaultValue={state.filters.action}
                placeholder="액션 예: DISPUTE_RELEASED_TO_SELLER"
                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
              />
              <input type="hidden" name="sensitivity" value={state.filters.sensitivity} />
              <input type="hidden" name="reason" value={state.filters.reason} />
              <input type="hidden" name="followupStatus" value={state.filters.followupStatus} />
              <input
                type="date"
                name="from"
                defaultValue={state.filters.from}
                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
              />
              <input
                type="date"
                name="to"
                defaultValue={state.filters.to}
                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-primary)]"
              />
              <button className="rounded-md bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-slate-950 hover:brightness-105 md:col-span-2">
                검색
              </button>
            </form>
          </section>

          <section className="grid gap-4">
            <BreakdownPanel title="액션 Top" items={state.actionBreakdown.map((item) => ({
              label: actionLabel(item.action),
              value: `${item.count}건`,
              href: buildAuditHref({ ...state.filters, action: item.action }),
            }))} />
            <BreakdownPanel title="대상 Top" items={state.targetBreakdown.map((item) => ({
              label: targetTypeLabel(item.targetType),
              value: `${item.count}건`,
              href: buildAuditHref({ ...state.filters, targetType: item.targetType }),
            }))} />
          </section>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <p className="text-sm font-black text-slate-600">로그 목록</p>
            <h2 className="mt-1 text-xl font-black">최근 감사 기록</h2>
          </div>

          <div className="divide-y divide-slate-200">
            {state.logs.map((log) => (
              <AuditLogRow key={log.logId} log={log} />
            ))}
          </div>

          {state.logs.length === 0 ? (
            <div className="p-5">
              <EmptyBox message="조건에 맞는 감사 로그가 없습니다." />
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const isSensitive = isSensitiveAuditAction(log.action);
  const needsFollowup = isSensitive && !log.reason && !log.followup.isResolved;

  return (
    <article className="p-5 hover:bg-slate-50">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.9fr] xl:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={isSensitive ? "rose" : "slate"}>
              {isSensitive ? "민감" : "일반"}
            </Badge>
            <Badge tone={log.followup.isResolved ? "emerald" : needsFollowup ? "amber" : "slate"}>
              {log.followup.isResolved ? "보완 완료" : needsFollowup ? "사유 필요" : "정상"}
            </Badge>
          </div>
          <p className="mt-3 text-sm font-black text-slate-950">
            {actionLabel(log.action)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {log.action}
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {log.adminName}
            {log.adminEmail ? ` · ${log.adminEmail}` : ""}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {log.createdAt}
            {log.ipAddress ? ` · IP ${log.ipAddress}` : ""}
          </p>
        </div>

        <div>
          <p className="text-sm font-black text-slate-950">
            {targetTypeLabel(log.targetType)}
          </p>
          {log.targetId ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="break-all rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                {log.targetId}
              </span>
              <TargetLink targetType={log.targetType} targetId={log.targetId} />
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-slate-500">
              대상 ID 없음
            </p>
          )}
          <FinanceSummary summary={log.financeSummary} />
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
            {log.reason || "운영 사유 없음"}
          </p>
        </div>

        <div>
          {needsFollowup ? <FollowupForm logId={log.logId} /> : null}
          {log.followup.isResolved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black text-emerald-700">보완 처리</p>
              <p className="mt-2 text-sm font-semibold text-emerald-900">
                {log.followup.reason ?? "보완 완료"}
              </p>
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                {log.followup.adminName ?? "관리자"} · {log.followup.createdAt}
              </p>
            </div>
          ) : null}
          <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-black text-slate-600">
              변경 데이터 보기
            </summary>
            <div className="mt-3 grid gap-3">
              <JsonBlock title="Before" value={log.before} />
              <JsonBlock title="After" value={log.after} />
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function FollowupForm({ logId }: { logId: string }) {
  return (
    <form action={resolveMissingAuditReason} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <input type="hidden" name="auditLogId" value={logId} />
      <p className="text-xs font-black text-amber-800">사유 보완</p>
      <textarea
        name="reason"
        required
        minLength={10}
        placeholder="민감 작업 사유를 10자 이상 입력"
        className="mt-3 min-h-24 w-full rounded-md border border-amber-200 bg-white p-3 text-sm font-semibold outline-none focus:border-amber-500"
      />
      <button className="mt-3 w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700">
        보완 완료
      </button>
    </form>
  );
}

function FinanceSummary({ summary }: { summary: AuditLog["financeSummary"] }) {
  if (summary.kind === "OTHER") {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
      <p className="text-xs font-black text-sky-700">{summary.label}</p>
      <div className="mt-2 grid gap-1 text-xs font-semibold text-slate-700">
        {summary.amount ? (
          <span>
            금액 {summary.amount} {summary.currency ?? ""}
          </span>
        ) : null}
        {summary.status ? <span>상태 {summary.status}</span> : null}
        {summary.txId ? <span className="break-all">TXID {summary.txId}</span> : null}
        {summary.evidenceMemo ? <span>{summary.evidenceMemo}</span> : null}
      </div>
    </div>
  );
}

function TargetLink({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const href = buildTargetHref(targetType, targetId);
  if (!href) {
    return null;
  }

  return (
    <Link
      href={href}
      className="rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-black text-sky-700 hover:border-sky-400"
    >
      바로가기
    </Link>
  );
}

function JsonBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-black text-slate-500">{title}</p>
      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-slate-950 p-3 text-xs font-semibold text-slate-100">
        {value ?? "-"}
      </pre>
    </div>
  );
}

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-slate-950"
    >
      {label}
    </Link>
  );
}

function AuditWorkflow() {
  const steps = [
    {
      title: "민감 작업 확인",
      body: "출금, 입금, 분쟁, 권한 변경 로그를 우선 확인합니다.",
      href: "/admin/audit?sensitivity=sensitive",
    },
    {
      title: "사유 보완",
      body: "사유가 비어 있는 민감 작업은 운영 메모를 남겨 추적 가능하게 만듭니다.",
      href: "/admin/audit?sensitivity=sensitive&reason=missing&followupStatus=unresolved",
    },
    {
      title: "업무 연결",
      body: "대상 ID에서 주문, 지갑 요청, 유저 상세로 이동해 실제 상태를 대조합니다.",
      href: "/admin/reports",
    },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {steps.map((step) => (
        <Link
          key={step.title}
          href={step.href}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-[var(--color-primary)]"
        >
          <p className="text-sm font-black text-slate-950">{step.title}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{step.body}</p>
        </Link>
      ))}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "slate";
}) {
  const toneClass = tone === "sky" ? "text-sky-700" : "text-slate-950";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-2 text-sm font-semibold ${
        active
          ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-slate-950"
          : "border-slate-200 bg-white text-slate-600 hover:border-[var(--color-primary)] hover:text-slate-950"
      }`}
    >
      {label}
    </Link>
  );
}

function BreakdownPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string; href: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href}
            className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm font-semibold hover:border-[var(--color-primary)]"
          >
            <span className="truncate">{item.label}</span>
            <span className="font-black text-slate-950">{item.value}</span>
          </Link>
        ))}
        {items.length === 0 ? <EmptyBox message="표시할 데이터가 없습니다." /> : null}
      </div>
    </section>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "emerald" | "rose" | "amber" | "slate";
}) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-white text-slate-700",
  }[tone];

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-black ${toneClass}`}>
      {children}
    </span>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

function buildAuditHref(filters: AuditState["filters"]) {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.query) params.set("query", filters.query);
  if (filters.adminId) params.set("adminId", filters.adminId);
  if (filters.sensitivity) params.set("sensitivity", filters.sensitivity);
  if (filters.reason) params.set("reason", filters.reason);
  if (filters.followupStatus) params.set("followupStatus", filters.followupStatus);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

function buildAuditExportHref(filters: AuditState["filters"], format: "csv" | "xlsx") {
  const params = new URLSearchParams();
  params.set("format", format);
  if (filters.action) params.set("action", filters.action);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.query) params.set("query", filters.query);
  if (filters.adminId) params.set("adminId", filters.adminId);
  if (filters.sensitivity) params.set("sensitivity", filters.sensitivity);
  if (filters.reason) params.set("reason", filters.reason);
  if (filters.followupStatus) params.set("followupStatus", filters.followupStatus);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return `/api/admin/audit/export?${params.toString()}`;
}

function buildTargetHref(targetType: string, targetId: string) {
  const type = targetType.toUpperCase();
  if (type === "ORDER") return `/admin/orders?orderId=${targetId}&query=${targetId}`;
  if (type === "DEPOSIT_REQUEST") return `/admin/deposits?requestId=${targetId}`;
  if (type === "WITHDRAWAL_REQUEST") return `/admin/withdrawals?requestId=${targetId}`;
  if (type === "USER") return `/admin/users/${targetId}`;
  if (type === "ADMIN_ACCOUNT") return `/admin/admin-accounts?query=${targetId}`;
  if (type === "GAME" || type === "GAME_SERVER") return `/admin/game-settings?query=${targetId}`;
  return null;
}

function isSensitiveAuditAction(action: string) {
  return SENSITIVE_AUDIT_ACTIONS.some((item) => action.includes(item));
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    WITHDRAWAL_COMPLETED: "출금 완료",
    WITHDRAWAL_REJECTED: "출금 반려",
    DEPOSIT_CONFIRMED: "입금 승인",
    DEPOSIT_REJECTED: "입금 반려",
    DISPUTE_REFUNDED_TO_BUYER: "분쟁 구매자 환불",
    DISPUTE_RELEASED_TO_SELLER: "분쟁 판매자 정산",
    ADMIN_USER_UPDATED: "관리자 계정 수정",
    ADMIN_ACCOUNT_PREPARED: "관리자 계정 준비",
    ADMIN_ACCOUNT_ACCESS_UPDATED: "관리자 권한 변경",
    ADMIN_INVITE_CREATED: "관리자 초대 생성",
    ADMIN_INVITE_REVOKED: "관리자 초대 회수",
    ADMIN_INVITE_ACCEPTED: "관리자 초대 수락",
    REPORT_EXPORT_CSV: "리포트 CSV 다운로드",
    REPORT_EXPORT_XLSX: "리포트 XLSX 다운로드",
    AUDIT_EXPORT_CSV: "감사 CSV 다운로드",
    AUDIT_EXPORT_XLSX: "감사 XLSX 다운로드",
    AUDIT_FOLLOWUP_RESOLVED: "감사 사유 보완",
  };

  return labels[action] ?? action.replaceAll("_", " ");
}

function targetTypeLabel(targetType: string) {
  const labels: Record<string, string> = {
    ORDER: "주문",
    DEPOSIT_REQUEST: "입금 요청",
    WITHDRAWAL_REQUEST: "출금 요청",
    USER: "유저",
    ADMIN_ACCOUNT: "관리자 계정",
    ADMIN_AUDIT_LOG: "감사 로그",
    GAME: "게임",
    GAME_SERVER: "서버",
    TRUST_REPORT: "신고",
    DISPUTE: "분쟁",
  };

  return labels[targetType] ?? targetType.replaceAll("_", " ");
}

function getAuditNextAction(state: AuditState) {
  const unresolvedMissingReasonsHref =
    "/admin/audit?sensitivity=sensitive&reason=missing&followupStatus=unresolved";
  const unresolvedCount = state.logs.filter(
    (log) => isSensitiveAuditAction(log.action) && !log.reason && !log.followup.isResolved,
  ).length;

  if (unresolvedCount > 0) {
    return {
      title: `사유 보완이 필요한 민감 로그 ${unresolvedCount}건`,
      body: "출금, 입금, 분쟁, 권한 변경처럼 돈과 권한에 닿는 작업은 사유가 비어 있으면 운영 리스크가 큽니다.",
      actionLabel: "보완 대상 보기",
      href: unresolvedMissingReasonsHref,
    };
  }

  if (state.summary.shownLogs === 0) {
    return {
      title: "조건에 맞는 로그가 없습니다",
      body: "필터를 초기화한 뒤 주문 ID나 대상 ID로 다시 검색해 보세요.",
      actionLabel: "전체 로그 보기",
      href: "/admin/audit",
    };
  }

  return {
    title: "감사 로그 추적 상태 양호",
    body: "최근 작업의 관리자, 대상, 사유, 변경 전후 데이터를 확인할 수 있습니다.",
    actionLabel: "민감 작업만 보기",
    href: "/admin/audit?sensitivity=sensitive",
  };
}

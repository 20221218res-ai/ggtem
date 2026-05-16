import type { ReactNode } from "react";
import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminFinanceReconciliationState } from "@/lib/admin/finance";
import CloseReportForm from "./close-report-form";

type AdminFinanceReconciliationPageProps = {
  searchParams?: Promise<{
    range?: string;
  }>;
};

type ReconciliationState = Awaited<
  ReturnType<typeof getAdminFinanceReconciliationState>
>;
type ChecklistItem = ReconciliationState["closeChecklist"][number];
type AnomalyFlag = ReconciliationState["anomalyFlags"][number];
type RecentEntry = ReconciliationState["recentEntries"][number];

export default async function AdminFinanceReconciliationPage({
  searchParams,
}: AdminFinanceReconciliationPageProps) {
  await requirePageRole(ROLE_GROUPS.FINANCE_OPERATORS);

  const params = searchParams ? await searchParams : undefined;
  const state = await getAdminFinanceReconciliationState({
    range: params?.range,
  });
  const blockedCount = state.closeChecklist.filter(
    (item) => item.status === "BLOCKED",
  ).length;
  const reviewCount = state.closeChecklist.filter(
    (item) => item.status === "CHECK",
  ).length;
  const criticalCount = state.anomalyFlags.filter(
    (flag) => flag.severity === "CRITICAL",
  ).length;
  const nextAction = getCloseNextAction({
    blockedCount,
    reviewCount,
    criticalCount,
    range: state.filters.range,
  });

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-700">
              RECONCILIATION
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              정산 대조
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderLink
              href={buildReconciliationExportHref(state.filters.range)}
              label="CSV"
              tone="emerald"
            />
            <HeaderLink href="/admin/finance/ledger" label="원장" />
            <HeaderLink href="/admin/deposits" label="입금" />
            <HeaderLink href="/admin/withdrawals" label="출금" />
            <HeaderLink
              href="/admin/audit?action=FINANCE_RECONCILIATION_CLOSED"
              label="감사"
            />
          </div>
        </header>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">다음 액션</p>
          <h2 className="mt-2 text-2xl font-black">{nextAction.title}</h2>
          <Link
            href={nextAction.href}
            className="mt-4 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700"
          >
            {nextAction.actionLabel}
          </Link>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-600">기간</p>
              <h2 className="mt-1 text-xl font-black">기간</h2>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {state.summary.from}부터 {state.summary.to}까지
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterTab
                href="/admin/finance/reconciliation"
                active={state.filters.range === "today"}
                label="오늘"
              />
              <FilterTab
                href="/admin/finance/reconciliation?range=7d"
                active={state.filters.range === "7d"}
                label="7일"
              />
              <FilterTab
                href="/admin/finance/reconciliation?range=30d"
                active={state.filters.range === "30d"}
                label="30일"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="원장 건수" value={`${state.summary.entryCount}건`} tone="sky" />
          <MetricCard label="관련 유저" value={`${state.summary.uniqueUsers}명`} tone="sky" />
          <MetricCard label="증가 합계" value={`${state.summary.creditAmount} USDT`} tone="emerald" />
          <MetricCard label="차감 합계" value={`${state.summary.debitAmount} USDT`} tone="rose" />
          <MetricCard label="순 이동" value={`${state.summary.netAmount} USDT`} tone="cyan" />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard
            label="마감 보류"
            value={`${blockedCount}건`}
            body="보류"
            status={blockedCount > 0 ? "danger" : "ok"}
          />
          <StatusCard
            label="검토 필요"
            value={`${reviewCount}건`}
            body="검토"
            status={reviewCount > 0 ? "warn" : "ok"}
          />
          <StatusCard
            label="긴급 이상 신호"
            value={`${criticalCount}건`}
            body="즉시 확인"
            status={criticalCount > 0 ? "danger" : "info"}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-lg border border-sky-200 bg-sky-50 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black text-sky-700">
                  체크리스트                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  마감 전 확인
                </h2>
              </div>
              <HeaderLink href="/admin/finance/ledger" label="원장" />
            </div>

            <div className="mt-5 grid gap-3">
              {state.closeChecklist.map((item) => (
                <ChecklistRow key={item.key} item={item} />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-black text-amber-800">이상 신호</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              확인 필요
            </h2>

            <div className="mt-5 space-y-3">
              {state.anomalyFlags.map((flag) => (
                <AnomalyRow key={flag.key} flag={flag} />
              ))}

              {state.anomalyFlags.length === 0 ? (
                <EmptyBox message="이상 신호 없음" />
              ) : null}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <CloseReportForm
            range={state.filters.range}
            blockedCount={blockedCount}
            reviewCount={reviewCount}
            criticalCount={criticalCount}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black text-slate-600">마감 이력</p>
                <h2 className="mt-1 text-xl font-black">
                  최근 마감                </h2>
              </div>
              <HeaderLink
                href="/admin/audit?action=FINANCE_RECONCILIATION_CLOSED"
                label="감사"
              />
            </div>

            <div className="mt-5 space-y-3">
              {state.closeReports.map((report) => (
                <div
                  key={report.reportId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {rangeLabel(report.range)} 마감 / 원장 {report.entryCount}건                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        증가 {report.creditAmount} USDT / 차감 {report.debitAmount} USDT / 순 이동 {report.netAmount} USDT
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {report.note ?? "마감 메모 없음"}
                      </p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-xs font-semibold text-slate-500">
                        {report.closedAt}
                      </p>
                      <Link
                        href={`/admin/audit?query=${encodeURIComponent(report.reportId)}`}
                        className="mt-2 block text-sm font-black text-emerald-700 hover:text-emerald-900"
                      >
                        감사 추적
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {state.closeReports.length === 0 ? (
                <EmptyBox message="마감 리포트 없음" />
              ) : null}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <BreakdownTable
            title="잔액 영역별 흐름"
            emptyLabel="영역별 이동 없음"
            rows={state.bucketBreakdown.map((item) => ({
              key: item.bucket,
              label: ledgerBucketLabel(item.bucket),
              creditAmount: item.creditAmount,
              debitAmount: item.debitAmount,
              netAmount: item.netAmount,
              count: item.count,
              href: `/admin/finance/ledger?bucket=${encodeURIComponent(item.bucket)}`,
            }))}
          />
          <BreakdownTable
            title="원장 유형별 흐름"
            emptyLabel="유형별 이동 없음"
            rows={state.typeBreakdown.map((item) => ({
              key: item.type,
              label: ledgerTypeLabel(item.type),
              creditAmount: item.creditAmount,
              debitAmount: item.debitAmount,
              netAmount: item.netAmount,
              count: item.count,
              href: `/admin/finance/ledger?q=${encodeURIComponent(item.type)}`,
            }))}
          />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-600">최근 증빙</p>
              <h2 className="mt-1 text-xl font-black">최근 원장 기록</h2>
            </div>
            <HeaderLink href="/admin/finance/ledger" label="전체 원장" />
          </div>

          <div className="mt-5 space-y-3">
            {state.recentEntries.map((entry) => (
              <RecentEntryRow key={entry.entryId} entry={entry} />
            ))}

            {state.recentEntries.length === 0 ? (
              <EmptyBox message="원장 기록 없음" />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function HeaderLink({
  href,
  label,
  tone = "slate",
}: {
  href: string;
  label: string;
  tone?: "slate" | "emerald";
}) {
  const className =
    tone === "emerald"
      ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
      : "rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700";

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
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
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
      }`}
    >
      {label}
    </Link>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "sky" | "emerald" | "rose" | "cyan";
}) {
  const toneClass = {
    blue: "text-[var(--color-primary)]",
    sky: "text-sky-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    cyan: "text-cyan-700",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusCard({
  label,
  value,
  body,
  status,
}: {
  label: string;
  value: string;
  body: string;
  status: "ok" | "warn" | "danger" | "info";
}) {
  const toneClass = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[status];

  return (
    <div className={`rounded-lg border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-black">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-sm font-semibold leading-6">{body}</p>
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <Link
      href={item.href}
      className="rounded-lg border border-sky-200 bg-white p-4 hover:bg-sky-100"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">
            {checklistLabel(item.label)}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            {checklistDetail(item.detail)}
          </p>
          <p className="mt-2 text-xs font-black text-sky-700">
            {checklistAction(item.status)}
          </p>
        </div>
        <Badge tone={checklistTone(item.status)}>
          {checklistStatusLabel(item.status)}
        </Badge>
      </div>
    </Link>
  );
}

function AnomalyRow({ flag }: { flag: AnomalyFlag }) {
  return (
    <Link
      href={flag.href}
      className="block rounded-lg border border-amber-200 bg-white p-4 hover:bg-amber-100"
    >
      <Badge tone={anomalyTone(flag.severity)}>
        {anomalySeverityLabel(flag.severity)}
      </Badge>
      <p className="mt-3 text-sm font-black text-slate-950">
        {anomalyLabel(flag.label)}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
        {anomalyDetail(flag.detail)}
      </p>
    </Link>
  );
}

function RecentEntryRow({ entry }: { entry: RecentEntry }) {
  const isCredit = entry.direction === "CREDIT";

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={isCredit ? "emerald" : "rose"}>
              {ledgerDirectionLabel(entry.direction)}
            </Badge>
            <Badge tone="slate">{ledgerBucketLabel(entry.bucket)}</Badge>
          </div>
          <Link
            href={`/admin/users/${entry.userId}`}
            className="mt-3 block text-sm font-black text-slate-950 hover:text-emerald-700"
          >
            {entry.userName} / {entry.userEmail}
          </Link>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {ledgerTypeLabel(entry.type)}
          </p>
        </div>
        <div className="text-left lg:text-right">
          <p
            className={`text-lg font-black ${
              isCredit ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {isCredit ? "+" : "-"}
            {entry.amount} {entry.currency}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {entry.createdAt}
          </p>
        </div>
      </div>
    </article>
  );
}

function BreakdownTable({
  title,
  emptyLabel,
  rows,
}: {
  title: string;
  emptyLabel: string;
  rows: Array<{
    key: string;
    label: string;
    creditAmount: string;
    debitAmount: string;
    netAmount: string;
    count: number;
    href: string;
  }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <Link
            key={row.key}
            href={row.href}
            className="block rounded-lg border border-slate-200 bg-slate-50 p-4 hover:bg-emerald-50"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">{row.label}</p>
                <p className="mt-2 text-xs font-black text-slate-600">
                  {row.count}건                </p>
              </div>
              <div className="grid gap-1 text-sm font-semibold text-slate-700 lg:text-right">
                <p>증가 {row.creditAmount} USDT</p>
                <p>차감 {row.debitAmount} USDT</p>
                <p className="font-black text-cyan-700">
                  순 이동 {row.netAmount} USDT
                </p>
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 ? <EmptyBox message={emptyLabel} /> : null}
      </div>
    </section>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "emerald" | "rose" | "slate" | "amber" | "sky";
}) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-white text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  }[tone];

  return (
    <span className={`w-fit rounded-md border px-2 py-1 text-xs font-black ${toneClass}`}>
      {children}
    </span>
  );
}

function buildReconciliationExportHref(range: string) {
  return range === "7d" || range === "30d"
    ? `/api/admin/finance/reconciliation/export?range=${range}`
    : "/api/admin/finance/reconciliation/export";
}

function getCloseNextAction({
  blockedCount,
  reviewCount,
  criticalCount,
  range,
}: {
  blockedCount: number;
  reviewCount: number;
  criticalCount: number;
  range: string;
}) {
  if (blockedCount > 0 || criticalCount > 0) {
    return {
      title: `보류 ${blockedCount}건`,
      body: `마감 보류 ${blockedCount}건, 긴급 이상 신호 ${criticalCount}건이 있습니다. 충전, 출금, 주문 증빙을 먼저 확인하세요.`,
      actionLabel: "입출금",
      href: "/admin/finance",
    };
  }

  if (reviewCount > 0) {
    return {
      title: `검토 ${reviewCount}건`,
      body: `검토 필요 ${reviewCount}건이 있습니다. 원장과 CSV를 확인한 뒤 마감 리포트 메모에 결과를 남기세요.`,
      actionLabel: "CSV",
      href: buildReconciliationExportHref(range),
    };
  }

  return {
    title: "마감 가능",
    body: "보류와 긴급 신호가 없습니다. CSV를 보관하고 마감 메모를 남겨 운영 기록을 저장하세요.",
    actionLabel: "CSV",
    href: buildReconciliationExportHref(range),
  };
}

function rangeLabel(range: string) {
  const labels: Record<string, string> = {
    today: "오늘",
    "7d": "7일",
    "30d": "30일",
  };
  return labels[range] ?? range;
}

function checklistStatusLabel(status: string) {
  const labels: Record<string, string> = {
    READY: "정상",
    CHECK: "확인 필요",
    BLOCKED: "마감 보류",
  };
  return labels[status] ?? status;
}

function checklistTone(status: string): "emerald" | "rose" | "amber" {
  if (status === "READY") return "emerald";
  if (status === "BLOCKED") return "rose";
  return "amber";
}

function checklistAction(status: string) {
  if (status === "BLOCKED") {
    return "마감 전에 운영자가 확인해야 합니다.";
  }
  if (status === "CHECK") {
    return "확인 결과를 마감 메모에 남기세요.";
  }
  return "마감 기준을 통과한 항목입니다.";
}

function checklistLabel(label: string) {
  const labels: Record<string, string> = {
    "Open withdrawals": "처리 대기 출금",
    "Open deposits": "확인 대기 입금",
    "Ledger volume": "원장 기록",
    "Export evidence": "CSV 증빙 보관",
    "Review net wallet movement": "순 지갑 이동 검토",
    "Match withdrawal evidence": "출금 증빙 대조",
    "Review platform revenue": "플랫폼 수익 대조",
    "Multiple withdrawal movements": "다수 출금 이동",
  };
  return labels[label] ?? label;
}

function checklistDetail(detail: string) {
  return detail
    .replace("pending withdrawals", "처리 대기 출금")
    .replace("pending deposits", "확인 대기 입금")
    .replace(
      "No open withdrawals in the selected period.",
      "선택한 기간에는 처리 대기 출금이 없습니다.",
    )
    .replace(
      "No open deposits in the selected period.",
      "선택한 기간에는 확인 대기 입금이 없습니다.",
    )
    .replace(
      "Export the CSV and attach it to the finance close note.",
      "CSV를 내려받아 마감 증빙으로 보관하세요.",
    )
    .replace(
      "No withdrawal ledger activity was found in this period.",
      "해당 기간에는 출금 원장 활동이 없습니다.",
    )
    .replace(
      "Platform revenue exists. Match fee and premium promotion ledger entries before closing.",
      "플랫폼 수익이 있습니다. 수수료와 프리미엄 결제 원장을 마감 전에 대조하세요.",
    )
    .replace(
      "No platform revenue movement was found in this period.",
      "해당 기간에는 플랫폼 수익 이동이 없습니다.",
    )
    .replace(
      "Review total credit/debit movement before close.",
      "마감 전 전체 증가와 차감 이동을 검토하세요.",
    );
}

function anomalySeverityLabel(severity: string) {
  const labels: Record<string, string> = {
    INFO: "정보",
    WARN: "주의",
    CRITICAL: "긴급",
  };
  return labels[severity] ?? severity;
}

function anomalyTone(severity: string): "rose" | "amber" | "sky" {
  if (severity === "CRITICAL") return "rose";
  if (severity === "WARN") return "amber";
  return "sky";
}

function anomalyLabel(label: string) {
  const labels: Record<string, string> = {
    "No ledger entries": "원장 기록 없음",
    "Large credit/debit movement": "큰 금액 이동",
    "Open withdrawal requests": "처리 대기 출금 요청",
    "Open deposit requests": "확인 대기 입금 요청",
    "Multiple withdrawal movements": "다수 출금 이동",
    "Negative platform revenue": "플랫폼 수익 음수",
  };
  return labels[label] ?? label;
}

function anomalyDetail(detail: string) {
  return detail
    .replace(
      "No wallet ledger entries were found for this period.",
      "해당 기간에는 지갑 원장 기록이 없습니다.",
    )
    .replace(
      "Credit or debit total crossed the 1000 USDT review threshold.",
      "증가 또는 차감 합계가 1000 USDT 검토 기준을 넘었습니다.",
    )
    .replace(
      "Withdrawals are still waiting for completion or rejection.",
      "완료 또는 거절되지 않은 출금 요청이 남아 있습니다.",
    )
    .replace(
      "Deposits are still waiting for confirmation or rejection.",
      "승인 또는 반려되지 않은 입금 요청이 남아 있습니다.",
    )
    .replace(
      "withdrawal-related ledger entries appeared in this period.",
      "개의 출금 관련 원장 기록이 해당 기간에 발생했습니다.",
    )
    .replace(
      "Revenue buckets should not close negative.",
      "수익 영역은 음수로 마감되면 안 됩니다.",
    );
}

function ledgerDirectionLabel(direction: string) {
  if (direction === "CREDIT") return "증가";
  if (direction === "DEBIT") return "차감";
  return direction;
}

function ledgerBucketLabel(bucket: string) {
  const labels: Record<string, string> = {
    AVAILABLE: "사용 가능 잔액",
    ESCROW_LOCKED: "에스크로 잠금",
    WITHDRAWABLE: "출금 가능 잔액",
    PENDING_SETTLEMENT: "정산 대기",
    WITHDRAWAL_LOCKED: "출금 처리 잠금",
    BUY_REQUEST_LOCKED: "구매요청 예치금",
    PLATFORM_REVENUE: "플랫폼 수익",
  };
  return labels[bucket] ?? bucket.replaceAll("_", " ");
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    DEPOSIT: "입금",
    WITHDRAWAL: "출금",
    ESCROW_LOCK: "에스크로 잠금",
    ESCROW_RELEASE: "에스크로 지급",
    ESCROW_REFUND: "에스크로 환불",
    SETTLEMENT: "정산",
    DISPUTE_REFUND: "분쟁 환불",
    DISPUTE_RELEASE: "분쟁 지급",
    ADMIN_ADJUSTMENT: "관리자 조정",
    ADMIN_DEPOSIT_APPROVED: "관리자 입금 승인",
    BUYER_ESCROW_LOCKED: "구매 결제 잠금",
    ORDER_COMPLETED_RELEASE_TO_SELLER: "거래 완료 정산",
    PLATFORM_FEE_COLLECTED: "플랫폼 수수료",
    SETTLEMENT_AVAILABLE: "출금 가능 정산",
    BUY_REQUEST_LOCKED: "구매요청 예치금 잠금",
    BUY_REQUEST_RELEASED: "구매요청 예치금 반환",
    WITHDRAWAL_REQUESTED: "출금 요청",
    WITHDRAWAL_COMPLETED: "출금 완료",
    WITHDRAWAL_REJECTED: "출금 반려",
    PREMIUM_PROMOTION_PURCHASED: "프리미엄 노출 결제",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

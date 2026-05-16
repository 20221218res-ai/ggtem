import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminFinanceState } from "@/lib/admin/finance";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import FinanceActions from "../finance/finance-actions";

type FinanceState = Awaited<ReturnType<typeof getAdminFinanceState>>;
type PendingWithdrawal = FinanceState["pendingWithdrawals"][number];

export default async function AdminWithdrawalsPage() {
  await requirePageRole(ROLE_GROUPS.FINANCE_OPERATORS);

  const state = await getAdminFinanceState();
  const hasPendingWithdrawals = state.pendingWithdrawals.length > 0;

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-amber-700">WITHDRAWAL DESK</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">출금 처리</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              받을 주소, 체인, 수수료, 총 차감액을 확인하고 실제 송금 후 TXID를 남깁니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderLink href="/admin/deposits" label="충전 승인" />
            <HeaderLink href="/admin/finance/ledger?q=WITHDRAWAL" label="출금 원장" />
            <HeaderLink href="/admin/audit?targetType=WITHDRAWAL_REQUEST" label="출금 감사 로그" />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="처리 대기" value={`${state.summary.pendingWithdrawals}건`} tone="amber" />
          <MetricCard label="대기 금액" value={`${state.summary.pendingWithdrawalAmount} USDT`} tone="sky" />
          <MetricCard label="처리 기준" value="실제 송금 후 TXID 입력" tone="red" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">출금 요청</p>
              <h2 className="mt-1 text-xl font-black">처리 대기 중인 USDT 출금</h2>
            </div>
            <StatusBadge
              label={hasPendingWithdrawals ? "출금 처리 필요" : "출금 대기 없음"}
              tone={hasPendingWithdrawals ? "red" : "emerald"}
            />
          </div>

          <div className="mt-5 space-y-4">
            {state.pendingWithdrawals.map((item) => (
              <WithdrawalReviewCard key={item.requestId} item={item} />
            ))}
            {!hasPendingWithdrawals ? (
              <EmptyState
                title="처리 대기 중인 출금 요청이 없습니다."
                href="/admin/finance?kind=withdrawal"
                label="출금 처리 이력 보기"
              />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function WithdrawalReviewCard({ item }: { item: PendingWithdrawal }) {
  const hasRiskFlags = item.riskFlags.length > 0;

  return (
    <article className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label="1. 출금 요청 확인" tone="amber" />
            <StatusBadge label={requestStatusLabel(item.status)} tone="amber" />
            <StatusBadge
              label={hasRiskFlags ? `위험 신호 ${item.riskFlags.length}개` : "위험 신호 없음"}
              tone={hasRiskFlags ? "red" : "emerald"}
            />
          </div>
          <p className="mt-3 text-lg font-black text-slate-950">{item.userName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{item.userEmail}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-left lg:text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">출금 금액</p>
          <p className="mt-1 text-2xl font-black text-amber-700">
            {item.amount} {item.currency}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            수수료 {item.fee} / 총 차감 {item.totalDebit}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <InfoPanel title="2. 송금 정보">
          <InfoRow label="체인" value={item.chain ?? "TRC20"} />
          <InfoRow label="받을 주소" value={item.destination} breakAll />
          <InfoRow label="실수령" value={`${item.netAmount} ${item.currency}`} />
          <InfoRow label="요청 시각" value={item.requestedAt} />
        </InfoPanel>

        <InfoPanel title="3. 금액 확인">
          <InfoRow label="출금 요청액" value={`${item.amount} ${item.currency}`} />
          <InfoRow label="수수료" value={`${item.fee} ${item.currency}`} />
          <InfoRow label="총 차감" value={`${item.totalDebit} ${item.currency}`} />
          <InfoRow label="메모" value={item.memo ?? "없음"} />
          {item.lastLog ? <InfoRow label="최근 로그" value={item.lastLog} /> : null}
        </InfoPanel>
      </div>

      {hasRiskFlags ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.riskFlags.map((flag) => (
            <span
              key={flag}
              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-black text-red-700"
            >
              {withdrawalRiskFlagLabel(flag)}
            </span>
          ))}
        </div>
      ) : null}

      <Checklist
        title="4. 완료 전 체크"
        items={[
          { label: "받을 주소 확인", done: Boolean(item.destination) },
          { label: "체인 확인", done: Boolean(item.chain) },
          { label: "금액/수수료 확인", done: Boolean(item.amount && item.fee) },
          { label: "실제 송금 후 TXID 입력", done: false },
        ]}
      />

      <TraceLinks requestId={item.requestId} />
      <FinanceActions
        kind="WITHDRAWAL"
        requestId={item.requestId}
        primaryAction="COMPLETE_WITHDRAWAL"
        primaryLabel="출금 완료 처리"
        secondaryAction="REJECT_WITHDRAWAL"
        secondaryLabel="출금 반려"
        completionPhrase="출금완료"
        completionPhraseLabel="출금 완료 확인 문구"
        confirmationSummary={`금액: ${item.amount} ${item.currency}\n수수료: ${item.fee} ${item.currency}\n실수령: ${item.netAmount} ${item.currency}\n유저: ${item.userName} <${item.userEmail}>\n받을 주소: ${item.destination}\n메모: ${item.memo ?? "없음"}`}
      />
    </article>
  );
}

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      {label}
    </Link>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "amber" | "sky" | "red" }) {
  const tones = {
    amber: "text-amber-700",
    sky: "text-sky-700",
    red: "text-red-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "amber" | "emerald" | "red" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return <span className={`rounded-md border px-2 py-1 text-xs font-black ${tones[tone]}`}>{label}</span>;
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <dl className="mt-3 grid gap-3 text-sm text-slate-700">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-black text-slate-500">{label}</dt>
      <dd className={`mt-1 font-bold text-slate-900 ${breakAll ? "break-all" : ""}`}>{value}</dd>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: Array<{ label: string; done: boolean }> }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-white p-3 text-slate-950">
      <p className="text-sm font-black">{title}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs font-bold">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${item.done ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}>
              {item.done ? "OK" : "!"}
            </span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceLinks({ requestId }: { requestId: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-200 pt-3">
      <HeaderLink href={`/admin/finance/ledger?q=${encodeURIComponent(requestId)}`} label="지갑 원장" />
      <HeaderLink href={`/admin/audit?q=${encodeURIComponent(requestId)}`} label="감사 로그" />
      <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
        요청 ID {requestId}
      </span>
    </div>
  );
}

function EmptyState({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      >
        {label}
      </Link>
    </div>
  );
}

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "요청 접수",
    UNDER_REVIEW: "검토 중",
    PENDING: "승인 대기",
    APPROVED: "승인됨",
    SENT: "송금 중",
    CONFIRMED: "입금 완료",
    COMPLETED: "출금 완료",
    REJECTED: "거절됨",
  };
  return labels[status] ?? status;
}

function withdrawalRiskFlagLabel(flag: string) {
  const labels: Record<string, string> = {
    SAME_IP_MULTI_ACCOUNT_WITHDRAWAL: "동일 IP 다계정 출금",
    SAME_IP_WITHDRAWAL_REVIEW: "동일 IP 검토",
    SAME_DEVICE_MULTI_ACCOUNT_WITHDRAWAL: "동일 기기 다계정 출금",
    SAME_DEVICE_WITHDRAWAL_REVIEW: "동일 기기 검토",
    SHORT_INTERVAL_WITHDRAWAL_ATTEMPT: "짧은 간격 반복 요청",
  };
  return labels[flag] ?? flag;
}

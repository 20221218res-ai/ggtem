import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminFinanceState } from "@/lib/admin/finance";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import FinanceActions from "../finance/finance-actions";

type FinanceState = Awaited<ReturnType<typeof getAdminFinanceState>>;
type PendingDeposit = FinanceState["pendingDeposits"][number];

export default async function AdminDepositsPage() {
  await requirePageRole(ROLE_GROUPS.FINANCE_OPERATORS);

  const state = await getAdminFinanceState();
  const hasPendingDeposits = state.pendingDeposits.length > 0;

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--color-primary)]">DEPOSIT DESK</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">충전 승인</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              TXID, 체인, 입금 주소, 금액을 대조한 뒤 승인 또는 반려합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderLink href="/admin/withdrawals" label="출금 처리" />
            <HeaderLink href="/admin/finance/ledger" label="지갑 원장" />
            <HeaderLink href="/admin/audit?targetType=DEPOSIT_REQUEST" label="입금 감사 로그" />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="승인 대기" value={`${state.summary.pendingDeposits}건`} tone="emerald" />
          <MetricCard label="대기 금액" value={`${state.summary.pendingDepositAmount} USDT`} tone="sky" />
          <MetricCard label="처리 기준" value="TXID 확인 후 승인" tone="amber" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">입금 요청</p>
              <h2 className="mt-1 text-xl font-black">확인 대기 중인 USDT 입금</h2>
            </div>
            <StatusBadge
              label={hasPendingDeposits ? "승인 대기 있음" : "승인 대기 없음"}
              tone={hasPendingDeposits ? "amber" : "emerald"}
            />
          </div>

          <div className="mt-5 space-y-4">
            {state.pendingDeposits.map((item) => (
              <DepositReviewCard key={item.requestId} item={item} />
            ))}
            {!hasPendingDeposits ? (
              <EmptyState
                title="확인 대기 중인 입금 요청이 없습니다."
                href="/admin/finance?kind=deposit"
                label="입금 처리 이력 보기"
              />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function DepositReviewCard({ item }: { item: PendingDeposit }) {
  const hasRiskFlags = item.riskFlags.length > 0;
  const hasValidTxId = Boolean(item.evidence.txHash && !item.evidence.isTxHashPending);

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label="1. 입금 정보 확인" tone="emerald" />
            <StatusBadge label={requestStatusLabel(item.status)} tone="amber" />
            <StatusBadge
              label={hasRiskFlags ? `위험 신호 ${item.riskFlags.length}개` : "위험 신호 없음"}
              tone={hasRiskFlags ? "red" : "emerald"}
            />
            <StatusBadge label={hasValidTxId ? "TXID 제출됨" : "TXID 필요"} tone={hasValidTxId ? "emerald" : "red"} />
          </div>
          <p className="mt-3 text-lg font-black text-slate-950">{item.userName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{item.userEmail}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left lg:text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">요청 금액</p>
          <p className="mt-1 text-2xl font-black text-emerald-800">
            {item.amount} {item.currency}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <InfoPanel title="2. 입금 증빙">
          <InfoRow label="코인" value={item.evidence.asset ?? "미확인"} />
          <InfoRow label="네트워크" value={item.evidence.network ?? "미확인"} />
          <InfoRow label="입금 주소" value={item.evidence.depositAddress ?? "미입력"} breakAll />
          <InfoRow
            label="TXID"
            value={item.evidence.txHash ?? "아직 제출되지 않음"}
            breakAll
            tone={item.evidence.isTxHashPending ? "text-amber-700" : "text-emerald-700"}
          />
        </InfoPanel>

        <InfoPanel title="3. 요청 정보">
          <InfoRow label="방식" value={item.provider} />
          <InfoRow label="요청 시각" value={item.requestedAt} />
          <InfoRow label="메모" value={item.evidence.note ?? item.memo ?? "없음"} />
        </InfoPanel>
      </div>

      <Checklist
        title="4. 승인 전 체크"
        items={[
          { label: "코인 정보 확인", done: Boolean(item.evidence.asset) },
          { label: "네트워크 확인", done: Boolean(item.evidence.network) },
          { label: "입금 주소 확인", done: Boolean(item.evidence.depositAddress) },
          { label: "TXID 제출 확인", done: hasValidTxId },
        ]}
      />

      <TraceLinks requestId={item.requestId} />
      <FinanceActions
        kind="DEPOSIT"
        requestId={item.requestId}
        primaryAction="CONFIRM_DEPOSIT"
        primaryLabel="입금 승인"
        secondaryAction="REJECT_DEPOSIT"
        secondaryLabel="입금 반려"
        confirmationSummary={`금액: ${item.amount} ${item.currency}\n유저: ${item.userName} <${item.userEmail}>\nTXID: ${item.evidence.txHash ?? "미제출"}\n입금 주소: ${item.evidence.depositAddress ?? "미입력"}\n네트워크: ${item.evidence.network ?? "미확인"}`}
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

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "emerald" | "sky" | "amber" }) {
  const tones = {
    emerald: "text-emerald-700",
    sky: "text-sky-700",
    amber: "text-amber-700",
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

function InfoRow({ label, value, breakAll = false, tone = "text-slate-900" }: { label: string; value: string; breakAll?: boolean; tone?: string }) {
  return (
    <div>
      <dt className="text-xs font-black text-slate-500">{label}</dt>
      <dd className={`mt-1 font-bold ${breakAll ? "break-all" : ""} ${tone}`}>{value}</dd>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: Array<{ label: string; done: boolean }> }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
      <p className="text-sm font-black">{title}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs font-bold">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${item.done ? "bg-emerald-600 text-white" : "bg-white text-amber-700"}`}>
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
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
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

import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminFinanceState } from "@/lib/admin/finance";
import FinanceActions from "./finance-actions";

type AdminFinancePageProps = {
  searchParams?: Promise<{
    q?: string;
    kind?: string;
    status?: string;
  }>;
};

type FinanceState = Awaited<ReturnType<typeof getAdminFinanceState>>;
type PendingDeposit = FinanceState["pendingDeposits"][number];
type PendingWithdrawal = FinanceState["pendingWithdrawals"][number];
type ProcessedItem = FinanceState["recentProcessed"][number];
type HistoryKind = "ALL" | "DEPOSIT" | "WITHDRAWAL";
type HistoryStatus = "ALL" | "APPROVED" | "REJECTED";

export default async function AdminFinancePage({
  searchParams,
}: AdminFinancePageProps) {
  await requirePageRole(ROLE_GROUPS.FINANCE_OPERATORS);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const state = await getAdminFinanceState();
  const query = resolvedSearchParams?.q?.trim() ?? "";
  const kind = getHistoryKindFilter(resolvedSearchParams?.kind);
  const status = getHistoryStatusFilter(resolvedSearchParams?.status);
  const nextAction = getOperationNextAction({
    pendingDeposits: state.summary.pendingDeposits,
    pendingWithdrawals: state.summary.pendingWithdrawals,
  });

  const filteredHistory = state.recentProcessed.filter((item) => {
    const matchesKind = kind === "ALL" || item.kind === kind;
    const matchesStatus =
      status === "ALL" || mapHistoryStatus(item.status) === status;
    const target = [
      item.requestId,
      item.kind,
      item.status,
      item.userName,
      item.userEmail,
      item.amount,
      item.currency,
      item.provider,
      item.processedAt,
      item.memo ?? "",
      item.destination ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesKind && matchesStatus && (!query || target.includes(query.toLowerCase()))
    );
  });

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-emerald-700">FINANCE DESK</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">입출금 운영</h1>
              <p className="mt-2 text-sm font-bold text-slate-500">{nextAction.title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HeaderLink href="/admin/deposits" label="입금" />
              <HeaderLink href="/admin/withdrawals" label="출금" />
              <HeaderLink href="/admin/finance/ledger" label="원장" />
              <HeaderLink href="/admin/finance/reconciliation" label="정산" />
              <HeaderLink href={nextAction.href} label={nextAction.actionLabel} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="입금 대기"
              value={`${state.summary.pendingDeposits}건`}
              tone="emerald"
            />
            <MetricCard
              label="출금 대기"
              value={`${state.summary.pendingWithdrawals}건`}
              tone="amber"
            />
            <MetricCard
              label="입금 대기액"
              value={`${state.summary.pendingDepositAmount} USDT`}
              tone="sky"
            />
            <MetricCard
              label="출금 대기액"
              value={`${state.summary.pendingWithdrawalAmount} USDT`}
              tone="sky"
            />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <QueueCard
            href="/admin/deposits"
            eyebrow="입금"
            title={`${state.summary.pendingDeposits}건 승인 대기`}
            amount={`${state.summary.pendingDepositAmount} USDT`}
            actionLabel="입금"
            tone="emerald"
          />
          <QueueCard
            href="/admin/withdrawals"
            eyebrow="출금"
            title={`${state.summary.pendingWithdrawals}건 처리 대기`}
            amount={`${state.summary.pendingWithdrawalAmount} USDT`}
            actionLabel="출금"
            tone="amber"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div id="pending-deposits">
              <SectionTitle eyebrow="입금" title="대기 입금" />
            </div>
            <div className="mt-5 space-y-3">
              {state.pendingDeposits.map((item) => (
                <DepositCard key={item.requestId} item={item} />
              ))}
              {state.pendingDeposits.length === 0 ? (
                <EmptyBox message="대기 입금 없음" />
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div id="pending-withdrawals">
              <SectionTitle eyebrow="출금" title="대기 출금" />
            </div>
            <div className="mt-5 space-y-3">
              {state.pendingWithdrawals.map((item) => (
                <WithdrawalCard key={item.requestId} item={item} />
              ))}
              {state.pendingWithdrawals.length === 0 ? (
                <EmptyBox message="대기 출금 없음" />
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionTitle eyebrow="이력" title="처리 기록" />
            <HeaderLink href="/admin/audit" label="감사" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <FilterTab
              href={buildFinanceHistoryHref({ q: query, status })}
              active={kind === "ALL"}
              label={`전체 ${state.recentProcessed.length}`}
            />
            <FilterTab
              href={buildFinanceHistoryHref({
                q: query,
                kind: "DEPOSIT",
                status,
              })}
              active={kind === "DEPOSIT"}
              label={`입금 ${
                state.recentProcessed.filter((item) => item.kind === "DEPOSIT")
                  .length
              }`}
            />
            <FilterTab
              href={buildFinanceHistoryHref({
                q: query,
                kind: "WITHDRAWAL",
                status,
              })}
              active={kind === "WITHDRAWAL"}
              label={`출금 ${
                state.recentProcessed.filter((item) => item.kind === "WITHDRAWAL")
                  .length
              }`}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <FilterTab
              href={buildFinanceHistoryHref({ q: query, kind })}
              active={status === "ALL"}
              label="상태 전체"
            />
            <FilterTab
              href={buildFinanceHistoryHref({
                q: query,
                kind,
                status: "APPROVED",
              })}
              active={status === "APPROVED"}
              label="승인/완료"
            />
            <FilterTab
              href={buildFinanceHistoryHref({
                q: query,
                kind,
                status: "REJECTED",
              })}
              active={status === "REJECTED"}
              label="거절"
            />
          </div>

          <form action="/admin/finance" className="mt-4 flex flex-col gap-3 md:flex-row">
            {kind !== "ALL" ? (
              <input type="hidden" name="kind" value={kind.toLowerCase()} />
            ) : null}
            {status !== "ALL" ? (
              <input type="hidden" name="status" value={status.toLowerCase()} />
            ) : null}
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="유저, 이메일, 금액, 요청 ID"
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
            >
              검색
            </button>
            <Link
              href={buildFinanceHistoryHref({ kind, status })}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
            >
              검색 초기화
            </Link>
          </form>

          <div className="mt-5 space-y-3">
            {filteredHistory.map((item) => (
              <HistoryCard key={item.requestId} item={item} />
            ))}
            {filteredHistory.length === 0 ? (
              <EmptyBox message="처리 기록 없음" />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function DepositCard({ item }: { item: PendingDeposit }) {
  const hasRiskFlags = item.riskFlags.length > 0;

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            확인 대기          </p>
          <p className="mt-2 text-lg font-black">{item.userName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {item.userEmail}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label={requestStatusLabel(item.status)} tone="amber" />
            {hasRiskFlags ? (
              <StatusBadge label={`위험 신호 ${item.riskFlags.length}개`} tone="red" />
            ) : (
              <StatusBadge label="위험 신호 없음" tone="emerald" />
            )}
          </div>
        </div>
        <p className="text-sm font-black text-emerald-700">
          {item.amount} {item.currency}
        </p>
      </div>

      <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
        <InfoLine label="코인" value={item.evidence.asset ?? "미확인"} />
        <InfoLine label="네트워크" value={item.evidence.network ?? "미확인"} />
        <InfoLine
          label="입금 주소"
          value={item.evidence.depositAddress ?? "미입력"}
          breakAll
        />
        <InfoLine label="TXID" value={item.evidence.txHash ?? "미제출"} breakAll />
        <InfoLine
          label="요청 메모"
          value={item.evidence.note ?? item.memo ?? "없음"}
        />
        <InfoLine label="요청 시각" value={item.requestedAt} />
      </div>

      <AdminChecklist
        title="입금 승인 전 확인"
        tone="emerald"
        items={[
          {
            label: "코인/네트워크 일치",
            checked: Boolean(item.evidence.asset && item.evidence.network),
          },
          {
            label: "입금 주소 확인",
            checked: Boolean(item.evidence.depositAddress),
          },
          {
            label: "TXID 제출",
            checked: Boolean(item.evidence.txHash && !item.evidence.isTxHashPending),
          },
          {
            label: "저장/감사 추적 준비",
            checked: true,
          },
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
        confirmationSummary="입금 요청 금액, 유저, TXID, 입금 주소, 네트워크를 확인한 뒤 처리합니다."
      />
    </article>
  );
}

function WithdrawalCard({ item }: { item: PendingWithdrawal }) {
  const hasRiskFlags = item.riskFlags.length > 0;

  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
            출금 처리 필요
          </p>
          <p className="mt-2 text-lg font-black">{item.userName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {item.userEmail}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label={requestStatusLabel(item.status)} tone="amber" />
            {hasRiskFlags ? (
              <StatusBadge label={`위험 신호 ${item.riskFlags.length}개`} tone="red" />
            ) : (
              <StatusBadge label="위험 신호 없음" tone="emerald" />
            )}
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            출금 금액
          </p>
          <p className="mt-1 text-2xl font-black text-amber-700">
            {item.amount} {item.currency}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            수수료 {item.fee} / 총 차감 {item.totalDebit}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
        <InfoLine label="체인" value={item.chain ?? "TRC20"} />
        <InfoLine label="실지급" value={`${item.netAmount} ${item.currency}`} />
        <InfoLine label="수수료" value={`${item.fee} ${item.currency}`} />
        <InfoLine label="총 차감" value={`${item.totalDebit} ${item.currency}`} />
        <InfoLine label="방식" value={item.provider} />
        <InfoLine label="받을 주소" value={item.destination} breakAll />
        <InfoLine label="요청 시각" value={item.requestedAt} />
        <InfoLine label="메모" value={item.memo ?? "없음"} />
        {item.lastLog ? <InfoLine label="최근 로그" value={item.lastLog} /> : null}
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

      <AdminChecklist
        title="출금 완료 전 확인"
        tone="amber"
        items={[
          {
            label: "받을 주소 확인",
            checked: Boolean(item.destination),
          },
          {
            label: "금액/수수료 확인",
            checked: Boolean(item.amount && item.fee),
          },
          {
            label: "실제 송금 후 TXID 입력",
            checked: false,
          },
          {
            label: "저장/감사 추적 준비",
            checked: true,
          },
        ]}
      />
      <TraceLinks requestId={item.requestId} />
      <FinanceActions
        kind="WITHDRAWAL"
        requestId={item.requestId}
        primaryAction="COMPLETE_WITHDRAWAL"
        primaryLabel="출금 완료 처리"
        secondaryAction="REJECT_WITHDRAWAL"
        secondaryLabel="출금 거절"
        completionPhrase="출금완료"
        completionPhraseLabel="출금 완료 확인 문구"
        confirmationSummary={`금액: ${item.amount} ${item.currency}\n수수료: ${item.fee} ${item.currency}\n실지급: ${item.netAmount} ${item.currency}\n유저: ${item.userName} <${item.userEmail}>\n받을 주소: ${item.destination}\n메모: ${item.memo ?? "없음"}`}
      />
    </article>
  );
}

function HistoryCard({ item }: { item: ProcessedItem }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            {historyKindLabel(item.kind)} / {historyStatusLabel(item.status)}
          </p>
          <Link
            href={`/admin/users/${item.userId}`}
            className="mt-2 block text-lg font-black hover:text-emerald-700"
          >
            {item.userName}
          </Link>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {item.userEmail}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            방식 {item.provider} / 처리 시각 {item.processedAt}
          </p>
          {item.destination ? (
            <p className="mt-2 break-all font-mono text-xs font-semibold text-slate-600">
              출금 주소 {item.destination}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">
            메모: {item.memo ?? "없음"}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-lg font-black text-[var(--gg-accent)]">
            {item.amount} {item.currency}
          </p>
          <p className="mt-2 break-all text-xs font-medium text-slate-500">
            {item.requestId}
          </p>
        </div>
      </div>
      <TraceLinks requestId={item.requestId} />
    </article>
  );
}

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700"
    >
      {label}
    </Link>
  );
}

function QueueCard({
  href,
  eyebrow,
  title,
  amount,
  actionLabel,
  tone,
}: {
  href: string;
  eyebrow: string;
  title: string;
  amount: string;
  actionLabel: string;
  tone: "emerald" | "amber";
}) {
  const tones = {
    emerald: {
      border: "border-emerald-200",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      button: "bg-emerald-600 text-white hover:bg-emerald-700",
    },
    amber: {
      border: "border-amber-200",
      bg: "bg-amber-50",
      text: "text-amber-700",
      button: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    },
  }[tone];

  return (
    <Link
      href={href}
      className={`rounded-lg border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones.border} ${tones.bg}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${tones.text}`}>{eyebrow}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{title}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${tones.button}`}>{actionLabel}</span>
      </div>
      <p className={`mt-4 text-xl font-black ${tones.text}`}>{amount}</p>
    </Link>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-500">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "sky" | "cyan";
}) {
  const tones = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    sky: "text-sky-700",
    cyan: "text-[var(--color-primary)]",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "amber" | "emerald" | "red";
}) {
  const tones = {
    amber: "border-amber-200 bg-white text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-black ${tones[tone]}`}>
      {label}
    </span>
  );
}

function AdminChecklist({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ label: string; checked: boolean }>;
  tone: "emerald" | "amber";
}) {
  const className =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <details className={`mt-4 rounded-lg border p-3 ${className}`}>
      <summary className="cursor-pointer text-sm font-black">{title}</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs font-bold">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                item.checked ? "bg-emerald-600 text-white" : "bg-white text-amber-700"
              }`}
            >
              {item.checked ? "OK" : "!"}
            </span>
            {item.label}
          </div>
        ))}
      </div>
    </details>
  );
}

function InfoLine({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <p className={`mt-1 ${breakAll ? "break-all" : ""}`}>
      <span className="font-black">{label}</span> {value}
    </p>
  );
}

function TraceLinks({ requestId }: { requestId: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
      <Link
        href={`/admin/finance/ledger?q=${encodeURIComponent(requestId)}`}
        className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
      >
        지갑 원장
      </Link>
      <Link
        href={`/admin/audit?q=${encodeURIComponent(requestId)}`}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
      >
        감사 기록
      </Link>
      <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
        요청 ID {requestId}
      </span>
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
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
      }`}
    >
      {label}
    </Link>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
      {message}
    </div>
  );
}

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "요청 접수",
    UNDER_REVIEW: "검토 중",
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
    SAME_DEVICE_MULTI_ACCOUNT_WITHDRAWAL: "동일 디바이스 다계정 출금",
    SAME_DEVICE_WITHDRAWAL_REVIEW: "동일 디바이스 검토",
    SHORT_INTERVAL_WITHDRAWAL_ATTEMPT: "짧은 간격 반복 요청",
  };

  return labels[flag] ?? flag;
}

function getHistoryKindFilter(kind?: string): HistoryKind {
  if (kind === "deposit") return "DEPOSIT";
  if (kind === "withdrawal") return "WITHDRAWAL";
  return "ALL";
}

function getHistoryStatusFilter(status?: string): HistoryStatus {
  if (status === "approved") return "APPROVED";
  if (status === "rejected") return "REJECTED";
  return "ALL";
}

function mapHistoryStatus(status: string): HistoryStatus {
  if (status === "REJECTED") return "REJECTED";
  if (status === "CONFIRMED" || status === "COMPLETED") return "APPROVED";
  return "ALL";
}

function historyKindLabel(kind: string) {
  if (kind === "DEPOSIT") return "입금";
  if (kind === "WITHDRAWAL") return "출금";
  return kind;
}

function historyStatusLabel(status: string) {
  if (status === "CONFIRMED") return "입금 완료";
  if (status === "COMPLETED") return "출금 완료";
  if (status === "REJECTED") return "거절";
  return status;
}

function buildFinanceHistoryHref({
  q,
  kind,
  status,
}: {
  q?: string;
  kind?: HistoryKind;
  status?: HistoryStatus;
}) {
  const params = new URLSearchParams();
  if (kind === "DEPOSIT") params.set("kind", "deposit");
  if (kind === "WITHDRAWAL") params.set("kind", "withdrawal");
  if (status === "APPROVED") params.set("status", "approved");
  if (status === "REJECTED") params.set("status", "rejected");
  if (q?.trim()) params.set("q", q.trim());
  const query = params.toString();
  return query ? `/admin/finance?${query}` : "/admin/finance";
}

function getOperationNextAction({
  pendingDeposits,
  pendingWithdrawals,
}: {
  pendingDeposits: number;
  pendingWithdrawals: number;
}) {
  if (pendingWithdrawals > 0) {
    return {
      title: `출금 대기 ${pendingWithdrawals}건`,
      actionLabel: "출금",
      href: "/admin/withdrawals",
    };
  }

  if (pendingDeposits > 0) {
    return {
      title: `입금 대기 ${pendingDeposits}건`,
      actionLabel: "입금",
      href: "/admin/deposits",
    };
  }

  return {
    title: "대기 없음",
    actionLabel: "이력",
    href: "/admin/finance",
  };
}

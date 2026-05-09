import type { ReactNode } from "react";
import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminFinanceLedgerState } from "@/lib/admin/finance";

type AdminFinanceLedgerPageProps = {
  searchParams?: Promise<{
    direction?: string;
    bucket?: string;
    q?: string;
  }>;
};

type LedgerState = Awaited<ReturnType<typeof getAdminFinanceLedgerState>>;
type LedgerEntry = LedgerState["entries"][number];

const LEDGER_BUCKETS = [
  "AVAILABLE",
  "ESCROW_LOCKED",
  "WITHDRAWABLE",
  "PENDING_SETTLEMENT",
  "WITHDRAWAL_LOCKED",
  "BUY_REQUEST_LOCKED",
  "PLATFORM_REVENUE",
];

export default async function AdminFinanceLedgerPage({
  searchParams,
}: AdminFinanceLedgerPageProps) {
  await requirePageRole(ROLE_GROUPS.FINANCE_OPERATORS);

  const params = searchParams ? await searchParams : undefined;
  const state = await getAdminFinanceLedgerState({
    direction: params?.direction,
    bucket: params?.bucket,
    query: params?.q,
  });
  const nextAction = getLedgerNextAction(state);

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-700">WALLET LEDGER</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              지갑 원장 조회
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderLink href={buildLedgerExportHref(state.filters)} label="CSV 내보내기" tone="emerald" />
            <HeaderLink href="/admin/deposits" label="입금 처리" />
            <HeaderLink href="/admin/withdrawals" label="출금 처리" />
            <HeaderLink href="/admin/finance/reconciliation" label="정산 대조" />
            <HeaderLink href="/admin/audit" label="감사 로그" />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="전체 원장" value={`${state.summary.totalEntries}건`} tone="sky" />
          <MetricCard label="현재 표시" value={`${state.summary.shownEntries}건`} tone="sky" />
          <MetricCard label="증가 합계" value={`${state.summary.creditAmount} USDT`} tone="emerald" />
          <MetricCard label="차감 합계" value={`${state.summary.debitAmount} USDT`} tone="rose" />
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-black text-amber-800">다음 행동</p>
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
              <p className="text-sm font-black text-slate-600">필터</p>
              <h2 className="mt-1 text-xl font-black">원장 검색</h2>
            </div>
            <HeaderLink href="/admin/users" label="유저 검색" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <FilterTab
              href={buildLedgerHref({
                bucket: state.filters.bucket,
                q: state.filters.query,
              })}
              active={state.filters.direction === ""}
              label="전체"
            />
            <FilterTab
              href={buildLedgerHref({
                direction: "CREDIT",
                bucket: state.filters.bucket,
                q: state.filters.query,
              })}
              active={state.filters.direction === "CREDIT"}
              label="입금/증가"
            />
            <FilterTab
              href={buildLedgerHref({
                direction: "DEBIT",
                bucket: state.filters.bucket,
                q: state.filters.query,
              })}
              active={state.filters.direction === "DEBIT"}
              label="출금/차감"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <FilterTab
              href={buildLedgerHref({
                direction: state.filters.direction,
                q: state.filters.query,
              })}
              active={state.filters.bucket === ""}
              label="전체 영역"
            />
            {LEDGER_BUCKETS.map((bucket) => (
              <FilterTab
                key={bucket}
                href={buildLedgerHref({
                  direction: state.filters.direction,
                  bucket,
                  q: state.filters.query,
                })}
                active={state.filters.bucket === bucket}
                label={ledgerBucketLabel(bucket)}
              />
            ))}
          </div>

          <form action="/admin/finance/ledger" className="mt-5 flex flex-col gap-3 md:flex-row">
            {state.filters.direction ? (
              <input type="hidden" name="direction" value={state.filters.direction} />
            ) : null}
            {state.filters.bucket ? (
              <input type="hidden" name="bucket" value={state.filters.bucket} />
            ) : null}
            <input
              name="q"
              defaultValue={state.filters.query}
              placeholder="유저, 이메일, 금액, 메모, 참조 ID 검색"
              className="min-h-11 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-emerald-400"
            />
            <button className="rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-black text-slate-950 hover:brightness-105">
              검색
            </button>
            <Link
              href="/admin/finance/ledger"
              className="rounded-md border border-slate-200 px-5 py-2 text-center text-sm font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
            >
              초기화
            </Link>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <p className="text-sm font-black text-slate-600">원장 목록</p>
            <h2 className="mt-1 text-xl font-black">최근 지갑 기록</h2>
          </div>

          <div className="divide-y divide-slate-200">
            {state.entries.map((entry) => (
              <LedgerEntryRow key={entry.entryId} entry={entry} />
            ))}
          </div>

          {state.entries.length === 0 ? (
            <div className="p-5">
              <EmptyBox message="조건에 맞는 원장 기록이 없습니다." />
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function LedgerEntryRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.direction === "CREDIT";

  return (
    <article className="p-5 hover:bg-slate-50">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_0.8fr] lg:items-start">
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
            {entry.userName}
          </Link>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {entry.userEmail}
          </p>
        </div>

        <div>
          <p className="text-sm font-black text-slate-950">
            {ledgerTypeLabel(entry.type)}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            {entry.memo ?? "메모 없음"}
          </p>
          {entry.referenceHref ? (
            <Link
              href={entry.referenceHref}
              className="mt-2 inline-flex text-sm font-black text-emerald-700 hover:text-emerald-900"
            >
              {referenceLabel(entry.referenceType)} 추적
            </Link>
          ) : (
            <p className="mt-2 text-sm font-semibold text-slate-500">
              연결된 참조 없음
            </p>
          )}
          {entry.orderTrace ? <OrderTraceCard order={entry.orderTrace} /> : null}
        </div>

        <div className="lg:text-right">
          <p
            className={`text-xl font-black ${
              isCredit ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {isCredit ? "+" : "-"}
            {entry.amount} {entry.currency}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {entry.createdAt}
          </p>
          <p className="mt-2 break-all text-xs font-semibold text-slate-500">
            ID {entry.entryId}
          </p>
        </div>
      </div>
    </article>
  );
}

function OrderTraceCard({ order }: { order: NonNullable<LedgerEntry["orderTrace"]> }) {
  return (
    <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-sky-700">
            주문 {order.orderNumber} · {orderStatusLabel(order.status)}
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {order.listingTitle}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-600">
            구매자 {order.buyerName} · 판매자 {order.sellerName}
          </p>
        </div>
        <div className="grid gap-1 text-xs font-black text-slate-700 md:text-right">
          <span>결제 {order.grossAmount} {order.currency}</span>
          <span className="text-emerald-700">
            정산 {order.sellerReceivableAmount} {order.currency}
          </span>
          <span className="text-sky-700">
            수수료 {order.platformFeeAmount} {order.currency}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/admin/orders?orderId=${order.orderId}&query=${order.orderId}`}
          className="rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-black text-slate-950 hover:brightness-105"
        >
          주문 상세
        </Link>
        <Link
          href={`/admin/audit?query=${order.orderId}`}
          className="rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-black text-sky-700 hover:border-sky-400"
        >
          감사 로그
        </Link>
      </div>
    </div>
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
      ? "rounded-md border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
      : "rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-slate-950";

  return (
    <Link href={href} className={className}>
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
  tone: "cyan" | "sky" | "emerald" | "rose";
}) {
  const toneClass = {
    cyan: "text-[var(--color-primary)]",
    sky: "text-sky-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
  }[tone];

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

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "emerald" | "rose" | "slate";
}) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-white text-slate-700",
  }[tone];

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-black ${toneClass}`}>
      {children}
    </span>
  );
}

function buildLedgerHref(input: {
  direction?: string | null;
  bucket?: string | null;
  q?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.direction) params.set("direction", input.direction);
  if (input.bucket) params.set("bucket", input.bucket);
  if (input.q) params.set("q", input.q);
  const query = params.toString();
  return query ? `/admin/finance/ledger?${query}` : "/admin/finance/ledger";
}

function buildLedgerExportHref(filters: LedgerState["filters"]) {
  const params = new URLSearchParams();
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.bucket) params.set("bucket", filters.bucket);
  if (filters.query) params.set("q", filters.query);
  const query = params.toString();
  return query
    ? `/api/admin/finance/ledger/export?${query}`
    : "/api/admin/finance/ledger/export";
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
    DEPOSIT: "충전",
    WITHDRAWAL: "출금",
    ESCROW_LOCK: "에스크로 잠금",
    ESCROW_RELEASE: "에스크로 지급",
    ESCROW_REFUND: "에스크로 환불",
    SETTLEMENT: "정산",
    DISPUTE_REFUND: "분쟁 환불",
    DISPUTE_RELEASE: "분쟁 지급",
    ADMIN_ADJUSTMENT: "관리자 조정",
    ADMIN_DEPOSIT_APPROVED: "관리자 충전 승인",
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

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "요청",
    ESCROW_LOCKED: "결제 잠금",
    SELLER_RESPONSE_PENDING: "판매자 확인",
    DELIVERY_IN_PROGRESS: "전달 중",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "인수확정 대기",
    COMPLETED: "완료",
    CANCELED: "취소",
    DISPUTED: "분쟁",
    REFUNDED: "환불",
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function referenceLabel(referenceType: string | null) {
  const labels: Record<string, string> = {
    ORDER: "주문",
    DEPOSIT_REQUEST: "충전 요청",
    WITHDRAWAL_REQUEST: "출금 요청",
    BUY_REQUEST: "구매 요청",
    DISPUTE: "분쟁",
  };

  return referenceType ? labels[referenceType] ?? referenceType : "참조";
}

function getLedgerNextAction(state: LedgerState) {
  if (state.summary.shownEntries === 0) {
    return {
      title: "필터 조건을 다시 확인하세요",
      body: "현재 조건에는 표시할 원장 기록이 없습니다. 전체 방향과 전체 영역으로 먼저 확인해 보세요.",
      actionLabel: "전체 원장 보기",
      href: "/admin/finance/ledger",
    };
  }

  if (state.filters.direction || state.filters.bucket || state.filters.query) {
    return {
      title: "필터 결과를 CSV로 보관하세요",
      body: "현재 필터가 적용된 상태입니다. 정산 검토나 분쟁 증빙으로 사용할 수 있도록 같은 조건의 CSV를 내려받을 수 있습니다.",
      actionLabel: "CSV 내보내기",
      href: buildLedgerExportHref(state.filters),
    };
  }

  return {
    title: "정산 대조 화면에서 마감 가능 여부를 확인하세요",
    body: "원장 흐름이 맞다면 정산 대조에서 보류 항목, 이상 신호, 최근 마감 리포트를 함께 확인하세요.",
    actionLabel: "정산 대조로 이동",
    href: "/admin/finance/reconciliation",
  };
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

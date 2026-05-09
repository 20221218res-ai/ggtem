import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminDashboardState } from "@/lib/admin/dashboard";

type DashboardState = Awaited<ReturnType<typeof getAdminDashboardState>>;
type QueueItem = DashboardState["operationsQueue"][number];

const primaryQueues = [
  "pendingDeposits",
  "pendingWithdrawals",
  "openDisputes",
  "trustReports",
  "unresolvedAuditFollowups",
] as const;

const quickActions = [
  { href: "/admin/deposits", label: "충전 처리" },
  { href: "/admin/withdrawals", label: "출금 처리" },
  { href: "/admin/disputes", label: "분쟁 처리" },
  { href: "/admin/risk", label: "신고 확인" },
  { href: "/admin/sla-incidents", label: "SLA 확인" },
];

export default async function AdminDashboardPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const state = await getAdminDashboardState();
  const activeQueue = state.operationsQueue
    .filter((item) => item.count > 0)
    .sort((left, right) => right.priorityScore - left.priorityScore);
  const mainQueues = primaryQueues.map((key) => {
    const item = state.operationsQueue.find((queueItem) => queueItem.key === key);
    return {
      key,
      count: item?.count ?? 0,
      href: item?.href ?? fallbackQueueHref(key),
      priority: item?.priority ?? "LOW",
      slaBreached: item?.slaBreached ?? false,
      previewLabel: cleanPreview(item?.previewLabel, queueLabel(key)),
    };
  });
  const totalQueueCount = state.operationsQueue.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const urgentCount = activeQueue.filter(
    (item) => item.priority === "HIGH" || item.slaBreached,
  ).length;
  const firstAction = activeQueue[0] ?? null;

  return (
    <main className="min-h-screen bg-[#f3f7fb] px-5 py-8 text-slate-950">
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--color-primary)]">
              Admin Today
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              오늘 처리할 업무
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black text-slate-500">운영 큐</p>
              <h2 className="mt-1 text-2xl font-black">
                대기 {totalQueueCount.toLocaleString("ko-KR")}건 · 긴급{" "}
                {urgentCount.toLocaleString("ko-KR")}건
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {firstAction
                  ? `${firstAction.label}: ${firstAction.actionHint}`
                  : "현재 즉시 처리해야 할 운영 큐가 없습니다."}
              </p>
            </div>
            <Link
              href={firstAction?.href ?? "/admin/deposits"}
              className="inline-flex justify-center rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-black shadow-sm hover:brightness-105"
            >
              먼저 처리하기
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {mainQueues.map((item) => (
            <QueueCard key={item.key} item={item} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <MetricCard label="진행 주문" value={state.metrics.activeOrders} href="/admin/orders" tone="blue" />
          <MetricCard label="분쟁" value={state.metrics.openDisputes} href="/admin/disputes" tone="red" />
          <MetricCard label="에스크로" value={`${state.metrics.buyerEscrow} USDT`} href="/admin/finance/ledger" tone="cyan" />
          <MetricCard label="출금 가능액" value={`${state.metrics.sellerAvailable} USDT`} href="/admin/finance/ledger?bucket=WITHDRAWABLE" tone="green" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">전체 작업 큐</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                처리 순서, 최장 대기, 다음 액션을 한 화면에서 확인합니다.
              </p>
            </div>
            <Link
              href="/admin/sla-incidents"
              className="inline-flex justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              SLA 알림
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {activeQueue.length > 0 ? (
              activeQueue.map((item) => <QueueListItem key={item.key} item={item} />)
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                대기 중인 운영 작업이 없습니다.
              </div>
            )}
          </div>
        </section>

        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-lg font-black text-slate-950">
            최근 주문 / 분쟁 보기
          </summary>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <MiniPanel title="최근 주문" href="/admin/orders">
              {state.recentOrders.slice(0, 4).map((order) => (
                <Link
                  key={order.orderId}
                  href={`/admin/orders?orderId=${order.orderId}&query=${order.orderNumber}`}
                  className="block rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black">{order.listingTitle}</p>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    {order.grossAmount} {order.currency} · {order.createdAt}
                  </p>
                </Link>
              ))}
            </MiniPanel>

            <MiniPanel title="최근 분쟁" href="/admin/disputes">
              {state.recentDisputes.slice(0, 4).map((dispute) => (
                <Link
                  key={dispute.orderId}
                  href={`/admin/disputes?orderId=${dispute.orderId}`}
                  className="block rounded-xl border border-red-100 bg-red-50 p-4 hover:bg-red-100"
                >
                  <p className="truncate text-sm font-black">{dispute.listingTitle}</p>
                  <p className="mt-2 text-xs font-bold text-red-700">
                    {cleanPreview(dispute.latestNote, "분쟁 내용")}
                  </p>
                </Link>
              ))}
            </MiniPanel>
          </div>
        </details>
      </section>
    </main>
  );
}

function QueueCard({
  item,
}: {
  item: {
    key: string;
    count: number;
    href: string;
    priority: string;
    slaBreached: boolean;
    previewLabel: string;
  };
}) {
  const tone = queueTone(item.key, item.slaBreached, item.priority);

  return (
    <Link
      href={item.href}
      className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-black ${tone.label}`}>{queueLabel(item.key)}</p>
          <p className="mt-3 text-4xl font-black">{item.count.toLocaleString("ko-KR")}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${tone.badge}`}>
          {item.slaBreached ? "SLA" : priorityLabel(item.priority)}
        </span>
      </div>
      <p className="mt-4 line-clamp-2 text-sm font-semibold text-slate-600">
        {item.previewLabel}
      </p>
    </Link>
  );
}

function QueueListItem({ item }: { item: QueueItem }) {
  const tone = queueTone(item.key, item.slaBreached, item.priority);

  return (
    <Link
      href={item.href}
      className={`block rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${tone.card}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${tone.badge}`}>
              {item.slaBreached ? "SLA 초과" : priorityLabel(item.priority)}
            </span>
            <h3 className="text-base font-black">{item.label}</h3>
            <span className="text-sm font-black text-slate-500">
              {item.count.toLocaleString("ko-KR")}건
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            {item.description}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {cleanPreview(item.previewLabel, item.label)}
          </p>
        </div>
        <div className="shrink-0 text-left lg:text-right">
          <p className="text-sm font-black text-slate-700">{item.slaLabel}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {item.oldestWaitingLabel}
          </p>
          <p className="mt-3 text-sm font-black text-[var(--color-primary)]">
            {item.quickLinkLabel}
          </p>
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600">
        {item.actionHint}
      </p>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  href: string;
  tone: "blue" | "red" | "cyan" | "green";
}) {
  const classes = {
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    red: "border-red-200 bg-red-50 text-red-700",
    cyan: "border-[color-mix(in_srgb,var(--color-primary)_35%,white)] bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] text-[var(--color-primary)]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <Link href={href} className={`rounded-2xl border p-5 shadow-sm ${classes[tone]}`}>
      <p className="text-sm font-black opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-black">
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </p>
    </Link>
  );
}

function MiniPanel({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="font-black">{title}</h3>
        <Link href={href} className="text-sm font-black text-[var(--color-primary)]">
          전체 보기
        </Link>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-black ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function queueLabel(key: string) {
  const labels: Record<string, string> = {
    pendingDeposits: "충전",
    pendingWithdrawals: "출금",
    openDisputes: "분쟁",
    trustReports: "신고",
    unresolvedAuditFollowups: "감사 보완",
    sellerRiskCandidates: "위험 유저",
    autoOperatorNotes: "자동 메모",
  };

  return labels[key] ?? key;
}

function fallbackQueueHref(key: string) {
  const hrefs: Record<string, string> = {
    pendingDeposits: "/admin/deposits",
    pendingWithdrawals: "/admin/withdrawals",
    openDisputes: "/admin/disputes",
    trustReports: "/admin/risk",
    unresolvedAuditFollowups: "/admin/audit?reason=missing&followupStatus=unresolved",
  };

  return hrefs[key] ?? "/admin";
}

function queueTone(key: string, slaBreached: boolean, priority: string) {
  if (slaBreached || priority === "HIGH") {
    return {
      card: "border-red-200 bg-red-50 text-red-800",
      label: "text-red-700",
      badge: "bg-red-600 text-white",
    };
  }

  if (key === "pendingDeposits") {
    return {
      card: "border-emerald-200 bg-emerald-50 text-emerald-900",
      label: "text-emerald-700",
      badge: "bg-emerald-600 text-white",
    };
  }

  if (key === "pendingWithdrawals") {
    return {
      card: "border-amber-200 bg-amber-50 text-amber-900",
      label: "text-amber-700",
      badge: "bg-amber-400 text-slate-950",
    };
  }

  return {
    card: "border-slate-200 bg-white text-slate-950",
    label: "text-slate-600",
    badge: "bg-slate-100 text-slate-700",
  };
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    HIGH: "긴급",
    MEDIUM: "보통",
    LOW: "낮음",
  };

  return labels[priority] ?? priority;
}

function cleanPreview(value: string | null | undefined, fallback: string) {
  if (!value || hasCorruptedText(value)) return `${fallback} 확인 필요`;
  return value;
}

function hasCorruptedText(value: string) {
  return /[\uF900-\uFAFF]|[?]{2,}|[\uFFFD]/.test(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "요청",
    ESCROW_LOCKED: "에스크로",
    SELLER_RESPONSE_PENDING: "응답 대기",
    DELIVERY_IN_PROGRESS: "진행",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "확정 대기",
    COMPLETED: "완료",
    DISPUTED: "분쟁",
    REFUNDED: "환불",
    CANCELED: "취소",
    CANCELLED: "취소",
    RELEASED: "정산",
  };

  return labels[status] ?? status;
}

function statusTone(status: string) {
  if (status === "COMPLETED" || status === "RELEASED") return "bg-emerald-100 text-emerald-700";
  if (status === "DISPUTED") return "bg-red-100 text-red-700";
  if (status === "CANCELED" || status === "CANCELLED" || status === "REFUNDED") return "bg-slate-200 text-slate-700";
  return "bg-sky-100 text-sky-700";
}

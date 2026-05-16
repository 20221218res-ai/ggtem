import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminPremiumState, type AdminPremiumItem } from "@/lib/admin/premium";

export default async function AdminPremiumPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const state = await getAdminPremiumState();

  return (
    <main className="min-h-screen bg-[#f3f7fb] px-5 py-8 text-slate-950">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--color-primary)]">
              Premium Exposure
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">프리미엄 노출</h1>
          </div>
          <Link
            href="/admin/finance/ledger?type=PREMIUM_PROMOTION_PURCHASED"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            원장
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="노출 중" value={`${state.summary.activeCount}건`} tone="blue" />
          <SummaryCard label="6시간 내 만료" value={`${state.summary.expiringSoonCount}건`} tone="amber" />
          <SummaryCard label="최근 만료" value={`${state.summary.expiredVisibleCount}건`} tone="slate" />
          <SummaryCard label="누적 수익" value={`${state.summary.revenueTotal} USDT`} tone="green" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">현재 노출</h2>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] px-3 py-1 text-xs font-black text-[var(--color-primary)]">
              {state.activeItems.length.toLocaleString("ko-KR")}건
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {state.activeItems.length > 0 ? (
              state.activeItems.map((item) => (
                <PremiumItemRow key={`${item.type}-${item.id}`} item={item} />
              ))
            ) : (
              <EmptyState label="노출 중인 글 없음" />
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">최근 만료</h2>
            <div className="mt-4 space-y-3">
              {state.expiredItems.length > 0 ? (
                state.expiredItems.slice(0, 10).map((item) => (
                  <PremiumItemRow key={`${item.type}-${item.id}`} item={item} muted />
                ))
              ) : (
                <EmptyState label="최근 만료 없음" />
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">최근 결제</h2>
            <div className="mt-4 space-y-3">
              {state.recentLedgerEntries.length > 0 ? (
                state.recentLedgerEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{entry.ownerName}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {entry.referenceType} · {entry.referenceId ?? "-"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-emerald-700">
                        +{entry.amount} {entry.currency}
                      </p>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {entry.createdAt}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState label="결제 원장 없음" />
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "amber" | "slate" | "green";
}) {
  const classes = {
    blue: "border-[color-mix(in_srgb,var(--color-primary)_35%,white)] bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] text-[var(--color-primary)]",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-white text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${classes[tone]}`}>
      <p className="text-sm font-black opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function PremiumItemRow({
  item,
  muted = false,
}: {
  item: AdminPremiumItem;
  muted?: boolean;
}) {
  return (
    <div
      className={
        muted
          ? "rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700"
          : "rounded-xl border border-[color-mix(in_srgb,var(--color-primary)_35%,white)] bg-[color-mix(in_srgb,var(--color-primary)_8%,white)] p-4 text-slate-950"
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-black text-black">
              {item.modeLabel}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
              {item.category}
            </span>
            {item.tradeModeLabel ? (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">
                {item.tradeModeLabel}
              </span>
            ) : null}
            <span className="text-xs font-bold text-slate-500">{item.status}</span>
          </div>
          <p className="mt-3 truncate text-base font-black">{item.title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {item.gameName} · {item.serverName} · {item.ownerName}
          </p>
        </div>

        <div className="grid gap-2 text-sm font-bold text-slate-600 sm:grid-cols-2 lg:min-w-[460px]">
          <Info label="단가" value={item.unitPrice} />
          <Info label="이용료" value={`${item.feeAmount} ${item.currency}`} />
          <Info label="기간" value={`${item.durationHours}시간`} />
          <Info label="남은 시간" value={item.remainingLabel} strong />
          {item.minimumQuantityLabel ? (
            <Info label="최소 수량" value={item.minimumQuantityLabel} />
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/70 pt-3">
        <p className="text-xs font-bold text-slate-500">
          시작 {item.premiumStartedAt} · 만료 {formatIsoDate(item.premiumEndsAt)}
        </p>
        <Link
          href={item.href}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          글 보기
        </Link>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <p className="text-[11px] font-black text-slate-400">{label}</p>
      <p className={strong ? "mt-1 font-black text-[var(--color-primary)]" : "mt-1"}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {label}
    </div>
  );
}

function formatIsoDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

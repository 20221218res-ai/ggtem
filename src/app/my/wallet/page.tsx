import type { ReactNode } from "react";
import Link from "next/link";
import { getMarketplaceWalletView } from "@/lib/market/my-wallet";
import { getPublicDepositWalletAddresses } from "@/lib/wallet/deposit-addresses";
import CountryText from "../../country-text";
import type { TranslationKey } from "../../i18n";
import PaymentPinSetupPanel from "@/components/payment-pin-setup-panel";
import WalletActions from "./wallet-actions";
import WalletRequestCancel from "./wallet-request-cancel";

type WalletRequest = {
  requestId: string;
  kind: "DEPOSIT" | "WITHDRAWAL";
  status: string;
  amount: string;
  currency: string;
  requestedAt: string;
  requestedAtValue: string;
  detailHref: string;
  counterpartyLabel: string;
  memo: string | null;
};

type MyWalletPageProps = {
  searchParams?: Promise<{
    action?: string;
  }>;
};

export default async function MyWalletPage({ searchParams }: MyWalletPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const mode = params?.action === "withdraw" ? "withdraw" : "deposit";
  const [view, depositOptions] = await Promise.all([
    getMarketplaceWalletView(),
    getPublicDepositWalletAddresses(),
  ]);
  const walletCurrency = view.wallet?.currency ?? "USDT";
  const availableBalance = view.wallet?.availableBalance ?? "0";
  const withdrawableBalance = view.wallet?.withdrawableBalance ?? "0";
  const inTradeAmount = sumAmounts([
    view.wallet?.escrowBalance ?? "0",
    view.wallet?.buyRequestLocked ?? "0",
    view.wallet?.withdrawalLockedBalance ?? "0",
  ]);
  const requests: WalletRequest[] = [
    ...view.depositRequests.map((request) => ({
      requestId: request.requestId,
      kind: "DEPOSIT" as const,
      status: request.status,
      amount: request.amount,
      currency: request.currency,
      requestedAt: request.requestedAt,
      requestedAtValue: request.requestedAtValue,
      detailHref: `/my/wallet/deposits/${request.requestId}`,
      counterpartyLabel: request.provider,
      memo: request.memo,
    })),
    ...view.withdrawalRequests.map((request) => ({
      requestId: request.requestId,
      kind: "WITHDRAWAL" as const,
      status: request.status,
      amount: request.amount,
      currency: request.currency,
      requestedAt: request.requestedAt,
      requestedAtValue: request.requestedAtValue,
      detailHref: `/my/wallet/withdrawals/${request.requestId}`,
      counterpartyLabel: request.destination,
      memo: request.memo,
    })),
  ].sort(
    (left, right) =>
      new Date(right.requestedAtValue).getTime() -
      new Date(left.requestedAtValue).getTime(),
  );
  const visibleRequests = requests.filter((request) =>
    mode === "withdraw" ? request.kind === "WITHDRAWAL" : request.kind === "DEPOSIT",
  );
  const requestTitleKey =
    mode === "withdraw" ? "wallet.recentWithdrawalRequests" : "wallet.recentDepositRequests";
  const emptyRequestKey =
    mode === "withdraw" ? "wallet.noWithdrawalRequests" : "wallet.noDepositRequests";

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-[1180px] gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="wallet.title" />
            </p>
            <h1 className="mt-1 text-3xl font-black">
              <CountryText id={mode === "withdraw" ? "wallet.withdrawTitle" : "wallet.depositTitle"} />
            </h1>
          </div>
          <Link
            href="/my/wallet/ledger"
            className="w-fit rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
          >
            <CountryText id="wallet.allHistory" />
          </Link>
        </header>

        {mode === "withdraw" ? (
          <section className="grid gap-3 md:grid-cols-3">
            <BalanceCard label={<CountryText id="wallet.totalBalance" />} value={`${availableBalance} ${walletCurrency}`} tone="primary" />
            <BalanceCard label={<CountryText id="wallet.withdrawableBalance" />} value={`${withdrawableBalance} ${walletCurrency}`} tone="primary" />
            <BalanceCard label={<CountryText id="wallet.inTradeAmount" />} value={`${inTradeAmount} ${walletCurrency}`} tone="gray" />
          </section>
        ) : null}

        <WalletActions
          currency={walletCurrency}
          mode={mode}
          depositOptions={depositOptions}
        />

        <PaymentPinSetupPanel />

        <section className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex items-center justify-between border-b border-[var(--gg-border-soft)] px-5 py-4">
            <div>
              <p className="text-sm font-black text-[var(--gg-muted)]">
                <CountryText id="wallet.recentHistory" />
              </p>
              <h2 className="mt-1 text-2xl font-black">
                <CountryText id={requestTitleKey} />
              </h2>
            </div>
            <Link
              href="/my/wallet/ledger"
              className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              <CountryText id="wallet.allHistory" />
            </Link>
          </div>

          <div className="grid gap-3 bg-[var(--gg-card-soft-bg)] p-4">
            {visibleRequests.slice(0, 8).map((request) => (
              <WalletRequestRow key={`${request.kind}-${request.requestId}`} request={request} />
            ))}
            {visibleRequests.length === 0 ? (
              <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-8 text-center">
                <p className="text-lg font-black">
                  <CountryText id={emptyRequestKey} />
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function BalanceCard({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: string;
  tone: "primary" | "orange" | "gray";
}) {
  const toneClass = {
    primary: "border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] text-[var(--gg-accent)]",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    gray: "border-[var(--gg-border)] bg-[var(--gg-card-bg)] text-[var(--gg-text)]",
  }[tone];

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-black opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </section>
  );
}

function WalletRequestRow({ request }: { request: WalletRequest }) {
  const isDeposit = request.kind === "DEPOSIT";
  const statusMessageKey = getWalletRequestMessageKey(request);
  const hasIssue = ["REJECTED", "FAILED", "CANCELED"].includes(request.status);

  return (
    <article className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] transition hover:border-[var(--gg-accent)] md:flex md:items-center md:justify-between md:gap-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={request.status} />
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              isDeposit
                ? "bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] text-[var(--gg-accent)]"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <CountryText id={request.kind === "DEPOSIT" ? "common.deposit" : "common.withdraw"} />
          </span>
        </div>
        <Link href={request.detailHref} className="mt-3 block truncate text-2xl font-black hover:text-[var(--gg-accent)]">
          {request.amount} {request.currency}
        </Link>
        <p className="mt-2 truncate text-sm font-bold text-[var(--gg-muted)]">
          {request.counterpartyLabel}
        </p>
        <p
          className={`mt-2 line-clamp-2 text-sm font-black ${
            hasIssue ? "text-red-600" : "text-[var(--gg-accent)]"
          }`}
        >
          {request.memo && hasIssue ? request.memo : <CountryText id={statusMessageKey} />}
        </p>
        <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
          {request.requestedAt}
        </p>
      </div>
      <div className="mt-4 flex shrink-0 flex-wrap gap-2 md:mt-0">
        <Link href={request.detailHref} className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]">
          <CountryText id="common.view" />
        </Link>
        {canCancelRequest(request.kind, request.status) ? (
          <WalletRequestCancel kind={request.kind} requestId={request.requestId} />
        ) : null}
      </div>
    </article>
  );
}

function getWalletRequestMessageKey(request: WalletRequest): TranslationKey {
  if (request.kind === "DEPOSIT") {
    if (request.status === "PENDING") {
      return "wallet.depositStatusPendingMessage";
    }
    if (request.status === "CONFIRMED") {
      return "wallet.depositStatusConfirmedMessage";
    }
    if (request.status === "REJECTED") {
      return "wallet.depositStatusRejectedDefault";
    }
    if (request.status === "CANCELED") {
      return "wallet.depositStatusCanceledMessage";
    }

    return "wallet.depositStatusCheckingMessage";
  }

  if (["REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"].includes(request.status)) {
    return "wallet.withdrawStatusProcessingMessage";
  }
  if (request.status === "COMPLETED") {
    return "wallet.withdrawStatusCompletedMessage";
  }
  if (request.status === "REJECTED" || request.status === "FAILED") {
    return "wallet.withdrawStatusRejectedDefault";
  }
  if (request.status === "CANCELED") {
    return "wallet.withdrawStatusCanceledMessage";
  }

  return "wallet.withdrawStatusCheckingMessage";
}
function StatusPill({ status }: { status: string }) {
  const tone = getWalletStatusTone(status);
  const toneClass = {
    waiting: "bg-amber-100 text-amber-800",
    complete: "bg-emerald-100 text-emerald-800",
    issue: "bg-red-100 text-red-800",
    neutral: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${toneClass}`}>
      <CountryText id={getWalletStatusLabelKey(status)} />
    </span>
  );
}

function getWalletStatusTone(status: string) {
  if (["PENDING", "REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"].includes(status)) {
    return "waiting" as const;
  }
  if (["CONFIRMED", "COMPLETED"].includes(status)) {
    return "complete" as const;
  }
  if (["REJECTED", "CANCELED", "FAILED"].includes(status)) {
    return "issue" as const;
  }
  return "neutral" as const;
}

function getWalletStatusLabelKey(status: string): TranslationKey {
  if (["PENDING", "REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"].includes(status)) {
    return "wallet.statusProcessing";
  }
  if (["CONFIRMED", "COMPLETED"].includes(status)) {
    return "wallet.statusCompleted";
  }
  if (status === "REJECTED") return "wallet.statusRejected";
  if (status === "CANCELED") return "wallet.statusCanceled";
  if (status === "FAILED") return "wallet.statusFailed";
  return "wallet.statusProcessing";
}

function canCancelRequest(kind: "DEPOSIT" | "WITHDRAWAL", status: string) {
  return (
    (kind === "DEPOSIT" && status === "PENDING") ||
    (kind === "WITHDRAWAL" && status === "REQUESTED")
  );
}

function sumAmounts(values: string[]) {
  const total = values.reduce((sum, value) => {
    const next = Number(value);
    return Number.isFinite(next) ? sum + next : sum;
  }, 0);

  return total.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    useGrouping: false,
  });
}

import type { ReactNode } from "react";
import Link from "next/link";
import { getMarketplaceWalletLedgerView } from "@/lib/market/my-wallet";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";

type WalletLedgerPageProps = {
  searchParams?: Promise<{
    direction?: string;
    bucket?: string;
    q?: string;
  }>;
};

type LedgerEntry = Awaited<
  ReturnType<typeof getMarketplaceWalletLedgerView>
>["entries"][number];

export default async function WalletLedgerPage({
  searchParams,
}: WalletLedgerPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const view = await getMarketplaceWalletLedgerView({
    direction: params?.direction,
    bucket: params?.bucket,
    query: params?.q,
  });
  const currency = view.wallet?.currency ?? "USDT";
  const lockedTotal = view.wallet
    ? formatAmount(
        Number(view.wallet.escrowBalance) +
          Number(view.wallet.buyRequestLocked) +
          Number(view.wallet.withdrawalLockedBalance),
      )
    : "0";

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto max-w-[1180px] space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]"><CountryText id="wallet.title" /></p>
            <h1 className="mt-1 text-3xl font-black"><CountryText id="wallet.ledgerTitle" /></h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/my/wallet?action=deposit"
              className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              <CountryText id="common.deposit" />
            </Link>
            <Link
              href="/my/wallet?action=withdraw"
              className="rounded-xl border border-[var(--gg-border)] px-5 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              <CountryText id="common.withdraw" />
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <Metric
            label={<CountryText id="wallet.holdingBalance" />}
            value={view.wallet?.availableBalance ?? "0"}
            suffix={currency}
            tone="primary"
          />
          <Metric label={<CountryText id="wallet.inTradeAmount" />} value={lockedTotal} suffix={currency} tone="blue" />
          <Metric
            label={<CountryText id="wallet.withdrawableBalance" />}
            value={view.wallet?.withdrawableBalance ?? "0"}
            suffix={currency}
            tone="primary"
          />
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <SummaryCard
            label={<CountryText id="wallet.creditTotal" />}
            value={`+${view.summary.creditAmount} ${currency}`}
            caption={<>{view.summary.shownEntries}<CountryText id="wallet.shownEntriesSuffix" /></>}
            tone="credit"
          />
          <SummaryCard
            label={<CountryText id="wallet.debitTotal" />}
            value={`-${view.summary.debitAmount} ${currency}`}
            caption={<><CountryText id="wallet.totalEntriesPrefix" /> {view.summary.totalEntries}<CountryText id="wallet.totalEntriesSuffix" /></>}
            tone="debit"
          />
        </section>

        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterPill
                href={buildLedgerHref({ bucket: view.filters.bucket, q: view.filters.query })}
                active={!view.filters.direction}
              >
                <CountryText id="wallet.all" />
              </FilterPill>
              <FilterPill
                href={buildLedgerHref({
                  direction: "CREDIT",
                  bucket: view.filters.bucket,
                  q: view.filters.query,
                })}
                active={view.filters.direction === "CREDIT"}
              >
                <CountryText id="wallet.credit" />
              </FilterPill>
              <FilterPill
                href={buildLedgerHref({
                  direction: "DEBIT",
                  bucket: view.filters.bucket,
                  q: view.filters.query,
                })}
                active={view.filters.direction === "DEBIT"}
              >
                <CountryText id="wallet.debit" />
              </FilterPill>
            </div>

            <form className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <input type="hidden" name="direction" value={view.filters.direction ?? ""} />
              <select
                name="bucket"
                defaultValue={view.filters.bucket ?? ""}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              >
                <option value=""><CountryText id="wallet.allAmount" /></option>
                <option value="AVAILABLE"><CountryText id="wallet.bucketAvailable" /></option>
                <option value="ESCROW_LOCKED"><CountryText id="wallet.bucketEscrowLocked" /></option>
                <option value="BUY_REQUEST_LOCKED"><CountryText id="wallet.bucketBuyRequestLocked" /></option>
                <option value="WITHDRAWABLE"><CountryText id="wallet.bucketWithdrawable" /></option>
                <option value="WITHDRAWAL_LOCKED"><CountryText id="wallet.bucketWithdrawalLocked" /></option>
              </select>
              <input
                name="q"
                defaultValue={view.filters.query ?? ""}
                aria-label="wallet-search"
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              />
              <button className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]">
                <CountryText id="common.search" />
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-3">
          {view.entries.length ? (
            view.entries.map((entry) => (
              <LedgerEntryCard key={entry.entryId} entry={entry} />
            ))
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
              <p className="text-sm font-black text-[var(--gg-muted)]"><CountryText id="wallet.noLedgerEntries" /></p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  suffix,
  tone,
}: {
  label: ReactNode;
  value: string;
  suffix: string;
  tone: "primary" | "blue";
}) {
  const toneClass =
    tone === "primary"
      ? "border-[color-mix(in_srgb,var(--gg-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,transparent)]"
      : "border-[var(--gg-border)] bg-[var(--gg-card-bg)]";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm shadow-[var(--gg-shadow)] ${toneClass}`}>
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-black">
        {value} <span className="text-base">{suffix}</span>
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  tone,
}: {
  label: ReactNode;
  value: string;
  caption: ReactNode;
  tone: "credit" | "debit";
}) {
  const color = tone === "credit" ? "text-[#18a84a]" : "text-[#dc2626]";

  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">{caption}</p>
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)]"
          : "rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
      }
    >
      {children}
    </Link>
  );
}

function LedgerEntryCard({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.direction === "CREDIT";

  return (
    <article className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] transition hover:border-[var(--gg-accent)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                isCredit ? "bg-[#eaf8ef] text-[#18a84a]" : "bg-[#fee2e2] text-[#dc2626]"
              }`}
            >
              <CountryText id={isCredit ? "wallet.credit" : "wallet.debit"} />
            </span>
            <span className="rounded-full bg-[var(--gg-control-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
              <CountryText id={getBucketLabelKey(entry.bucket)} />
            </span>
          </div>

          <h2 className="mt-3 text-lg font-black"><CountryText id={getLedgerTypeLabelKey(entry.type)} /></h2>
          <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">{entry.createdAt}</p>
          {entry.memo ? (
            <p className="mt-2 line-clamp-2 text-sm font-bold text-[var(--gg-muted)]">
              {entry.memo}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {entry.referenceHref ? (
              <Link
                href={entry.referenceHref}
                className="inline-flex rounded-xl border border-[var(--gg-border)] px-3 py-2 text-xs font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
              >
                <CountryText id="wallet.relatedDetail" />
              </Link>
            ) : null}
            <span className="inline-flex rounded-xl bg-[var(--gg-control-bg)] px-3 py-2 text-xs font-black text-[var(--gg-muted)]">
              {entry.entryId.slice(0, 12)}
            </span>
          </div>
        </div>

        <p
          className={`shrink-0 text-2xl font-black ${
            isCredit ? "text-[#18a84a]" : "text-[#dc2626]"
          }`}
        >
          {isCredit ? "+" : "-"}
          {entry.amount} {entry.currency}
        </p>
      </div>
    </article>
  );
}

function getBucketLabelKey(bucket: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    AVAILABLE: "wallet.bucketAvailable",
    ESCROW_LOCKED: "wallet.bucketEscrowLocked",
    BUY_REQUEST_LOCKED: "wallet.bucketBuyRequestLocked",
    WITHDRAWABLE: "wallet.bucketWithdrawable",
    WITHDRAWAL_LOCKED: "wallet.bucketWithdrawalLocked",
    PENDING_SETTLEMENT: "wallet.bucketPendingSettlement",
    PLATFORM_REVENUE: "wallet.bucketPlatformRevenue",
  };

  return labels[bucket] ?? "wallet.all";
}

function getLedgerTypeLabelKey(type: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    ADMIN_DEPOSIT_APPROVED: "wallet.ledgerAdminDepositApproved",
    BUYER_ESCROW_LOCKED: "wallet.ledgerBuyerEscrowLocked",
    ORDER_CANCELED_REFUND: "wallet.ledgerOrderCanceledRefund",
    ORDER_COMPLETED_RELEASE_TO_SELLER: "wallet.ledgerOrderCompletedRelease",
    SETTLEMENT_AVAILABLE: "wallet.ledgerSettlementAvailable",
    BUY_REQUEST_LOCKED: "wallet.ledgerBuyRequestLocked",
    BUY_REQUEST_RELEASED: "wallet.ledgerBuyRequestReleased",
    WITHDRAWAL_REQUESTED: "wallet.ledgerWithdrawalRequested",
    WITHDRAWAL_COMPLETED: "wallet.ledgerWithdrawalCompleted",
    WITHDRAWAL_REJECTED: "wallet.ledgerWithdrawalRejected",
    DISPUTE_REFUND: "wallet.ledgerDisputeRefund",
    DISPUTE_RELEASE: "wallet.ledgerDisputeRelease",
    PLATFORM_FEE_COLLECTED: "wallet.ledgerPlatformFeeCollected",
  };

  return labels[type] ?? "wallet.unknownStatusTitle";
}

function buildLedgerHref({
  direction,
  bucket,
  q,
}: {
  direction?: string | null;
  bucket?: string | null;
  q?: string | null;
}) {
  const params = new URLSearchParams();
  if (direction) params.set("direction", direction);
  if (bucket) params.set("bucket", bucket);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/my/wallet/ledger?${query}` : "/my/wallet/ledger";
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getMarketplaceWithdrawalRequestDetail } from "@/lib/market/my-wallet";
import { WITHDRAWAL_POLICY } from "@/lib/wallet/withdrawal-policy";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import WalletRequestCancel from "../../wallet-request-cancel";

type WithdrawalStatusMeta = {
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  reason: TranslationKey | null;
  badgeClassName: string;
  panelClassName: string;
};

type WithdrawalDetailPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

const activeStatuses = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"];

export default async function WithdrawalRequestDetailPage({
  params,
}: WithdrawalDetailPageProps) {
  const { requestId } = await params;
  const request = await getMarketplaceWithdrawalRequestDetail(requestId);

  if (!request) {
    notFound();
  }

  const status = getWithdrawalStatusMeta(request.status);
  const canCancel = request.status === "REQUESTED";
  const isActive = activeStatuses.includes(request.status);
  const visibleReason = request.failureReason ?? status.reason;

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-5">
        <nav className="flex items-center gap-2 text-sm font-bold text-[var(--gg-muted)]">
          <Link href="/my/wallet?action=withdraw" className="hover:text-[var(--gg-accent)]">
            <CountryText id="wallet.title" />
          </Link>
          <span>/</span>
          <span><CountryText id="wallet.withdrawDetail" /></span>
        </nav>

        <header className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
                <CountryText id="wallet.withdrawRequestEyebrow" />
              </p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">
                {request.netAmount} {request.currency}
              </h1>
              <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
                <CountryText id="wallet.requestedAt" /> {request.requestedAt}
              </p>
            </div>
            <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${status.badgeClassName}`}>
              <CountryText id={status.labelKey} />
            </span>
          </div>
        </header>

        <section className={`rounded-2xl border p-5 ${status.panelClassName}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black opacity-80"><CountryText id="wallet.currentStatus" /></p>
              <h2 className="mt-2 text-2xl font-black"><CountryText id={status.titleKey} /></h2>
              <p className="mt-2 text-sm font-bold leading-6 opacity-80">
                <CountryText id={status.descriptionKey} />
              </p>
            </div>
            <WithdrawalStatusSteps status={request.status} />
          </div>
          {visibleReason ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-white/70 px-4 py-3 text-sm font-bold text-red-700">
              <CountryText id="wallet.reasonPrefix" />: {request.failureReason ?? <CountryText id={status.reason ?? "wallet.unknownStatusDescription"} />}
            </p>
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[var(--gg-accent)]"><CountryText id="wallet.receivingWallet" /></p>
                <h2 className="mt-1 text-2xl font-black"><CountryText id="wallet.withdrawInfo" /></h2>
              </div>
              <span className="rounded-xl border border-[var(--gg-border)] px-3 py-2 text-xs font-black text-[var(--gg-muted)]">
                {request.chain ?? "TRC20"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <InfoRow label={<CountryText id="wallet.withdrawRequestAmount" />} value={`${request.amount} ${request.currency}`} strong />
              <InfoRow label={<CountryText id="wallet.fee" />} value={`${request.fee} ${request.currency}`} />
              <InfoRow label={<CountryText id="wallet.netAmount" />} value={`${request.netAmount} ${request.currency}`} strong />
              <InfoRow label={<CountryText id="wallet.totalDebit" />} value={`${request.totalDebit} ${request.currency}`} />
              <InfoRow label={<CountryText id="wallet.chain" />} value={request.chain ?? "TRC20"} />
              <InfoRow label={<CountryText id="wallet.method" />} value={request.provider} />
              <div className="md:col-span-2">
                <InfoRow label={<CountryText id="wallet.destinationAddress" />} value={request.destination} />
              </div>
              <div className="md:col-span-2">
                <InfoRow label={<CountryText id="wallet.memo" />} value={request.memo ?? <CountryText id="wallet.none" />} />
              </div>
            </div>
          </div>

          <aside className="grid content-start gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">NEXT</p>
              <h2 className="mt-1 text-xl font-black"><CountryText id="wallet.nextAction" /></h2>
            </div>
            {isActive ? (
              <ActionHint
                title={<CountryText id="wallet.adminReviewPending" />}
                body={<CountryText id="wallet.withdrawActiveBody" />}
              />
            ) : (
              <ActionHint
                title={<CountryText id={request.status === "COMPLETED" ? "wallet.withdrawCompletedTitle" : "wallet.statusCheckNeeded"} />}
                body={<CountryText id="wallet.withdrawRetryBody" />}
              />
            )}
            {canCancel ? <WalletRequestCancel kind="WITHDRAWAL" requestId={request.requestId} /> : null}
            <Link
              href="/my/wallet?action=withdraw"
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              <CountryText id="wallet.backToWithdraw" />
            </Link>
            <Link
              href="/my/wallet/ledger"
              className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              <CountryText id="wallet.allHistory" />
            </Link>
          </aside>
        </section>

        <section className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 md:grid-cols-4">
          <PolicyMini label={<CountryText id="wallet.minimumWithdrawal" />} value={`${WITHDRAWAL_POLICY.minimumAmount} USDT`} />
          <PolicyMini label={<CountryText id="wallet.dailyLimit" />} value={`${WITHDRAWAL_POLICY.dailyRequestLimit}`} />
          <PolicyMini label={<CountryText id="wallet.cooldown" />} value={`${WITHDRAWAL_POLICY.cooldownHours}`} />
          <PolicyMini label={<CountryText id="wallet.supportedChains" />} value={WITHDRAWAL_POLICY.allowedChains.join(", ")} />
        </section>

        {request.logs.length > 0 ? (
          <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <h2 className="text-xl font-black"><CountryText id="wallet.processLog" /></h2>
            <div className="mt-4 grid gap-3">
              {request.logs.map((log) => (
                <div
                  key={`${log.action}-${log.createdAt}`}
                  className="rounded-xl bg-[var(--gg-card-soft-bg)] px-4 py-3"
                >
                  <p className="text-sm font-black">{log.action}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">
                    {log.statusFrom ?? "-"} / {log.statusTo ?? "-"} / {log.createdAt}
                  </p>
                  {log.message ? (
                    <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
                      {log.message}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow label={<CountryText id="wallet.requestId" />} value={request.requestId} />
            <InfoRow
              label={<CountryText id="wallet.processedAt" />}
              value={request.completedAt ?? request.processedAt ?? <CountryText id="wallet.processingPending" />}
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function WithdrawalStatusSteps({ status }: { status: string }) {
  const steps = [
    { id: "REQUESTED", labelKey: "wallet.stepRequest" },
    { id: "UNDER_REVIEW", labelKey: "wallet.stepChecking" },
    { id: "SENT", labelKey: "wallet.stepSend" },
    { id: "COMPLETED", labelKey: "wallet.stepCompleted" },
  ];
  const activeIndex =
    status === "COMPLETED"
      ? 3
      : status === "SENT"
        ? 2
        : status === "UNDER_REVIEW" || status === "APPROVED"
          ? 1
          : status === "REJECTED" || status === "FAILED" || status === "CANCELED"
            ? 1
            : 0;

  return (
    <div className="flex min-w-[300px] items-center gap-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex flex-1 items-center gap-2">
          <div
            className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black ${
              index <= activeIndex
                ? "bg-[var(--gg-accent)] text-[var(--gg-inverse-text)]"
                : "bg-white/70 text-[var(--gg-muted)]"
            }`}
          >
            {index + 1}
          </div>
          <span className="text-xs font-black opacity-80"><CountryText id={step.labelKey as TranslationKey} /></span>
          {index < steps.length - 1 ? <span className="h-px flex-1 bg-current opacity-20" /> : null}
        </div>
      ))}
    </div>
  );
}

function ActionHint({ title, body }: { title: ReactNode; body: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--gg-card-soft-bg)] p-4">
      <p className="text-sm font-black text-[var(--gg-text)]">{title}</p>
      <p className="mt-1 text-sm font-bold leading-6 text-[var(--gg-muted)]">{body}</p>
    </div>
  );
}

function PolicyMini({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-4">
      <p className="text-xs font-black text-amber-700">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  strong = false,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="grid gap-1 rounded-xl bg-[var(--gg-card-soft-bg)] px-4 py-3">
      <p className="text-xs font-black text-[var(--gg-muted)]">{label}</p>
      <p className={`break-all ${strong ? "text-xl" : "text-sm"} font-black text-[var(--gg-text)]`}>
        {value}
      </p>
    </div>
  );
}

function getWithdrawalStatusMeta(status: string): WithdrawalStatusMeta {
  if (status === "COMPLETED") {
    return {
      labelKey: "wallet.withdrawCompletedLabel",
      titleKey: "wallet.withdrawCompletedStatusTitle",
      descriptionKey: "wallet.withdrawCompletedDescription",
      reason: null,
      badgeClassName: "bg-emerald-100 text-emerald-800",
      panelClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  if (status === "REJECTED" || status === "FAILED") {
    return {
      labelKey: status === "FAILED" ? "wallet.statusFailed" : "wallet.statusRejected",
      titleKey: "wallet.withdrawRejectedStatusTitle",
      descriptionKey: "wallet.withdrawRejectedDescription",
      reason: "wallet.withdrawRejectedReason",
      badgeClassName: "bg-red-100 text-red-800",
      panelClassName: "border-red-200 bg-red-50 text-red-900",
    };
  }

  if (status === "CANCELED") {
    return {
      labelKey: "wallet.statusCanceled",
      titleKey: "wallet.withdrawCanceledTitle",
      descriptionKey: "wallet.requestCanceledDescription",
      reason: null,
      badgeClassName: "bg-slate-100 text-slate-700",
      panelClassName:
        "border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] text-[var(--gg-muted)]",
    };
  }

  return {
    labelKey: "wallet.statusProcessing",
    titleKey: "wallet.withdrawProcessingTitle",
    descriptionKey: "wallet.withdrawActiveBody",
    reason: null,
    badgeClassName: "bg-amber-100 text-amber-800",
    panelClassName: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

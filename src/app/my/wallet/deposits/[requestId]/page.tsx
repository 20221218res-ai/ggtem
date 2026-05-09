import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getMarketplaceDepositRequestDetail } from "@/lib/market/my-wallet";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import WalletRequestCancel from "../../wallet-request-cancel";

type DepositStatusMeta = {
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  reason: TranslationKey | null;
  badgeClassName: string;
  panelClassName: string;
};

type DepositDetailPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function DepositRequestDetailPage({
  params,
}: DepositDetailPageProps) {
  const { requestId } = await params;
  const request = await getMarketplaceDepositRequestDetail(requestId);

  if (!request) {
    notFound();
  }

  const status = getDepositStatusMeta(request.status);
  const cryptoDetail = parseCryptoDepositMemo(request.memo);
  const canCancel = request.status === "PENDING";

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-5">
        <nav className="flex items-center gap-2 text-sm font-bold text-[var(--gg-muted)]">
          <Link href="/my/wallet?action=deposit" className="hover:text-[var(--gg-accent)]">
            <CountryText id="wallet.title" />
          </Link>
          <span>/</span>
          <span><CountryText id="wallet.depositDetail" /></span>
        </nav>

        <header className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
                <CountryText id="wallet.depositRequestEyebrow" />
              </p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">
                {request.amount} {request.currency}
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
            <StatusSteps status={request.status} />
          </div>
          {status.reason ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-white/70 px-4 py-3 text-sm font-bold text-red-700">
              <CountryText id="wallet.reasonPrefix" />: <CountryText id={status.reason} />
            </p>
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[var(--gg-accent)]"><CountryText id="wallet.submittedDepositInfo" /></p>
                <h2 className="mt-1 text-2xl font-black"><CountryText id="wallet.submittedDepositContent" /></h2>
              </div>
              <span className="rounded-xl border border-[var(--gg-border)] px-3 py-2 text-xs font-black text-[var(--gg-muted)]">
                {request.provider}
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              <InfoRow label={<CountryText id="wallet.product" />} value={cryptoDetail.asset ?? "USDT"} />
              <InfoRow label={<CountryText id="wallet.network" />} value={cryptoDetail.network ?? "-"} />
              <InfoRow label={<CountryText id="wallet.depositAmount" />} value={`${request.amount} ${request.currency}`} strong />
              <InfoRow label={<CountryText id="wallet.depositAddress" />} value={cryptoDetail.depositAddress ?? "-"} />
              <InfoRow label="TXID" value={cryptoDetail.txHash ?? <CountryText id="wallet.notSubmittedYet" />} />
            </div>
          </div>

          <aside className="grid content-start gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">NEXT</p>
              <h2 className="mt-1 text-xl font-black"><CountryText id="wallet.nextAction" /></h2>
            </div>
            {canCancel ? (
              <>
                <ActionHint
                  title={<CountryText id="wallet.adminReviewPending" />}
                  body={<CountryText id="wallet.depositReviewPendingBody" />}
                />
                <WalletRequestCancel kind="DEPOSIT" requestId={request.requestId} />
              </>
            ) : (
              <ActionHint
                title={<CountryText id={request.status === "CONFIRMED" ? "wallet.balanceAppliedComplete" : "wallet.statusCheckNeeded"} />}
                body={<CountryText id="wallet.ledgerResultCheckBody" />}
              />
            )}
            <Link
              href="/my/wallet?action=deposit"
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              <CountryText id="wallet.backToDeposit" />
            </Link>
            <Link
              href="/my/wallet/ledger"
              className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              <CountryText id="wallet.allHistory" />
            </Link>
          </aside>
        </section>

        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow label={<CountryText id="wallet.requestId" />} value={request.requestId} />
            <InfoRow label={<CountryText id="wallet.processedAt" />} value={request.confirmedAt ?? <CountryText id="wallet.processingPending" />} />
          </div>
        </section>
      </section>
    </main>
  );
}

function StatusSteps({ status }: { status: string }) {
  const steps = [
    { id: "PENDING", labelKey: "wallet.stepRequest" },
    { id: "CHECKING", labelKey: "wallet.stepChecking" },
    { id: "CONFIRMED", labelKey: "wallet.stepCompleted" },
  ];
  const activeIndex =
    status === "CONFIRMED"
      ? 2
      : status === "REJECTED" || status === "CANCELED"
        ? 1
        : 0;

  return (
    <div className="flex min-w-[240px] items-center gap-2">
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

function InfoRow({
  label,
  value,
  strong,
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

function parseCryptoDepositMemo(memo: string | null) {
  const fields: Record<string, string> = {};

  for (const segment of memo?.split(" / ") ?? []) {
    const separatorIndex = segment.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim().toLowerCase();
    const value = segment.slice(separatorIndex + 1).trim();

    if (key && value) {
      fields[key] = value;
    }
  }

  return {
    asset: fields.asset,
    network: fields.network,
    depositAddress: fields["deposit address"],
    txHash:
      fields["tx hash"] && fields["tx hash"] !== "pending user proof"
        ? fields["tx hash"]
        : null,
  };
}

function getDepositStatusMeta(status: string): DepositStatusMeta {
  if (status === "PENDING") {
    return {
      labelKey: "wallet.depositPendingLabel",
      titleKey: "wallet.depositPendingTitle",
      descriptionKey: "wallet.depositPendingDescription",
      reason: null,
      badgeClassName: "bg-amber-100 text-amber-800",
      panelClassName: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (status === "CONFIRMED") {
    return {
      labelKey: "wallet.depositConfirmedLabel",
      titleKey: "wallet.depositConfirmedTitle",
      descriptionKey: "wallet.depositConfirmedDescription",
      reason: null,
      badgeClassName: "bg-emerald-100 text-emerald-800",
      panelClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  if (status === "REJECTED") {
    return {
      labelKey: "wallet.statusRejected",
      titleKey: "wallet.depositRejectedTitle",
      descriptionKey: "wallet.depositRejectedDescription",
      reason: "wallet.depositRejectedReason",
      badgeClassName: "bg-red-100 text-red-800",
      panelClassName: "border-red-200 bg-red-50 text-red-900",
    };
  }

  if (status === "CANCELED") {
    return {
      labelKey: "wallet.statusCanceled",
      titleKey: "wallet.depositCanceledTitle",
      descriptionKey: "wallet.requestCanceledDescription",
      reason: null,
      badgeClassName: "bg-slate-100 text-slate-700",
      panelClassName:
        "border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] text-[var(--gg-muted)]",
    };
  }

  return {
    labelKey: "wallet.statusProcessing",
    titleKey: "wallet.unknownStatusTitle",
    descriptionKey: "wallet.unknownStatusDescription",
    reason: null,
    badgeClassName: "bg-slate-100 text-slate-700",
    panelClassName:
      "border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] text-[var(--gg-muted)]",
  };
}

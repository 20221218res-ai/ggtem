import type { ReactNode } from "react";
import Link from "next/link";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import LocalizedInput from "@/app/localized-input";
import UserContentText from "@/app/user-content-text";
import { getMarketplaceMyBuyRequests } from "@/lib/market/buy-requests";
import { getGameMoneyPriceUnitLabel } from "@/lib/market/trade-unit";
import BuyRequestActions from "./buy-request-actions";
import OfferActions from "./offer-actions";

export const dynamic = "force-dynamic";

type MyBuyRequestsView = Awaited<ReturnType<typeof getMarketplaceMyBuyRequests>>;
type MyBuyRequest = MyBuyRequestsView["buyRequests"][number];
type BuyRequestOffer = NonNullable<MyBuyRequest["offers"]>[number];

type MyBuyRequestsPageProps = {
  searchParams?: Promise<{
    status?: string;
    q?: string;
  }>;
};

export default async function MyBuyRequestsPage({ searchParams }: MyBuyRequestsPageProps) {
  const view = await getMarketplaceMyBuyRequests();
  const resolvedSearchParams = await searchParams;
  const statusFilter = getStatusFilter(resolvedSearchParams?.status);
  const query = resolvedSearchParams?.q?.trim().toLowerCase() ?? "";
  const pendingOfferRequests = view.buyRequests.filter(
    (request) =>
      request.status === "ACTIVE" &&
      request.offers?.some((offer) => offer.status === "PENDING"),
  );
  const activeRequests = view.buyRequests.filter((request) => request.status === "ACTIVE");
  const filteredBuyRequests = view.buyRequests
    .filter((request) => {
      const matchesStatus = statusFilter === "ALL" || request.status === statusFilter;
      const matchesQuery =
        !query ||
        [request.title ?? "", request.gameName, request.serverName ?? "", request.categoryLabel]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesQuery;
    })
    .sort((left, right) => {
      const priorityDiff = getBuyRequestPriority(left.status) - getBuyRequestPriority(right.status);

      if (priorityDiff !== 0) return priorityDiff;
      return Number(right.offerCount) - Number(left.offerCount);
    });

  const tabs: Array<{ labelKey: TranslationKey; value: string; count: number; href: string }> = [
    { labelKey: "manage.all", value: "ALL", count: view.summary.totalRequests, href: "/my/buy-requests" },
    { labelKey: "manage.buying", value: "ACTIVE", count: activeRequests.length, href: "/my/buy-requests?status=ACTIVE" },
    { labelKey: "manage.inTrade", value: "ACCEPTED", count: countByStatus(view.buyRequests, "ACCEPTED"), href: "/my/buy-requests?status=ACCEPTED" },
    { labelKey: "manage.completed", value: "COMPLETED", count: view.summary.completedRequests, href: "/my/buy-requests?status=COMPLETED" },
    { labelKey: "manage.canceled", value: "CANCELED", count: view.summary.canceledRequests, href: "/my/buy-requests?status=CANCELED" },
  ];

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto max-w-[1180px] space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="manage.buyingEyebrow" />
            </p>
            <h1 className="mt-1 text-3xl font-black">
              <CountryText id="manage.myBuyPosts" />
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/my/buy-requests/new"
              className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              <CountryText id="manage.createBuy" />
            </Link>
            <Link
              href="/listings?mode=buy"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-5 py-3 text-sm font-black hover:bg-[var(--gg-control-bg)]"
            >
              <CountryText id="manage.publicBuyPosts" />
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <SummaryBox label={<CountryText id="manage.all" />} value={view.summary.totalRequests} />
          <SummaryBox label={<CountryText id="manage.buying" />} value={activeRequests.length} />
          <SummaryBox label={<CountryText id="manage.checkOffers" />} value={pendingOfferRequests.length} />
          <SummaryBox label={<CountryText id="manage.reserveAmount" />} value={`${view.summary.totalActiveAmount} USDT`} />
        </section>

        {pendingOfferRequests[0] ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-amber-800">
                  <CountryText id="manage.sellerOfferArrived" />
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--gg-text)]">
                  <BuyRequestTitle request={pendingOfferRequests[0]} />
                </p>
              </div>
              <Link
                href="#buy-request-list"
                className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-[var(--gg-inverse-text)]"
              >
                <CountryText id="manage.checkOffers" />
              </Link>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={tab.href}
                  className={
                    statusFilter === tab.value
                      ? "whitespace-nowrap rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)]"
                      : "whitespace-nowrap rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black text-[var(--gg-muted)] hover:bg-[var(--gg-control-bg)]"
                  }
                >
                  <CountryText id={tab.labelKey} /> {tab.count}
                </Link>
              ))}
            </nav>

            <form className="grid gap-2 sm:grid-cols-[1fr_auto]">
              {statusFilter !== "ALL" ? <input type="hidden" name="status" value={statusFilter} /> : null}
              <LocalizedInput
                name="q"
                defaultValue={resolvedSearchParams?.q ?? ""}
                placeholderKey="manage.searchPlaceholder"
                aria-label="buy-post-search"
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-sm font-bold outline-none"
              />
              <button className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]">
                <CountryText id="common.search" />
              </button>
            </form>
          </div>
        </section>

        <section
          id="buy-request-list"
          className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]"
        >
          {filteredBuyRequests.length ? (
            filteredBuyRequests.map((request) => (
              <BuyRequestRow key={request.buyRequestId} request={request} />
            ))
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 bg-[var(--gg-card-soft-bg)]">
              <p className="text-sm font-black text-[var(--gg-muted)]">
                <CountryText id="manage.noBuyPosts" />
              </p>
              <Link
                href="/my/buy-requests/new"
                className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
              >
                <CountryText id="manage.createBuy" />
              </Link>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function BuyRequestRow({ request }: { request: MyBuyRequest }) {
  const pendingOffers = request.offers?.filter((offer) => offer.status === "PENDING") ?? [];
  const moneyUnit = request.category === "GAME_MONEY" ? request.moneyUnitName : "";
  const price = getBuyRequestDisplayPrice(request);
  const accountTransferTypeLabel =
    request.category === "GAME_ACCOUNT" ? getAccountTransferTypeLabelNode(request.accountTransferType) : null;

  return (
    <article className="border-b border-[var(--gg-border-soft)] p-5 transition last:border-b-0 hover:bg-[var(--gg-card-soft-bg)]">
      <div className="grid gap-4 lg:grid-cols-[1fr_210px] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <span className="rounded-md bg-[var(--gg-control-bg)] px-2 py-1 text-xs font-black text-[var(--gg-muted)]">
              <CountryText id={getCategoryKey(request.category)} />
            </span>
            {accountTransferTypeLabel ? (
              <span className="rounded-md bg-[color-mix(in_srgb,var(--gg-accent)_12%,white)] px-2 py-1 text-xs font-black text-[var(--gg-accent)]">
                {accountTransferTypeLabel}
              </span>
            ) : null}
            {pendingOffers.length ? (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">
                <CountryText id="manage.offer" /> {pendingOffers.length}
              </span>
            ) : null}
            <span className="text-xs font-bold text-[var(--gg-subtle)]">
              <CountryText id="manage.registeredAt" /> {request.createdAt}
            </span>
          </div>

          <h2 className="mt-2 truncate text-lg font-black">
            <BuyRequestTitle request={request} />
          </h2>
          <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
            {request.gameName}
            {request.serverName ? ` / ${request.serverName}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[var(--gg-muted)]">
            <InfoChip label={<CountryText id="manage.buyQuantity" />} value={formatQuantity(request.quantity, moneyUnit)} />
            <InfoChip label={<CountryText id="manage.unitPrice" />} value={`${price.amount} ${request.currency}${price.unitLabel ? ` / ${price.unitLabel}` : ""}`} />
            {request.category === "GAME_MONEY" ? (
              <>
                <InfoChip label="거래 방식" value={request.tradeMode === "BULK" ? "일괄 구매" : "분할 구매"} />
                <InfoChip label={<CountryText id="manage.minimumQuantity" />} value={formatQuantity(request.minimumQuantity, moneyUnit)} />
              </>
            ) : null}
            <InfoChip label={<CountryText id="manage.reserveAmount" />} value={`${request.lockAmount} ${request.currency}`} />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="lg:text-right">
            <p className="text-2xl font-black text-[var(--gg-accent)]">
              {request.totalAmount} {request.currency}
            </p>
            <p className="text-xs font-bold text-[var(--gg-muted)]">
              <CountryText id="manage.totalBuyExpected" />
            </p>
          </div>
          <BuyRequestActions buyRequestId={request.buyRequestId} status={request.status} />
          {request.status !== "ACTIVE" ? (
            <Link
              href="/my/orders"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-xs font-black hover:bg-[var(--gg-control-bg)]"
            >
              <CountryText id="manage.checkOrders" />
            </Link>
          ) : null}
        </div>
      </div>

      {hasMoreDetail(request) ? (
        <details className="mt-4 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
          <summary className="cursor-pointer text-sm font-black">
            <CountryText id="manage.viewConditionsOffers" />
          </summary>

          {request.description || accountTransferTypeLabel || request.accountRank ? (
            <div className="mt-4 rounded-xl border border-[var(--gg-border-soft)] bg-[var(--gg-control-bg)] p-4 text-sm font-bold leading-6 text-[var(--gg-muted)]">
              {accountTransferTypeLabel ? (
                <p>
                  <CountryText id="listingForm.accountType" />: {accountTransferTypeLabel}
                </p>
              ) : null}
              {request.accountRank ? (
                <p>
                  <CountryText id="manage.accountSpec" />: {request.accountRank}
                </p>
              ) : null}
              {request.description ? (
                <UserContentText
                  text={request.description}
                  multiline
                  className="mt-2 whitespace-pre-wrap"
                />
              ) : null}
            </div>
          ) : null}

          {request.offers && request.offers.length > 0 ? (
            <div className="mt-4 space-y-3">
              {request.offers.map((offer) => (
                <OfferRow
                  key={offer.offerId}
                  offer={offer}
                  canUpdate={request.status === "ACTIVE" && offer.status === "PENDING"}
                />
              ))}
            </div>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}

function OfferRow({ offer, canUpdate }: { offer: BuyRequestOffer; canUpdate: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black">{offer.sellerName}</p>
        <span className={`rounded-md px-2 py-1 text-xs font-black ${getOfferStatusClass(offer.status)}`}>
          <CountryText id={getOfferStatusKey(offer.status)} />
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-sm font-black sm:grid-cols-3">
        <span>
          <CountryText id="manage.quantity" /> {offer.quantity}
        </span>
        <span>
          <CountryText id="manage.unitPrice" /> {offer.unitPrice} {offer.currency}
        </span>
        <span>
          <CountryText id="manage.totalAmount" /> {offer.totalAmount} {offer.currency}
        </span>
      </div>
      {offer.message ? (
        <p className="mt-3 text-sm font-bold text-[var(--gg-muted)]">
          <UserContentText text={offer.message} />
        </p>
      ) : null}
      {canUpdate ? <OfferActions offerId={offer.offerId} /> : null}
    </div>
  );
}

function SummaryBox({ label, value }: { label: ReactNode; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-black">{value}</p>
    </div>
  );
}

function InfoChip({ label, value }: { label: ReactNode; value: string }) {
  return (
    <span className="rounded-full border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-1">
      {label} {value}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-black ${getStatusClass(status)}`}>
      <CountryText id={getBuyRequestStatusKey(status)} />
    </span>
  );
}

function BuyRequestTitle({ request }: { request: MyBuyRequest }) {
  if (request.title) return <UserContentText text={request.title} />;

  return (
    <>
      {request.gameName} {request.serverName ? `${request.serverName} ` : ""}
      <CountryText id={getCategoryKey(request.category)} /> <CountryText id="manage.buyingEyebrow" />
    </>
  );
}

function hasMoreDetail(request: MyBuyRequest) {
  return Boolean(
    request.description ||
      request.accountTransferType ||
      request.accountRank ||
      (request.offers && request.offers.length > 0),
  );
}

function getBuyRequestPriority(status: string) {
  const priority: Record<string, number> = {
    ACTIVE: 0,
    ACCEPTED: 1,
    COMPLETED: 6,
    EXPIRED: 8,
    CANCELED: 9,
  };

  return priority[status] ?? 5;
}

function getStatusFilter(status?: string) {
  if (["ACTIVE", "ACCEPTED", "COMPLETED", "CANCELED"].includes(status ?? "")) {
    return status as "ACTIVE" | "ACCEPTED" | "COMPLETED" | "CANCELED";
  }

  return "ALL";
}

function countByStatus(requests: MyBuyRequest[], status: string) {
  return requests.filter((request) => request.status === status).length;
}

function getStatusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "ACCEPTED") return "bg-sky-100 text-sky-800";
  if (status === "COMPLETED") return "bg-slate-100 text-slate-700";
  if (status === "CANCELED") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function getOfferStatusClass(status: string) {
  if (status === "PENDING") return "bg-amber-100 text-amber-800";
  if (status === "ACCEPTED") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

function getBuyRequestStatusKey(status: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    ACTIVE: "manage.buying",
    ACCEPTED: "manage.inTrade",
    EXPIRED: "manage.statusExpired",
    CANCELED: "manage.canceled",
    COMPLETED: "manage.completed",
  };

  return labels[status] || "manage.inTrade";
}

function getOfferStatusKey(status: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    PENDING: "manage.offerPending",
    ACCEPTED: "manage.offerAccepted",
    REJECTED: "manage.offerRejected",
  };

  return labels[status] || "manage.offerPending";
}

function getCategoryKey(category: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    GAME_MONEY: "common.gameMoney",
    GAME_ITEM: "common.item",
    GAME_ACCOUNT: "common.account",
  };

  return labels[category] || "common.item";
}

function getAccountTransferTypeLabelNode(value: string | null) {
  if (value === "GOOGLE") return <CountryText id="account.google" />;
  if (value === "GAME_COMPANY") return <CountryText id="account.gameCompany" />;
  return null;
}

function formatQuantity(quantity: string, unit: string | null) {
  return unit ? `${quantity} ${unit}` : quantity;
}

function getBuyRequestDisplayPrice(request: MyBuyRequest) {
  if (request.category !== "GAME_MONEY") {
    return {
      amount: request.unitPrice,
      unitLabel: null,
    };
  }

  const unitQuantity = Number(request.priceUnitQuantity || "1");
  const unitPrice = Number(request.unitPrice || "0");

  return {
    amount: formatDisplayNumber(unitPrice * unitQuantity),
    unitLabel: getGameMoneyPriceUnitLabel(
      request.priceUnitQuantity,
      request.moneyUnitName,
    ),
  };
}

function formatDisplayNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

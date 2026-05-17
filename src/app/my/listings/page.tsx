import type { ReactNode } from "react";
import Link from "next/link";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import LocalizedInput from "@/app/localized-input";
import UserContentText from "@/app/user-content-text";
import {
  formatGameMoneyQuantityWithUnit,
  getGameMoneyPriceUnitLabel,
} from "@/lib/market/trade-unit";
import { getMarketplaceMyListings } from "@/lib/market/my-listings";
import SellerListingActions from "./seller-listing-actions";

export const dynamic = "force-dynamic";

type MyListingsView = Awaited<ReturnType<typeof getMarketplaceMyListings>>;
type MyListing = MyListingsView["listings"][number];
type SellerOrder = MyListingsView["recentOrders"][number];

type MyListingsPageProps = {
  searchParams?: Promise<{
    q?: string;
    inventory?: string;
    status?: string;
    game?: string;
  }>;
};

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
  const view = await getMarketplaceMyListings();
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q?.trim().toLowerCase() ?? "";
  const inventoryFilter = getInventoryFilter(resolvedSearchParams?.inventory);
  const statusFilter = getStatusFilter(resolvedSearchParams?.status);
  const gameFilter = resolvedSearchParams?.game?.trim() ?? "ALL";
  const gameOptions = Array.from(new Set(view.listings.map((listing) => listing.gameName))).sort(
    (left, right) => left.localeCompare(right),
  );
  const sellingCount = view.listings.filter(isSellingListing).length;
  const soldOutCount = view.listings.filter(isSoldOutListing).length;
  const pausedCount = view.listings.filter(isPausedListing).length;
  const actionOrders = view.recentOrders.filter((order) =>
    [
      "ESCROW_LOCKED",
      "SELLER_RESPONSE_PENDING",
      "DELIVERY_IN_PROGRESS",
      "DELIVERY_COMPLETED",
      "BUYER_CONFIRM_PENDING",
      "DISPUTED",
    ].includes(order.status),
  );
  const filteredListings = view.listings.filter((listing) => {
    const matchesQuery =
      !query ||
      [listing.title, listing.gameName, listing.serverName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    const matchesGame = gameFilter === "ALL" || listing.gameName === gameFilter;
    const matchesInventory =
      inventoryFilter === "ALL" ||
      (inventoryFilter === "SELLING" && isSellingListing(listing)) ||
      (inventoryFilter === "SOLD_OUT" && isSoldOutListing(listing)) ||
      (inventoryFilter === "PAUSED" && isPausedListing(listing));
    const matchesStatus = !statusFilter || listing.status === statusFilter;

    return matchesQuery && matchesGame && matchesInventory && matchesStatus;
  });

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto max-w-[1180px] space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="manage.sellingEyebrow" />
            </p>
            <h1 className="mt-1 text-3xl font-black">
              <CountryText id="manage.mySellPosts" />
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/my/listings/new"
              className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              <CountryText id="manage.createSell" />
            </Link>
            <Link
              href="/my/chat"
              className="rounded-xl border border-[var(--gg-border)] px-5 py-3 text-sm font-black hover:bg-[var(--gg-control-bg)]"
            >
              <CountryText id="common.chat" />
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <SummaryBox
            label={<CountryText id="manage.holdingAmount" />}
            value={`${view.wallet?.availableBalance ?? "0"} ${view.wallet?.currency ?? "USDT"}`}
          />
          <SummaryBox label={<CountryText id="manage.selling" />} value={sellingCount} />
          <SummaryBox label={<CountryText id="manage.soldOut" />} value={soldOutCount} />
          <SummaryBox label={<CountryText id="manage.actionOrders" />} value={actionOrders.length} />
        </section>

        {actionOrders[0] ? <ActionNotice order={actionOrders[0]} /> : null}

        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterPill href={buildHref({ inventory: "ALL", game: gameFilter })} active={inventoryFilter === "ALL"}>
                <CountryText id="manage.all" /> {view.listings.length}
              </FilterPill>
              <FilterPill href={buildHref({ inventory: "SELLING", game: gameFilter })} active={inventoryFilter === "SELLING"}>
                <CountryText id="manage.selling" /> {sellingCount}
              </FilterPill>
              <FilterPill href={buildHref({ inventory: "SOLD_OUT", game: gameFilter })} active={inventoryFilter === "SOLD_OUT"}>
                <CountryText id="manage.soldOut" /> {soldOutCount}
              </FilterPill>
              <FilterPill href={buildHref({ inventory: "PAUSED", game: gameFilter })} active={inventoryFilter === "PAUSED"}>
                <CountryText id="manage.pausedHidden" /> {pausedCount}
              </FilterPill>
            </div>

            <form className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <select
                name="game"
                defaultValue={gameFilter}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-sm font-bold outline-none"
              >
                <option value="ALL"><CountryText id="manage.allGames" /></option>
                {gameOptions.map((gameName) => (
                  <option key={gameName} value={gameName}>
                    {gameName}
                  </option>
                ))}
              </select>
              <input type="hidden" name="inventory" value={inventoryFilter} />
              <LocalizedInput
                name="q"
                defaultValue={resolvedSearchParams?.q ?? ""}
                placeholderKey="manage.searchPlaceholder"
                aria-label="sell-post-search"
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-sm font-bold outline-none"
              />
              <button className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]">
                <CountryText id="common.search" />
              </button>
            </form>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
          {filteredListings.length ? (
            filteredListings.map((listing) => <ListingRow key={listing.listingId} listing={listing} />)
          ) : (
            <EmptyState href="/my/listings/new" label={<CountryText id="manage.createSell" />} />
          )}
        </section>

        <RecentSellerOrders orders={view.recentOrders} />
      </section>
    </main>
  );
}

function ListingRow({ listing }: { listing: MyListing }) {
  const soldOut = isSoldOutListing(listing);
  const publicHref = `/listings/${listing.listingId}`;
  const editHref = `/my/listings/${listing.listingId}/edit`;
  const priceUnitLabel =
    listing.category === "GAME_MONEY"
      ? getGameMoneyPriceUnitLabel(listing.priceUnitQuantity, listing.moneyUnitName)
      : null;
  const displayUnitPrice =
    listing.category === "GAME_MONEY"
      ? formatDisplayNumber(Number(listing.unitPrice) * Number(listing.priceUnitQuantity || "1"))
      : listing.unitPrice;
  const accountTransferTypeLabel =
    listing.category === "GAME_ACCOUNT" ? getAccountTransferTypeLabelNode(listing.accountTransferType) : null;
  const availableQuantityLabel = formatListingQuantity(listing, listing.availableQuantity);
  const minimumQuantityLabel = formatListingQuantity(listing, listing.minimumQuantity);
  const soldQuantityLabel = formatListingQuantity(listing, listing.soldQuantity);

  return (
    <article className="grid gap-2.5 border-b border-[var(--gg-border-soft)] p-4 transition last:border-b-0 hover:bg-[var(--gg-card-soft-bg)] sm:gap-4 sm:p-5 lg:grid-cols-[1fr_190px]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <StatusBadge status={listing.status} soldOut={soldOut} />
          <span className="rounded-md bg-[var(--gg-control-bg)] px-2 py-1 text-xs font-black text-[var(--gg-muted)]">
            <CountryText id={getCategoryKey(listing.category)} />
          </span>
          {accountTransferTypeLabel ? (
            <span className="rounded-md bg-[color-mix(in_srgb,var(--gg-accent)_12%,white)] px-2 py-1 text-xs font-black text-[var(--gg-accent)]">
              {accountTransferTypeLabel}
            </span>
          ) : null}
          <span className="ml-auto shrink-0 text-[11px] font-bold text-[var(--gg-subtle)] sm:text-xs">
            <CountryText id="manage.registeredAt" /> {listing.createdAt}
          </span>
        </div>
        <Link
          href={soldOut ? editHref : publicHref}
          className="mt-2 line-clamp-2 block text-base font-black leading-snug hover:text-[var(--gg-accent)] sm:text-lg"
        >
          <UserContentText text={listing.title} />
        </Link>
        <p className="mt-1 line-clamp-1 text-xs font-bold text-[var(--gg-muted)] sm:text-sm">
          {listing.gameName}
          {listing.serverName ? ` / ${listing.serverName}` : ""}
        </p>
      </div>

      <div className="flex min-w-0 items-end justify-between gap-3 lg:flex-col lg:items-end lg:text-right">
        <div className="min-w-0">
          <p className="break-words text-2xl font-black leading-tight text-[var(--gg-accent)] lg:text-2xl">
            {displayUnitPrice} {listing.currency}
          </p>
          <p className="mt-1 line-clamp-1 text-[10px] font-bold leading-snug text-[var(--gg-muted)] sm:text-xs lg:line-clamp-2">
            <CountryText id="manage.unitPrice" />
            {priceUnitLabel ? ` / ${priceUnitLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-lg bg-[var(--gg-card-soft-bg)] px-3 py-2 text-[11px] font-black text-[var(--gg-muted)] sm:gap-2 sm:text-xs lg:col-span-1 lg:bg-transparent lg:p-0">
        <InfoChip label={<CountryText id="manage.availableToSell" />} value={availableQuantityLabel} />
        <InfoChip label={<CountryText id="manage.minimumQuantity" />} value={minimumQuantityLabel} />
        <InfoChip label={<CountryText id="manage.soldQuantity" />} value={soldQuantityLabel} />
        {listing.category === "GAME_MONEY" ? (
          <InfoChip
            label={<CountryText id="listingForm.sellMode" />}
            value={
              listing.tradeMode === "BULK" ? (
                <CountryText id="listingForm.bulkSell" />
              ) : (
                <CountryText id="listingForm.splitSell" />
              )
            }
          />
        ) : null}
      </div>

      <div className="lg:col-span-1 lg:justify-self-end">
        <SellerListingActions
          listingId={listing.listingId}
          status={listing.status}
          availableQuantity={listing.availableQuantity}
        />
      </div>
    </article>
  );
}

function ActionNotice({ order }: { order: SellerOrder }) {
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-amber-800"><CountryText id="manage.sellerOrderNotice" /></p>
          <p className="mt-1 text-sm font-bold text-[var(--gg-text)]">
            {order.orderNumber} / <CountryText id={getOrderStatusKey(order.status)} />
          </p>
        </div>
        <Link
          href={`/my/listings/orders/${order.orderId}`}
          className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-[var(--gg-inverse-text)]"
        >
          <CountryText id="manage.processOrder" />
        </Link>
      </div>
    </section>
  );
}

function RecentSellerOrders({ orders }: { orders: SellerOrder[] }) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black"><CountryText id="manage.recentSellerOrders" /></h2>
        <span className="text-sm font-black text-[var(--gg-accent)]">
          {orders.length}
          <CountryText id="manage.countSuffix" />
        </span>
      </div>
      <div className="mt-4 divide-y divide-[var(--gg-border-soft)]">
        {orders.slice(0, 8).map((order) => (
          <Link
            key={order.orderId}
            href={`/my/listings/orders/${order.orderId}`}
            className="grid gap-2 py-4 hover:bg-[var(--gg-control-bg)] sm:grid-cols-[1fr_120px_120px]"
          >
            <div className="min-w-0">
              <p className="truncate font-black">
                <UserContentText text={order.listingTitle} />
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">
                {order.orderNumber} / {order.buyerName}
              </p>
            </div>
            <span className={`w-fit rounded-md px-2 py-1 text-xs font-black ${getOrderStatusClass(order.status)}`}>
              <CountryText id={getOrderStatusKey(order.status)} />
            </span>
            <p className="text-sm font-black sm:text-right">
              {order.amount} {order.currency}
            </p>
          </Link>
        ))}
        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm font-black text-[var(--gg-subtle)]">
            <CountryText id="manage.noOrders" />
          </p>
        ) : null}
      </div>
    </section>
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

function InfoChip({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-1">
      {label} {value}
    </span>
  );
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)]"
          : "rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black text-[var(--gg-muted)] hover:bg-[var(--gg-control-bg)]"
      }
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status, soldOut }: { status: string; soldOut: boolean }) {
  const labelKey = soldOut ? "manage.soldOut" : getListingStatusKey(status);
  const className = soldOut
    ? "bg-slate-100 text-slate-700"
    : status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-800"
      : status === "PAUSED"
        ? "bg-amber-100 text-amber-800"
        : status === "HIDDEN"
          ? "bg-slate-100 text-slate-700"
          : "bg-red-100 text-red-800";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-black ${className}`}>
      <CountryText id={labelKey} />
    </span>
  );
}

function EmptyState({ href, label }: { href: string; label: ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 bg-[var(--gg-card-soft-bg)]">
      <p className="text-sm font-black text-[var(--gg-muted)]">
        <CountryText id="manage.noSellPosts" />
      </p>
      <Link
        href={href}
        className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
      >
        {label}
      </Link>
    </div>
  );
}

function isSellingListing(listing: Pick<MyListing, "status" | "availableQuantity">) {
  return listing.status === "ACTIVE" && Number(listing.availableQuantity) > 0;
}

function isSoldOutListing(listing: Pick<MyListing, "status" | "availableQuantity">) {
  return listing.status === "SOLD_OUT" || Number(listing.availableQuantity) <= 0;
}

function isPausedListing(listing: Pick<MyListing, "status">) {
  return listing.status === "PAUSED" || listing.status === "HIDDEN";
}

function getInventoryFilter(value?: string) {
  if (value === "SELLING" || value === "SOLD_OUT" || value === "PAUSED") {
    return value;
  }

  return "ALL";
}

function getStatusFilter(value?: string) {
  if (value === "ACTIVE" || value === "PAUSED" || value === "SOLD_OUT" || value === "HIDDEN") {
    return value;
  }

  return null;
}

function getListingStatusKey(status: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    ACTIVE: "manage.selling",
    PAUSED: "manage.statusPaused",
    SOLD_OUT: "manage.soldOut",
    HIDDEN: "manage.statusHidden",
  };

  return labels[status] || "manage.statusHidden";
}

function getOrderStatusKey(status: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    REQUESTED: "manage.statusTradeWaiting",
    ESCROW_LOCKED: "manage.statusPaymentDone",
    SELLER_RESPONSE_PENDING: "manage.statusResponsePending",
    DELIVERY_IN_PROGRESS: "manage.statusDeliveryInProgress",
    DELIVERY_COMPLETED: "manage.statusDeliveryCompleted",
    BUYER_CONFIRM_PENDING: "manage.statusConfirmPending",
    COMPLETED: "manage.statusTradeCompleted",
    DISPUTED: "manage.statusDisputed",
    CANCELED: "manage.canceled",
    REFUNDED: "manage.statusRefunded",
  };

  return labels[status] || "manage.statusTradeWaiting";
}

function getOrderStatusClass(status: string) {
  if (["ESCROW_LOCKED", "DELIVERY_IN_PROGRESS", "DELIVERY_COMPLETED"].includes(status)) {
    return "bg-sky-100 text-sky-800";
  }
  if (["SELLER_RESPONSE_PENDING", "BUYER_CONFIRM_PENDING", "REQUESTED"].includes(status)) {
    return "bg-amber-100 text-amber-800";
  }
  if (status === "COMPLETED") {
    return "bg-emerald-100 text-emerald-800";
  }
  return "bg-red-100 text-red-800";
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

function formatListingQuantity(
  listing: Pick<MyListing, "category" | "priceUnitQuantity" | "moneyUnitName">,
  quantity: string,
) {
  if (listing.category === "GAME_MONEY") {
    return formatGameMoneyQuantityWithUnit(
      quantity,
      listing.priceUnitQuantity,
      listing.moneyUnitName,
    );
  }

  return quantity;
}

function buildHref({ inventory, game }: { inventory: string; game: string }) {
  const params = new URLSearchParams();
  if (inventory !== "ALL") params.set("inventory", inventory);
  if (game !== "ALL") params.set("game", game);
  const query = params.toString();
  return query ? `/my/listings?${query}` : "/my/listings";
}

function formatDisplayNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

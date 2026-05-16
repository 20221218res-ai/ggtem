import type { ReactNode } from "react";
import Link from "next/link";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import UserContentText from "@/app/user-content-text";
import { getMarketplaceMyOrders } from "@/lib/market/my-orders";
import { formatGameMoneyQuantityWithUnit } from "@/lib/market/trade-unit";

const statusTone: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  ESCROW_LOCKED: "bg-blue-100 text-blue-800",
  SELLER_RESPONSE_PENDING: "bg-amber-100 text-amber-800",
  DELIVERY_IN_PROGRESS: "bg-blue-100 text-blue-800",
  DELIVERY_COMPLETED:
    "bg-[color-mix(in_srgb,var(--gg-accent)_18%,transparent)] text-[var(--gg-accent)]",
  BUYER_CONFIRM_PENDING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELED: "bg-slate-100 text-slate-700",
  DISPUTED: "bg-red-100 text-red-800",
  REFUNDED: "bg-slate-100 text-slate-700",
};

const orderPriority: Record<string, number> = {
  DELIVERY_COMPLETED: 0,
  BUYER_CONFIRM_PENDING: 0,
  DISPUTED: 1,
  DELIVERY_IN_PROGRESS: 2,
  ESCROW_LOCKED: 3,
  SELLER_RESPONSE_PENDING: 4,
  REQUESTED: 5,
  COMPLETED: 8,
  CANCELED: 9,
  REFUNDED: 9,
};

type MyOrdersView = Awaited<ReturnType<typeof getMarketplaceMyOrders>>;
type MyOrder = MyOrdersView["orders"][number];

type MyOrdersPageProps = {
  searchParams?: Promise<{ view?: string }>;
};

export default async function MyOrdersPage({ searchParams }: MyOrdersPageProps) {
  const resolvedSearchParams = await searchParams;
  const orderView = getOrderViewFilter(resolvedSearchParams?.view);
  const view = await getMarketplaceMyOrders();

  const activeOrders = view.orders.filter(
    (order) => !["COMPLETED", "CANCELED", "REFUNDED"].includes(order.status),
  );
  const attentionOrders = view.orders.filter((order) =>
    ["DELIVERY_COMPLETED", "BUYER_CONFIRM_PENDING", "DISPUTED"].includes(order.status),
  );
  const filteredOrders = view.orders
    .filter((order) => matchesOrderView(order.status, orderView))
    .sort(
      (left, right) =>
        (orderPriority[left.status] ?? 5) - (orderPriority[right.status] ?? 5),
    );

  const tabs: Array<{ labelKey: TranslationKey; value: string; count: number; href: string }> = [
    { labelKey: "manage.all", value: "ALL", count: view.orders.length, href: "/my/orders" },
    {
      labelKey: "orderManage.attentionNeeded",
      value: "ATTENTION",
      count: attentionOrders.length,
      href: "/my/orders?view=attention",
    },
    {
      labelKey: "orderManage.activeCount",
      value: "ACTIVE",
      count: activeOrders.length,
      href: "/my/orders?view=active",
    },
    {
      labelKey: "manage.completed",
      value: "COMPLETED",
      count: view.orders.filter((order) => order.status === "COMPLETED").length,
      href: "/my/orders?view=completed",
    },
    {
      labelKey: "orderManage.disputed",
      value: "DISPUTED",
      count: view.orders.filter((order) => order.status === "DISPUTED").length,
      href: "/my/orders?view=disputed",
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-[1180px] gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="manage.buyingEyebrow" />
            </p>
            <h1 className="mt-1 text-3xl font-black">
              <CountryText id="orderManage.buyOrders" />
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/listings" className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]">
              <CountryText id="orderManage.findListings" />
            </Link>
            <Link href="/my/listings" className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]">
              <CountryText id="orderManage.sellHistory" />
            </Link>
            <Link href="/my/wallet" className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]">
              <CountryText id="orderManage.viewWallet" />
            </Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={<CountryText id="orderManage.availableBalance" />} value={`${view.wallet?.availableBalance ?? "0"} ${view.wallet?.currency ?? "USDT"}`} />
          <Metric label={<CountryText id="orderManage.inTradeAmount" />} value={`${view.wallet?.escrowBalance ?? "0"} ${view.wallet?.currency ?? "USDT"}`} />
          <Metric label={<CountryText id="orderManage.activeCount" />} value={<CountValue value={activeOrders.length} />} />
          <Metric
            label={<CountryText id="orderManage.attentionNeeded" />}
            value={<CountValue value={attentionOrders.length} />}
            tone={attentionOrders.length > 0 ? "warn" : "normal"}
          />
        </section>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-2 shadow-sm shadow-[var(--gg-shadow)]">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={tab.href}
              className={
                orderView === tab.value
                  ? "whitespace-nowrap rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)]"
                  : "whitespace-nowrap rounded-xl px-4 py-3 text-sm font-black text-[var(--gg-muted)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-text)]"
              }
            >
              <CountryText id={tab.labelKey} /> {tab.count}
            </Link>
          ))}
        </nav>

        <section className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
          {filteredOrders.length ? (
            filteredOrders.map((order) => <OrderRow key={order.orderId} order={order} />)
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 bg-[var(--gg-card-soft-bg)] p-8 text-center">
              <p className="text-lg font-black">
                <CountryText id="orderManage.noOrders" />
              </p>
              <Link href="/listings" className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)]">
                <CountryText id="orderManage.browseListings" />
              </Link>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function OrderRow({ order }: { order: MyOrder }) {
  const accountType =
    order.category === "GAME_ACCOUNT" ? getAccountTransferTypeLabelNode(order.accountTransferType) : null;
  const gameMeta = [order.gameName, order.serverName].filter(Boolean).join(" / ");

  return (
    <article className="grid gap-4 border-b border-[var(--gg-border-soft)] p-5 transition hover:bg-[var(--gg-card-soft-bg)] last:border-b-0 lg:grid-cols-[1fr_200px_220px] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-3 py-1 text-xs font-black ${statusTone[order.status] ?? "bg-slate-100 text-slate-700"}`}>
            <CountryText id={getOrderStatusKey(order.status)} />
          </span>
          <span className="rounded-md bg-[var(--gg-control-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
            <CountryText id={getCategoryKey(order.category)} />
          </span>
          {accountType ? (
            <span className="rounded-md bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] px-3 py-1 text-xs font-black text-[var(--gg-accent)]">
              {accountType}
            </span>
          ) : null}
          <span className="text-xs font-black text-[var(--gg-subtle)]">{order.orderNumber}</span>
        </div>
        <Link href={`/my/orders/${order.orderId}`} className="mt-3 block truncate text-lg font-black hover:text-[var(--gg-accent)]">
          <UserContentText text={order.listingTitle} />
        </Link>
        <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
          {gameMeta || <CountryText id="orderManage.gameInfoMissing" />} / <CountryText id="orderManage.seller" /> {order.sellerName} / {order.createdAt}
        </p>
        {isAttentionStatus(order.status) ? (
          <p className="mt-3 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">
            <CountryText id={getAttentionKey(order.status)} />
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        <SmallInfo label={<CountryText id="orderManage.quantity" />} value={<QuantityValue order={order} />} />
        <SmallInfo label={<CountryText id="orderManage.amount" />} value={`${order.amount} ${order.currency}`} />
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Link href={`/my/orders/${order.orderId}`} className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]">
          <CountryText id="orderManage.detail" />
        </Link>
        <Link href={`/my/orders/${order.orderId}/chat`} className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]">
          <CountryText id="common.chat" />
        </Link>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  tone = "normal",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "normal" | "warn";
}) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-[var(--gg-shadow)]"}`}>
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </section>
  );
}

function SmallInfo({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--gg-control-bg)] p-3">
      <p className="text-xs font-black text-[var(--gg-subtle)]">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function CountValue({ value }: { value: number }) {
  return (
    <>
      {value}
      <CountryText id="manage.countSuffix" />
    </>
  );
}

function QuantityValue({ order }: { order: MyOrder }) {
  const moneyUnit = order.moneyUnitName?.trim();

  if (order.category === "GAME_MONEY") {
    return (
      <>
        {formatGameMoneyQuantityWithUnit(
          order.quantity,
          order.priceUnitQuantity,
          moneyUnit,
        )}
      </>
    );
  }

  return (
    <>
      {order.quantity} <CountryText id={getCategoryKey(order.category)} />
    </>
  );
}

function getOrderViewFilter(view?: string) {
  if (view === "attention") return "ATTENTION";
  if (view === "active") return "ACTIVE";
  if (view === "completed") return "COMPLETED";
  if (view === "disputed") return "DISPUTED";
  return "ALL";
}

function matchesOrderView(status: string, view: string) {
  if (view === "ATTENTION") return isAttentionStatus(status);
  if (view === "ACTIVE") return !["COMPLETED", "CANCELED", "REFUNDED"].includes(status);
  if (view === "COMPLETED") return status === "COMPLETED";
  if (view === "DISPUTED") return status === "DISPUTED";
  return true;
}

function isAttentionStatus(status: string) {
  return ["DELIVERY_COMPLETED", "BUYER_CONFIRM_PENDING", "DISPUTED"].includes(status);
}

function getAttentionKey(status: string): TranslationKey {
  if (status === "DISPUTED") return "orderManage.disputeReview";
  return "orderManage.buyerAttentionConfirm";
}

function getOrderStatusKey(status: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    REQUESTED: "orderStatus.requested",
    ESCROW_LOCKED: "orderStatus.escrowLocked",
    SELLER_RESPONSE_PENDING: "orderStatus.sellerResponsePending",
    DELIVERY_IN_PROGRESS: "orderStatus.deliveryInProgress",
    DELIVERY_COMPLETED: "orderStatus.deliveryCompleted",
    BUYER_CONFIRM_PENDING: "orderStatus.buyerConfirmPending",
    COMPLETED: "orderStatus.completed",
    DISPUTED: "orderStatus.disputed",
    CANCELED: "orderStatus.canceled",
    REFUNDED: "orderStatus.refunded",
  };

  return labels[status] ?? "orderStatus.requested";
}

function getCategoryKey(category: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    GAME_MONEY: "common.gameMoney",
    GAME_ITEM: "common.item",
    GAME_ACCOUNT: "common.account",
  };

  return labels[category] ?? "common.item";
}

function getAccountTransferTypeLabelNode(value: string | null) {
  if (value === "GOOGLE") return <CountryText id="account.google" />;
  if (value === "GAME_COMPANY") return <CountryText id="account.gameCompany" />;
  return null;
}

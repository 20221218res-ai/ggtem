import type { ReactNode } from "react";
import Link from "next/link";
import AccountCredentialPanel from "@/app/account-credential-panel";
import { notFound } from "next/navigation";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import OrderReviewForm from "@/app/order-review-form";
import TrustReportForm from "@/app/trust-report-form";
import UserContentText from "@/app/user-content-text";
import { getMarketplaceMyOrderDetail } from "@/lib/market/my-orders";
import { BuyerOrderActions } from "./buyer-order-actions";

type MyOrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

type BuyerOrderDetail = NonNullable<Awaited<ReturnType<typeof getMarketplaceMyOrderDetail>>>;

export default async function MyOrderDetailPage({ params }: MyOrderDetailPageProps) {
  const { orderId } = await params;
  const order = await getMarketplaceMyOrderDetail(orderId);

  if (!order) {
    notFound();
  }

  const accountType =
    order.category === "GAME_ACCOUNT" ? getAccountTransferTypeLabelNode(order.accountTransferType) : null;
  const gameMeta = [order.gameName, order.serverName].filter(Boolean).join(" / ");

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-5">
          <header className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link href="/my/orders" className="text-sm font-black text-[var(--gg-accent)]">
                  <CountryText id="orderManage.buyOrders" />
                </Link>
                <h1 className="mt-3 truncate text-2xl font-black">
                  <UserContentText text={order.listingTitle} />
                </h1>
                <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
                  {order.orderNumber} / {order.createdAt}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MetaChip><CountryText id={getCategoryKey(order.category)} /></MetaChip>
                  <MetaChip>{gameMeta || <CountryText id="orderManage.gameInfoMissing" />}</MetaChip>
                  {accountType ? <MetaChip>{accountType}</MetaChip> : null}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-2xl font-black">
                  {order.grossAmount} {order.currency}
                </p>
                <span className={`mt-2 inline-flex rounded-md px-3 py-2 text-xs font-black ${getStatusClass(order.status)}`}>
                  <CountryText id={getOrderStatusKey(order.status)} />
                </span>
              </div>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={<CountryText id="orderManage.seller" />} value={order.sellerName} />
            <Metric label={<CountryText id="orderManage.gameServer" />} value={gameMeta || <CountryText id="orderManage.gameInfoMissing" />} />
            <Metric label={<CountryText id="orderManage.quantity" />} value={<QuantityValue order={order} />} />
            <Metric label={<CountryText id="orderManage.expectedSettlement" />} value={`${order.sellerReceivableAmount} ${order.currency}`} />
          </section>

          <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-[var(--gg-accent)]">
                  <CountryText id="orderManage.currentStatus" />
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  <CountryText id={getBuyerNextActionKey(order.status)} />
                </h2>
              </div>
              <Link href={`/my/orders/${order.orderId}/chat`} className="rounded-xl bg-[var(--gg-accent)] px-5 py-4 text-center text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]">
                <CountryText id="orderManage.chat" />
              </Link>
            </div>
            <OrderSteps status={order.status} sellerMode={false} />
          </section>

          <details className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <summary className="cursor-pointer text-lg font-black">
              <CountryText id="orderManage.detailHistory" />
            </summary>
            <div className="mt-5 grid gap-3">
              {order.events.map((event) => (
                <div key={event.eventId} className="rounded-xl bg-[var(--gg-control-bg)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black">
                      <CountryText id={getOrderStatusKey(event.status)} />
                    </p>
                    <p className="text-xs font-bold text-[var(--gg-muted)]">{event.createdAt}</p>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
                    <EventMessage message={event.message} />
                  </p>
                </div>
              ))}
            </div>
          </details>

          {order.status === "COMPLETED" ? (
            <OrderReviewForm
              orderId={order.orderId}
              sellerName={order.sellerName}
              existing={order.review}
            />
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <BuyerOrderActions orderId={order.orderId} status={order.status} />

          {order.category === "GAME_ACCOUNT" ? (
            <AccountCredentialPanel orderId={order.orderId} mode="buyer" />
          ) : null}

          <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <h2 className="text-lg font-black">
              <CountryText id="orderManage.quickLinks" />
            </h2>
            <div className="mt-4 space-y-2">
              <Link href={`/listings/${order.listingId}`} className="block rounded-xl border border-[var(--gg-border)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]">
                <CountryText id="orderManage.listingDetail" />
              </Link>
              <Link href="/my/orders" className="block rounded-xl border border-[var(--gg-border)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]">
                <CountryText id="orderManage.buyHistory" />
              </Link>
            </div>
          </section>

          <details className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <summary className="cursor-pointer text-sm font-black">
              <CountryText id="orderManage.reportDispute" />
            </summary>
            <div className="mt-4">
              <TrustReportForm orderId={order.orderId} />
            </div>
          </details>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 truncate text-xl font-black">{value}</p>
    </section>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--gg-control-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
      {children}
    </span>
  );
}

function OrderSteps({ status, sellerMode }: { status: string; sellerMode: boolean }) {
  const steps: TranslationKey[] = sellerMode
    ? ["orderStatus.requested", "orderStatus.escrowLocked", "orderStatus.deliveryInProgress", "orderStatus.completed"]
    : ["orderStatus.requested", "orderStatus.escrowLocked", "orderStatus.deliveryInProgress", "orderStatus.completed"];

  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step} className={`rounded-xl px-4 py-3 text-center text-sm font-black ${getStepIndex(status) >= index ? "bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] text-[var(--gg-accent)]" : "bg-[var(--gg-control-bg)] text-[var(--gg-subtle)]"}`}>
          <CountryText id={step} />
        </div>
      ))}
    </div>
  );
}

function QuantityValue({ order }: { order: Pick<BuyerOrderDetail, "quantity" | "category" | "moneyUnitName"> }) {
  const moneyUnit = order.moneyUnitName?.trim();

  return (
    <>
      {order.quantity}{" "}
      {order.category === "GAME_MONEY" && moneyUnit ? moneyUnit : <CountryText id={getCategoryKey(order.category)} />}
    </>
  );
}

function EventMessage({ message }: { message: string }) {
  const key = getEventMessageKey(message);
  if (key) return <CountryText id={key} />;
  return <>{message}</>;
}

function getBuyerNextActionKey(status: string): TranslationKey {
  if (status === "DELIVERY_COMPLETED" || status === "BUYER_CONFIRM_PENDING") return "orderManage.buyerAttentionConfirm";
  if (status === "DELIVERY_IN_PROGRESS") return "orderManage.sellerDelivering";
  if (status === "DISPUTED") return "orderManage.disputeReview";
  if (status === "COMPLETED") return "orderManage.tradeCompleted";
  if (status === "CANCELED" || status === "REFUNDED") return "orderManage.tradeClosed";
  return "orderManage.chatTradeInfo";
}

function getStepIndex(status: string) {
  if (["REQUESTED", "SELLER_RESPONSE_PENDING"].includes(status)) return 0;
  if (status === "ESCROW_LOCKED") return 1;
  if (["DELIVERY_IN_PROGRESS", "DELIVERY_COMPLETED", "BUYER_CONFIRM_PENDING"].includes(status)) return 2;
  if (status === "COMPLETED") return 3;
  return 0;
}

function getStatusClass(status: string) {
  if (["REQUESTED", "SELLER_RESPONSE_PENDING", "BUYER_CONFIRM_PENDING"].includes(status)) return "bg-amber-100 text-amber-800";
  if (["ESCROW_LOCKED", "DELIVERY_IN_PROGRESS", "DELIVERY_COMPLETED"].includes(status)) return "bg-blue-100 text-blue-800";
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (["DISPUTED", "CANCELED", "REFUNDED"].includes(status)) return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
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

  return labels[status] || "orderStatus.requested";
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

function getEventMessageKey(message: string): TranslationKey | null {
  if (message.includes("Seller started")) return "orderManage.startDelivery";
  if (message.includes("Seller marked")) return "orderManage.markDelivered";
  if (message.includes("Buyer confirmed")) return "orderManage.receiptConfirm";
  if (message.includes("requested buyer confirmation")) return "orderManage.requestBuyerConfirm";
  if (message.includes("reported")) return "orderManage.openDispute";
  if (message.includes("escrow")) return "orderStatus.escrowLocked";
  return null;
}

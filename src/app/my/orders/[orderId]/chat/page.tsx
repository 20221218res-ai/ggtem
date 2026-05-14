import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import OrderChatPanel from "@/app/order-chat-panel";
import UserContentText from "@/app/user-content-text";
import { getOrderChatView } from "@/lib/chat/order-chat";
import { BuyerOrderActions } from "../buyer-order-actions";

export default async function BuyerOrderChatPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const view = await getOrderChatView({
    orderId,
    allowedRoles: ["CUSTOMER"],
    perspective: "BUYER",
  });

  if (!view) {
    notFound();
  }

  const accountType =
    view.category === "GAME_ACCOUNT" ? getAccountTransferTypeLabelNode(view.accountTransferType) : null;
  const gameMeta = [view.gameName, view.serverName].filter(Boolean).join(" / ");

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-4">
          <ChatHeader
            backHref="/my/chat"
            chatTitleKey="chat.buyChat"
            title={<UserContentText text={view.listingTitle} />}
            subtitle={
              <>
                {view.orderNumber}
                {gameMeta ? ` / ${gameMeta}` : ""}
                {accountType ? <> / {accountType}</> : null}
              </>
            }
            amount={`${view.grossAmount} ${view.currency}`}
            status={view.orderStatus}
          />

          <OrderChatPanel
            orderId={view.orderId}
            orderNumber={view.orderNumber}
            orderStatus={view.orderStatus}
            perspective="BUYER"
            counterpartName={view.counterpartName}
            messages={view.messages}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <BuyerOrderActions orderId={view.orderId} status={view.orderStatus} />

          <SideCard>
            <div className="grid gap-2">
              <Link
                href={`/my/orders/${view.orderId}`}
                className="block rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
              >
                <CountryText id="orderManage.detail" />
              </Link>
              <Link
                href={`/listings/${view.listingId}`}
                className="block rounded-xl border border-[var(--gg-border)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
              >
                <CountryText id="orderManage.listingDetail" />
              </Link>
            </div>
          </SideCard>

          <details className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
            <summary className="cursor-pointer text-sm font-black">
              <CountryText id="chat.tradeInfo" />
            </summary>
            <div className="mt-4 space-y-3 text-sm font-bold">
              <InfoRow label={<CountryText id="orderManage.gameServer" />} value={gameMeta || <CountryText id="orderManage.gameInfoMissing" />} />
              {accountType ? <InfoRow label={<CountryText id="listingForm.accountType" />} value={accountType} /> : null}
              <InfoRow label={<CountryText id="orderManage.quantity" />} value={<QuantityValue quantity={view.quantity} category={view.category} moneyUnitName={view.moneyUnitName} />} />
              {view.tradeCharacterName ? <InfoRow label="거래 캐릭터명" value={view.tradeCharacterName} /> : null}
              <InfoRow label={<CountryText id="manage.unitPrice" />} value={<UnitPriceValue view={view} />} />
              <InfoRow label={<CountryText id="orderManage.amount" />} value={`${view.grossAmount} ${view.currency}`} />
              <InfoRow label={<CountryText id="orderManage.expectedSettlement" />} value={`${view.sellerReceivableAmount} ${view.currency}`} />
            </div>
          </details>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">
            <p>반드시 판매자 및 구매자의 게임 아이디를 확인 후 거래하시기 바랍니다.</p>
            <p className="mt-1">게임 아이디 미확인으로 인한 사칭 및 사기 피해 발생 시 본 업체는 책임지지 않습니다.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function ChatHeader({
  backHref,
  chatTitleKey,
  title,
  subtitle,
  amount,
  status,
}: {
  backHref: string;
  chatTitleKey: TranslationKey;
  title: ReactNode;
  subtitle: ReactNode;
  amount: string;
  status: string;
}) {
  return (
    <header className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={backHref} className="text-sm font-black text-[var(--gg-accent)]">
            <CountryText id="chat.list" />
          </Link>
          <h1 className="mt-3 truncate text-2xl font-black">
            <CountryText id={chatTitleKey} /> / {title}
          </h1>
          <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">{subtitle}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-black">{amount}</p>
          <span className={`mt-2 inline-flex rounded-md px-3 py-2 text-xs font-black ${getStatusClass(status)}`}>
            <CountryText id={getOrderStatusKey(status)} />
          </span>
        </div>
      </div>
    </header>
  );
}

function SideCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      {title ? <h2 className="text-lg font-black">{title}</h2> : null}
      <div className={title ? "mt-4 space-y-3 text-sm font-bold" : ""}>{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--gg-muted)]">{label}</span>
      <span className="text-right">{value || "-"}</span>
    </div>
  );
}

function QuantityValue({ quantity, category, moneyUnitName }: { quantity: string; category: string; moneyUnitName: string | null }) {
  const moneyUnit = moneyUnitName?.trim();

  return (
    <>
      {quantity} {category === "GAME_MONEY" && moneyUnit ? moneyUnit : <CountryText id={getCategoryKey(category)} />}
    </>
  );
}

function UnitPriceValue({
  view,
}: {
  view: Pick<NonNullable<Awaited<ReturnType<typeof getOrderChatView>>>, "category" | "currency" | "moneyUnitName" | "unitPrice">;
}) {
  const moneyUnit = view.moneyUnitName?.trim();

  return (
    <>
      {view.unitPrice} {view.currency}
      {view.category === "GAME_MONEY" && moneyUnit ? ` / 1 ${moneyUnit}` : ""}
    </>
  );
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

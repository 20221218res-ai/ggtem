import type { ReactNode } from "react";
import Link from "next/link";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getPrismaClient } from "@/lib/prisma";
import CountryText from "../country-text";

const activeOrderStatuses = [
  "REQUESTED",
  "ESCROW_LOCKED",
  "SELLER_RESPONSE_PENDING",
  "DELIVERY_IN_PROGRESS",
  "DELIVERY_COMPLETED",
  "BUYER_CONFIRM_PENDING",
] as const;

export default async function MyHomePage() {
  const user = await requirePageRole(ROLE_GROUPS.MARKET_USERS);
  const prisma = getPrismaClient();

  const [
    wallet,
    sellingCount,
    buyingCount,
    sellingActive,
    buyingActive,
    sellingDone,
    buyingDone,
    registeredListings,
    registeredBuyRequests,
    activeListings,
    activeBuyRequests,
    unreadChatMessages,
    unreadNotifications,
    pendingDepositRequests,
    pendingWithdrawalRequests,
  ] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: user.userId } }),
    prisma.order.count({ where: { sellerId: user.userId } }),
    prisma.order.count({ where: { buyerId: user.userId } }),
    prisma.order.count({
      where: { sellerId: user.userId, status: { in: [...activeOrderStatuses] } },
    }),
    prisma.order.count({
      where: { buyerId: user.userId, status: { in: [...activeOrderStatuses] } },
    }),
    prisma.order.count({ where: { sellerId: user.userId, status: "COMPLETED" } }),
    prisma.order.count({ where: { buyerId: user.userId, status: "COMPLETED" } }),
    prisma.listing.count({ where: { sellerId: user.userId } }),
    prisma.buyRequest.count({ where: { buyerId: user.userId } }),
    prisma.listing.count({ where: { sellerId: user.userId, status: "ACTIVE" } }),
    prisma.buyRequest.count({ where: { buyerId: user.userId, status: "ACTIVE" } }),
    prisma.chatMessage.count({
      where: {
        senderId: { not: user.userId },
        readAt: null,
        room: {
          OR: [{ buyerId: user.userId }, { sellerId: user.userId }],
        },
      },
    }),
    prisma.notification.count({ where: { userId: user.userId, isRead: false } }),
    prisma.depositRequest.count({ where: { userId: user.userId, status: "PENDING" } }),
    prisma.withdrawalRequest.count({
      where: {
        userId: user.userId,
        status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"] },
      },
    }),
  ]);

  const currency = wallet?.currency ?? "USDT";
  const availableBalance = wallet?.availableBalance.toString() ?? "0";
  const lockedBalance = wallet
    ? formatAmount(
        Number(wallet.escrowLockedBalance.toString()) +
          Number(wallet.buyRequestLocked.toString()) +
          Number(wallet.withdrawalLocked.toString()),
      )
    : "0";

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:block">
          <SideGroup title={<CountryText id="common.sellModeShort" />}>
            <SideLink href="/my/listings" label={<CountryText id="my.registeredItems" />} count={registeredListings} />
            <SideLink href="/my/listings?inventory=SELLING" label={<CountryText id="my.sellingActive" />} count={activeListings} />
            <SideLink href="/my/listings/orders" label={<CountryText id="my.sellingOrders" />} count={sellingActive} />
            <SideLink href="/my/listings?inventory=SOLD_OUT" label={<CountryText id="my.sellingCompleted" />} count={sellingDone} />
          </SideGroup>

          <SideGroup title={<CountryText id="common.buyModeShort" />}>
            <SideLink href="/my/buy-requests" label={<CountryText id="my.registeredItems" />} count={registeredBuyRequests} />
            <SideLink href="/my/buy-requests?status=ACTIVE" label={<CountryText id="my.buyingActive" />} count={activeBuyRequests} />
            <SideLink href="/my/orders" label={<CountryText id="my.buyingOrders" />} count={buyingActive} />
            <SideLink href="/my/orders?view=completed" label={<CountryText id="my.buyingCompleted" />} count={buyingDone} />
          </SideGroup>

          <SideGroup title={<CountryText id="common.wallet" />}>
            <SideLink href="/my/wallet?action=deposit" label={<CountryText id="common.deposit" />} />
            <SideLink href="/my/wallet?action=withdraw" label={<CountryText id="common.withdraw" />} />
            <SideLink href="/my/wallet/ledger" label={<CountryText id="my.walletLedger" />} />
          </SideGroup>

          <SideGroup title={<CountryText id="common.notifications" />}>
            <SideLink href="/my/chat" label={<CountryText id="common.chat" />} count={unreadChatMessages} />
            <SideLink href="/my/notifications" label={<CountryText id="common.notifications" />} count={unreadNotifications} />
          </SideGroup>
        </aside>

        <section className="grid gap-5">
          <section className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
            <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-2xl font-black text-[var(--gg-inverse-text)]">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-black text-[var(--gg-accent)]">MY PAGE</p>
                    <h1 className="mt-1 text-2xl font-black">{user.displayName}</h1>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <PrimaryButton href="/my/listings/new">
                    <CountryText id="common.newSellListing" />
                  </PrimaryButton>
                  <PrimaryButton href="/my/buy-requests/new">
                    <CountryText id="common.newBuyRequest" />
                  </PrimaryButton>
                </div>
              </div>

              <div className="border-t border-[var(--gg-border)] p-6 lg:border-l lg:border-t-0">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-black">
                    <CountryText id="my.balanceTitle" />
                  </h2>
                  <p className="text-3xl font-black text-[var(--gg-accent)]">
                    {availableBalance}
                    <span className="ml-1 text-base text-[var(--gg-muted)]">{currency}</span>
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <MiniButton href="/my/wallet?action=deposit">
                    <CountryText id="common.deposit" />
                  </MiniButton>
                  <MiniButton href="/my/wallet?action=withdraw">
                    <CountryText id="common.withdraw" />
                  </MiniButton>
                </div>
                <p className="mt-5 text-sm font-bold text-[var(--gg-muted)]">
                  <CountryText id="wallet.inTradeAmount" /> {lockedBalance} {currency}
                </p>
              </div>
            </div>

            <Link
              href="/my/notifications"
              className="flex items-center justify-center gap-3 bg-[var(--gg-accent)] px-5 py-4 text-sm font-black text-[var(--gg-inverse-text)]"
            >
              <CountryText id="my.pendingWalletRequests" />
              <span>
                <CountryText id="common.deposit" /> {pendingDepositRequests}
                <CountryText id="my.countSuffix" /> / <CountryText id="common.withdraw" />{" "}
                {pendingWithdrawalRequests}
                <CountryText id="my.countSuffix" />
              </span>
            </Link>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <ActionCard
              href="/my/listings"
              label={<CountryText id="my.registeredSellListings" />}
              value={<CountValue count={registeredListings} />}
            />
            <ActionCard
              href="/my/buy-requests"
              label={<CountryText id="my.registeredBuyRequests" />}
              value={<CountValue count={registeredBuyRequests} />}
            />
            <ActionCard
              href="/my/chat"
              label={<CountryText id="my.unreadChats" />}
              value={<CountValue count={unreadChatMessages} />}
            />
            <ActionCard
              href="/listings"
              label={<CountryText id="my.findTrades" />}
              value={<CountryText id="my.go" />}
            />
          </section>

          <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-sm shadow-[var(--gg-shadow)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black">
                <CountryText id="my.tradeOverview" />
              </h2>
              <Link
                href="/my/orders"
                className="rounded-full border border-[var(--gg-border)] px-4 py-2 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
              >
                <CountryText id="my.viewOrders" />
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <TradePanel
                title={<CountryText id="common.sellModeShort" />}
                total={sellingCount}
                active={sellingActive}
                done={sellingDone}
              />
              <TradePanel
                title={<CountryText id="common.buyModeShort" />}
                total={buyingCount}
                active={buyingActive}
                done={buyingDone}
              />
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function SideGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-[var(--gg-border-soft)] py-5 first:pt-0 last:border-b-0 last:pb-0">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function SideLink({ href, label, count }: { href: string; label: ReactNode; count?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between text-sm font-black text-[var(--gg-text)] hover:text-[var(--gg-accent)]"
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className={count > 0 ? "text-rose-500" : "text-slate-400"}>{count}</span>
      ) : null}
    </Link>
  );
}

function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
    >
      {children}
    </Link>
  );
}

function MiniButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
    >
      {children}
    </Link>
  );
}

function ActionCard({ href, label, value }: { href: string; label: ReactNode; value: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] hover:border-[var(--gg-accent)]"
    >
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </Link>
  );
}

function TradePanel({
  title,
  total,
  active,
  done,
}: {
  title: ReactNode;
  total: number;
  active: number;
  done: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-5">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-[var(--gg-accent)] px-4 py-2 text-sm font-black text-[var(--gg-inverse-text)]">
          {title}
        </div>
        <p className="text-sm font-bold text-[var(--gg-muted)]">
          <CountryText id="my.total" /> {total}
          <CountryText id="my.countSuffix" />
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatusBox label={<CountryText id="my.inProgress" />} count={active} tone="progress" />
        <StatusBox label={<CountryText id="my.completed" />} count={done} tone="done" />
      </div>
    </div>
  );
}

function StatusBox({
  label,
  count,
  tone,
}: {
  label: ReactNode;
  count: number;
  tone: "progress" | "done";
}) {
  const className =
    tone === "progress"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className={`rounded-xl border p-4 text-center ${className}`}>
      <p className="text-2xl font-black">{count}</p>
      <p className="mt-1 text-sm font-black">{label}</p>
    </div>
  );
}

function CountValue({ count }: { count: number }) {
  return (
    <>
      {count}
      <CountryText id="my.countSuffix" />
    </>
  );
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

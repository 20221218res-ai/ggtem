"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CountryText from "./country-text";

type MarketplaceAccountMenuProps = {
  displayName: string;
  email: string;
  unreadChatCount?: number;
  unreadNotificationCount?: number;
};

const quickActions = [
  { href: "/my/listings/new", labelId: "home.createListing", descriptionId: "common.newSellListing" },
  { href: "/my/buy-requests/new", labelId: "home.createBuyRequest", descriptionId: "common.newBuyRequest" },
  { href: "/my/wallet?action=deposit", labelId: "home.walletTopUp", descriptionId: "common.usdtTopUp" },
] as const;

const accountLinks = [
  { href: "/my", labelId: "common.myPage" },
  { href: "/my/orders", labelId: "common.myOrders" },
  { href: "/my/listings", labelId: "common.myListings" },
  { href: "/my/buy-requests", labelId: "common.myBuyRequests" },
  { href: "/my/chat", labelId: "common.chat", badgeKey: "chat" },
  { href: "/my/notifications", labelId: "common.notifications", badgeKey: "notification" },
] as const;

export default function MarketplaceAccountMenu({
  displayName,
  email,
  unreadChatCount = 0,
  unreadNotificationCount = 0,
}: MarketplaceAccountMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      setIsOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  function getBadgeCount(badgeKey?: "chat" | "notification") {
    if (badgeKey === "chat") return unreadChatCount;
    if (badgeKey === "notification") return unreadNotificationCount;
    return 0;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-2 rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-bold text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)]"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gg-accent)] text-xs font-black text-[var(--gg-inverse-text)]">
          {displayName.slice(0, 2).toUpperCase()}
        </span>
        <span className="max-w-[140px] truncate">{displayName}</span>
        {unreadChatCount + unreadNotificationCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-black text-white">
            {formatBadgeCount(unreadChatCount + unreadNotificationCount)}
          </span>
        ) : null}
        <span className="text-[var(--gg-muted)]" aria-hidden="true">
          v
        </span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(calc(100vw-2rem),340px)] overflow-hidden rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-xl shadow-[var(--gg-shadow)]"
        >
          <div className="border-b border-[var(--gg-border-soft)] px-4 py-3">
            <p className="font-black text-[var(--gg-text)]">{displayName}</p>
            <p className="mt-1 truncate text-xs text-[var(--gg-muted)]">{email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill href="/my/chat" labelId="common.chat" count={unreadChatCount} />
              <StatusPill href="/my/notifications" labelId="common.notifications" count={unreadNotificationCount} />
            </div>
          </div>

          <section className="border-b border-[var(--gg-border-soft)] p-3">
            <p className="px-1 pb-2 text-xs font-black uppercase text-[var(--gg-subtle)]">
              <CountryText id="common.quickActions" />
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {quickActions.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] px-3 py-3 text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)]"
                >
                  <span className="block">
                    <CountryText id={link.labelId} />
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[var(--gg-muted)]">
                    <CountryText id={link.descriptionId} />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid py-2">
            <p className="px-4 pb-1 pt-2 text-xs font-black uppercase text-[var(--gg-subtle)]">
              <CountryText id="common.myTrades" />
            </p>
            {accountLinks.map((link) => {
              const badgeCount = getBadgeCount("badgeKey" in link ? link.badgeKey : undefined);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-[var(--gg-muted)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-text)]"
                >
                  <span>
                    <CountryText id={link.labelId} />
                  </span>
                  {badgeCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-black text-white">
                      {formatBadgeCount(badgeCount)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </section>

          <div className="border-t border-[var(--gg-border-soft)] p-2">
            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? (
                <CountryText id="common.signingOut" />
              ) : (
                <CountryText id="common.signOut" />
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({
  href,
  labelId,
  count,
}: {
  href: string;
  labelId: "common.chat" | "common.notifications";
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-black ${
        count > 0
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : "border-[var(--gg-border)] bg-[var(--gg-control-bg)] text-[var(--gg-muted)]"
      }`}
    >
      <CountryText id={labelId} /> {formatBadgeCount(count)}
    </Link>
  );
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : count.toString();
}

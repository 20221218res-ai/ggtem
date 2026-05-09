"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import CountrySelector from "../country-selector";
import CountryText from "../country-text";
import LocalizedInput from "../localized-input";
import SignOutButton from "../sign-out-button";
import type { TranslationKey } from "../i18n";

export type MyNavigationLink = {
  href: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  groupKey: TranslationKey;
  badgeCount?: number;
};

const categoryLinks: Array<{ href: string; labelKey: TranslationKey }> = [
  { href: "/listings?category=GAME_MONEY", labelKey: "common.gameMoney" },
  { href: "/listings?category=GAME_ITEM", labelKey: "common.item" },
  { href: "/listings?category=GAME_ACCOUNT", labelKey: "common.account" },
  { href: "/listings", labelKey: "common.trade" },
];

export default function MyNavigation({
  links,
  displayName,
}: {
  links: MyNavigationLink[];
  displayName: string;
}) {
  const pathname = usePathname();
  const unreadChatCount = links.find((link) => link.href === "/my/chat")?.badgeCount ?? 0;
  const unreadNoticeCount =
    links.find((link) => link.href === "/my/notifications")?.badgeCount ?? 0;

  return (
    <header className="sticky top-0 z-40 overflow-x-clip border-b border-[var(--gg-border-soft)] bg-white/95 shadow-sm shadow-[var(--gg-shadow)] backdrop-blur">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-4 py-3 lg:px-8">
        <Link href="/" aria-label="GGtem home" className="flex shrink-0 items-center">
          <BrandLogo />
        </Link>

        <form
          action="/listings"
          className="hidden min-w-0 max-w-[560px] flex-1 items-center rounded-full border-2 border-[var(--gg-accent)] bg-white px-2 py-1 xl:flex"
        >
          <select
            name="mode"
            defaultValue="sell"
            className="h-11 rounded-full bg-transparent px-4 text-sm font-black outline-none"
          >
            <option value="sell">
              <CountryText id="common.sellModeShort" />
            </option>
            <option value="buy">
              <CountryText id="common.buyModeShort" />
            </option>
          </select>
          <LocalizedInput
            name="query"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-bold outline-none placeholder:text-slate-400"
            placeholderKey="home.headerSearchPlaceholder"
          />
          <button
            type="submit"
            className="flex h-11 w-16 items-center justify-center rounded-full text-sm font-black text-[var(--gg-accent)] hover:bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)]"
          >
            <CountryText id="home.search" />
          </button>
        </form>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <HeaderTextLink href="/my/wallet?action=deposit">
            <CountryText id="common.deposit" />
          </HeaderTextLink>
          <HeaderTextLink href="/my/wallet?action=withdraw">
            <CountryText id="common.withdraw" />
          </HeaderTextLink>
          <CountrySelector />
          <span className="hidden max-w-28 truncate text-sm font-black text-[var(--gg-text)] lg:block">
            {displayName}
          </span>
          <SignOutButton className="rounded-lg border border-[var(--gg-border)] bg-white px-3 py-2 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] disabled:cursor-not-allowed disabled:opacity-60" />
        </div>
      </div>

      <form
        action="/listings"
        className="mx-4 mb-3 flex items-center rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-2 py-1 xl:hidden"
      >
        <select
          name="mode"
          defaultValue="sell"
          className="h-10 rounded-lg bg-transparent px-2 text-sm font-black outline-none"
        >
          <option value="sell">
            <CountryText id="common.sellModeShort" />
          </option>
          <option value="buy">
            <CountryText id="common.buyModeShort" />
          </option>
        </select>
        <LocalizedInput
          name="query"
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-bold outline-none placeholder:text-slate-400"
          placeholderKey="home.mobileSearchPlaceholder"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-[var(--gg-accent)] px-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
        >
          <CountryText id="home.search" />
        </button>
      </form>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-2 px-4 pb-3 lg:px-8">
        <TopAction href="/my/listings/new" tone="sell">
          <CountryText id="home.createListing" />
        </TopAction>
        <TopAction href="/my/buy-requests/new" tone="buy">
          <CountryText id="home.createBuyRequest" />
        </TopAction>
        {categoryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-full px-3 py-2 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-accent)]"
          >
            <CountryText id={link.labelKey} />
          </Link>
        ))}

        <nav className="flex shrink-0 items-center gap-1 sm:ml-auto" aria-label="My menu">
          <NavIconLink href="/my/wallet" active={isActivePath(pathname, "/my/wallet")}>
            <CountryText id="common.wallet" />
          </NavIconLink>
          <NavIconLink
            href="/my/chat"
            active={isActivePath(pathname, "/my/chat")}
            badgeCount={unreadChatCount}
          >
            <CountryText id="common.chat" />
          </NavIconLink>
          <NavIconLink href="/my" active={pathname === "/my"}>
            <CountryText id="common.my" />
          </NavIconLink>
          {unreadNoticeCount > 0 ? (
            <NavIconLink
              href="/my/notifications"
              active={isActivePath(pathname, "/my/notifications")}
              badgeCount={unreadNoticeCount}
            >
              <CountryText id="common.notifications" />
            </NavIconLink>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function HeaderTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="hidden text-sm font-black text-[var(--gg-text)] hover:text-[var(--gg-accent)] sm:inline"
    >
      {children}
    </Link>
  );
}

function TopAction({
  href,
  tone,
  children,
}: {
  href: string;
  tone: "sell" | "buy";
  children: ReactNode;
}) {
  const className =
    tone === "sell"
      ? "bg-[var(--gg-accent)] text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
      : "border border-[var(--gg-accent)] bg-white text-[var(--gg-accent)] hover:bg-[var(--gg-control-bg)]";

  return (
    <Link href={href} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${className}`}>
      {children}
    </Link>
  );
}

function NavIconLink({
  href,
  active,
  badgeCount = 0,
  children,
}: {
  href: string;
  active: boolean;
  badgeCount?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "relative rounded-full bg-[var(--gg-accent)] px-4 py-2 text-sm font-black text-[var(--gg-inverse-text)] shadow-sm shadow-[var(--gg-shadow)]"
          : "relative rounded-full px-4 py-2 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)]"
      }
    >
      {children}
      {badgeCount > 0 ? (
        <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

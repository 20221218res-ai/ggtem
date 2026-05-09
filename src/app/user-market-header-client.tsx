"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import CountrySelector from "./country-selector";
import MarketplaceAccountMenu from "./marketplace-account-menu";
import useCountryTranslation from "./use-country-translation";
import type { TranslationKey } from "./i18n";

const categories = [
  { href: "/listings?category=GAME_MONEY", labelKey: "common.gameMoney" },
  { href: "/listings?category=GAME_ITEM", labelKey: "common.item" },
  { href: "/listings?category=GAME_ACCOUNT", labelKey: "common.account" },
  { href: "/listings", labelKey: "common.trade" },
] satisfies Array<{ href: string; labelKey: TranslationKey }>;

type UserMarketHeaderClientProps = {
  currentUser: {
    displayName: string;
    email: string;
  } | null;
  unreadChatCount: number;
  unreadNotificationCount: number;
};

export default function UserMarketHeaderClient({
  currentUser,
  unreadChatCount,
  unreadNotificationCount,
}: UserMarketHeaderClientProps) {
  const { t } = useCountryTranslation();

  return (
    <header className="sticky top-0 z-30 overflow-x-clip border-b border-[var(--gg-border-soft)] bg-white/95 shadow-sm shadow-[var(--gg-shadow)] backdrop-blur">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-4 py-2 lg:px-8">
        <Link href="/" prefetch={false} className="flex shrink-0 items-center" aria-label="GGtem home">
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
            <option value="sell">{t("common.sellModeShort")}</option>
            <option value="buy">{t("common.buyModeShort")}</option>
          </select>
          <input
            name="query"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-bold outline-none placeholder:text-slate-400"
            placeholder={t("home.headerSearchPlaceholder")}
          />
          <button
            type="submit"
            className="flex h-11 w-16 items-center justify-center rounded-full text-sm font-black text-[var(--gg-accent)] hover:bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)]"
          >
            {t("home.search")}
          </button>
        </form>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {currentUser ? (
            <>
              <QuickTextLink href="/my/wallet?action=deposit">{t("common.deposit")}</QuickTextLink>
              <QuickTextLink href="/my/wallet?action=withdraw">{t("common.withdraw")}</QuickTextLink>
            </>
          ) : (
            <>
              <QuickTextLink href="/sign-in">{t("common.signIn")}</QuickTextLink>
              <QuickTextLink href="/sign-up">{t("common.signUp")}</QuickTextLink>
            </>
          )}
          <CountrySelector />
          {currentUser ? (
            <MarketplaceAccountMenu
              displayName={currentUser.displayName}
              email={currentUser.email}
              unreadChatCount={unreadChatCount}
              unreadNotificationCount={unreadNotificationCount}
            />
          ) : null}
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
          <option value="sell">{t("common.sellModeShort")}</option>
          <option value="buy">{t("common.buyModeShort")}</option>
        </select>
        <input
          name="query"
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-bold outline-none placeholder:text-slate-400"
          placeholder={t("home.mobileSearchPlaceholder")}
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-[var(--gg-accent)] px-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
        >
          {t("home.search")}
        </button>
      </form>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-2 px-4 pb-3 lg:px-8">
        <HeaderAction href="/my/listings/new" tone="sell">
          {t("home.createListing")}
        </HeaderAction>
        <HeaderAction href="/my/buy-requests/new" tone="buy">
          {t("home.createBuyRequest")}
        </HeaderAction>
        {categories.map((category) => (
          <Link
            key={category.href}
            href={category.href}
            prefetch={false}
            className="shrink-0 rounded-full px-3 py-2 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-accent)]"
          >
            {t(category.labelKey)}
          </Link>
        ))}
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <TextIconLink href="/my/wallet" label={t("common.wallet")} />
          <TextIconLink href="/my/chat" label={t("common.chat")} badge={unreadChatCount} />
          <TextIconLink href="/my" label={t("common.my")} badge={unreadNotificationCount} />
        </div>
      </div>
    </header>
  );
}

function QuickTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="hidden text-sm font-black text-[var(--gg-text)] hover:text-[var(--gg-accent)] sm:inline"
    >
      {children}
    </Link>
  );
}

function HeaderAction({
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
    <Link
      href={href}
      prefetch={false}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${className}`}
    >
      {children}
    </Link>
  );
}

function TextIconLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="relative flex h-10 min-w-10 items-center justify-center rounded-full border border-[var(--gg-border)] px-3 text-xs font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
    >
      {label}
      {badge ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

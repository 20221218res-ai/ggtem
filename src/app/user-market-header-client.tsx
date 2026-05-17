"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/brand-logo";
import CountrySelector from "./country-selector";
import MarketplaceAccountMenu from "./marketplace-account-menu";
import SignOutButton from "./sign-out-button";
import useCountryTranslation from "./use-country-translation";
import type { TranslationKey } from "./i18n";
import {
  getDefaultHeaderCounts,
  loadHeaderCounts,
  type HeaderCounts,
} from "./header-counts-client";

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
};

export default function UserMarketHeaderClient({
  currentUser,
}: UserMarketHeaderClientProps) {
  const { t } = useCountryTranslation();
  const [counts, setCounts] = useState<HeaderCounts>(() => getDefaultHeaderCounts());

  useEffect(() => {
    if (!currentUser) {
      setCounts(getDefaultHeaderCounts());
      return;
    }

    let isActive = true;
    const userEmail = currentUser.email;

    async function refreshHeaderCounts() {
      const data = await loadHeaderCounts(userEmail);

      if (isActive) {
        setCounts(data);
      }
    }

    void refreshHeaderCounts();

    return () => {
      isActive = false;
    };
  }, [currentUser]);

  return (
    <header className="relative z-30 overflow-x-clip border-b border-[var(--gg-border-soft)] bg-white/95 shadow-sm shadow-[var(--gg-shadow)] backdrop-blur lg:sticky lg:top-0">
      <div className="mx-auto flex max-w-[1360px] items-center gap-2 px-4 py-2 sm:gap-3 lg:gap-4 lg:px-8">
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

        <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <QuickTextLink href="/download">
            {t("pwaInstall.installButton")}
          </QuickTextLink>
          {currentUser ? (
            <>
              <QuickTextLink href="/my/wallet?action=deposit" tone="primary" className="hidden sm:inline-flex">
                {t("common.deposit")}
              </QuickTextLink>
              <QuickTextLink href="/my/wallet?action=withdraw" className="hidden sm:inline-flex">
                {t("common.withdraw")}
              </QuickTextLink>
            </>
          ) : (
            null
          )}
          <div className="hidden sm:block">
            <CountrySelector />
          </div>
          {currentUser ? (
            <>
              <SignOutButton
                redirectTo="/"
                className="hidden h-9 items-center justify-center rounded-full border border-red-200 bg-white px-3 text-xs font-black text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <MarketplaceAccountMenu
                displayName={currentUser.displayName}
                email={currentUser.email}
                unreadChatCount={counts.unreadChatCount}
                unreadNotificationCount={counts.unreadNotificationCount}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="mx-4 mb-2 overflow-x-auto sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CountrySelector />
      </div>

      <form
        action="/listings"
        className="mx-4 mb-2 flex items-center rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-2 py-1 sm:mb-3 xl:hidden"
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

      <div className="mx-auto flex max-w-[1360px] items-center gap-2 overflow-x-auto whitespace-nowrap px-4 pb-3 pt-1 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            className="shrink-0 rounded-full px-3 py-2 text-xs font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-accent)] sm:text-sm"
          >
            {t(category.labelKey)}
          </Link>
        ))}
        <Link
          href="/support"
          prefetch={false}
          className="shrink-0 rounded-full px-3 py-2 text-xs font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)] hover:text-[var(--gg-accent)] sm:text-sm"
        >
          {t("common.customerCenter")}
        </Link>
        <Link
          href="/download"
          prefetch={false}
          className="hidden shrink-0 rounded-full px-3 py-2 text-sm font-black text-[var(--gg-accent)] hover:bg-[var(--gg-control-bg)] sm:inline-flex"
        >
          {t("pwaInstall.installButton")}
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          {currentUser ? (
            <>
              <HeaderBalancePill
                balance={counts.walletAvailableBalance}
                currency={counts.walletCurrency}
              />
              <TextIconLink
                href="/my/wallet"
                label={t("common.wallet")}
                subLabel={`${formatHeaderBalance(counts.walletAvailableBalance)} ${counts.walletCurrency}`}
              />
              <TextIconLink href="/my/chat" label={t("common.chat")} badge={counts.unreadChatCount} />
              <TextIconLink href="/my" label={t("common.my")} badge={counts.unreadNotificationCount} />
            </>
          ) : (
            <>
              <TextIconLink href="/sign-in" label={t("common.signIn")} />
              <TextIconLink href="/sign-up" label={t("common.signUp")} tone="primary" />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function QuickTextLink({
  href,
  children,
  tone = "default",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: "default" | "primary";
  className?: string;
}) {
  const toneClassName =
    tone === "primary"
      ? "border-[var(--gg-accent)] bg-[var(--gg-accent)] text-[var(--gg-inverse-text)] shadow-md shadow-[color-mix(in_srgb,var(--gg-accent)_28%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--gg-accent)_18%,white)] hover:bg-[var(--gg-accent-hover)]"
      : "border-[color-mix(in_srgb,var(--gg-accent)_34%,var(--gg-border))] bg-white text-[var(--gg-accent)] shadow-sm hover:border-[var(--gg-accent)] hover:bg-[color-mix(in_srgb,var(--gg-accent)_8%,white)]";
  const displayClassName = className?.includes("hidden") ? "" : "inline-flex";

  return (
    <Link
      href={href}
      prefetch={false}
      className={`${displayClassName} h-9 items-center justify-center rounded-xl border px-3 text-xs font-black transition sm:h-10 sm:px-4 ${toneClassName} ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

function HeaderBalancePill({
  balance,
  currency,
}: {
  balance: string;
  currency: string;
}) {
  return (
    <Link
      href="/my/wallet"
      prefetch={false}
      className="hidden min-h-10 flex-col justify-center rounded-2xl border border-[color-mix(in_srgb,var(--gg-accent)_28%,var(--gg-border))] bg-[color-mix(in_srgb,var(--gg-accent)_7%,white)] px-4 text-xs font-black text-[var(--gg-text)] shadow-sm hover:border-[var(--gg-accent)] hover:bg-white md:flex"
    >
      <span className="text-[10px] text-[var(--gg-muted)]">보유 잔액</span>
      <span className="mt-0.5 text-[var(--gg-accent)]">
        {formatHeaderBalance(balance)} {currency}
      </span>
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
      className={`shrink-0 rounded-full px-3 py-2 text-xs font-black sm:px-4 sm:text-sm ${className}`}
    >
      {children}
    </Link>
  );
}

function TextIconLink({
  href,
  label,
  subLabel,
  badge,
  tone = "default",
}: {
  href: string;
  label: string;
  subLabel?: string;
  badge?: number;
  tone?: "default" | "primary";
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`relative flex min-h-10 min-w-10 flex-col items-center justify-center rounded-full border px-3 py-1 text-xs font-black leading-none ${
        tone === "primary"
          ? "border-[var(--gg-accent)] bg-[var(--gg-accent)] text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
          : "border-[var(--gg-border)] text-[var(--gg-text)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
      }`}
    >
      <span>{label}</span>
      {subLabel ? (
        <span className="mt-1 whitespace-nowrap text-[10px] font-black text-[var(--gg-accent)]">
          {subLabel}
        </span>
      ) : null}
      {badge ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function formatHeaderBalance(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  return numericValue.toLocaleString("en-US", {
    maximumFractionDigits: numericValue >= 100 ? 2 : 4,
  });
}


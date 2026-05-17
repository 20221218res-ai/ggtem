import Link from "next/link";
import type {
  MarketplaceListingSummary,
  MarketplaceListingsView,
} from "@/lib/market/listings";
import BrandLogo from "@/components/brand-logo";
import CountryText from "./country-text";
import type { TranslationKey } from "./i18n";
import LocalizedInput from "./localized-input";
import UserContentText, { SourceCountryFlag } from "./user-content-text";
import UserMarketHeader from "./user-market-header";
import GameNameText from "./game-name-text";
import { GameMoneyPriceUnitText, GameMoneyQuantityText } from "./game-money-unit-text";
import OptimizedGameImage from "@/components/optimized-game-image";
import type { GameCatalogOption } from "@/lib/market/game-localization";

type MarketplaceHomeProps = MarketplaceListingsView;

const categoryLinks = [
  {
    labelKey: "common.gameMoney",
    href: "/listings?category=GAME_MONEY",
  },
  {
    labelKey: "common.item",
    href: "/listings?category=GAME_ITEM",
  },
  {
    labelKey: "common.account",
    href: "/listings?category=GAME_ACCOUNT",
  },
] satisfies Array<{
  labelKey: TranslationKey;
  href: string;
}>;

export function MarketplaceHome({
  listings,
  filterOptions,
}: MarketplaceHomeProps) {
  const featuredListings = listings.slice(0, 6);
  const liveListings = listings.slice(0, 5);
  const games = buildGameCards(listings, filterOptions.gameOptions ?? []);

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] text-[var(--gg-text)] transition-colors">
      <MarketplaceHeader />

      <section className="mx-auto grid max-w-[1360px] gap-5 px-4 py-4 sm:gap-6 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
        <section className="grid gap-4 xl:grid-cols-[1fr_360px] xl:gap-6">
          <HeroSearch games={filterOptions.gameOptions ?? []} />
          <LiveTradeBoard listings={liveListings} />
        </section>

        <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {categoryLinks.map((category) => (
            <Link
              key={category.href}
              href={category.href}
              prefetch={false}
              className="group rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--gg-accent)] sm:rounded-2xl sm:p-5"
            >
              <p className="text-xs font-bold text-[var(--gg-accent)]">
                <CountryText id="home.quickLink" />
              </p>
              <div className="mt-2 flex items-center justify-between gap-3 sm:mt-3 sm:gap-4">
                <h2 className="text-xl font-black sm:text-2xl">
                  <CountryText id={category.labelKey} />
                </h2>
                <span className="rounded-full bg-[var(--gg-card-soft-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)] group-hover:bg-[var(--gg-accent)] group-hover:text-[var(--gg-inverse-text)]">
                  <CountryText id="home.viewNow" />
                </span>
              </div>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[300px_1fr] xl:gap-6">
          <GameIndex games={games} />
          <FeaturedListings listings={featuredListings} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <HomeAction href="/listings?mode=sell" titleKey="home.viewSellListings" labelKey="common.sellModeShort" />
          <HomeAction href="/listings?mode=buy" titleKey="home.viewBuyRequests" labelKey="common.buyModeShort" />
          <HomeAction href="/my/listings/new" titleKey="home.startSelling" labelKey="home.createListing" />
          <HomeAction href="/my/buy-requests/new" titleKey="home.startBuying" labelKey="home.createBuyRequest" />
        </section>
      </section>
    </main>
  );
}

export async function MarketplaceHeader() {
  return <UserMarketHeader />;
}

function HeroSearch({ games }: { games: GameCatalogOption[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-md shadow-[var(--gg-shadow)] sm:rounded-2xl sm:shadow-xl">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--gg-accent)] px-3 py-1 text-xs font-black text-[var(--gg-inverse-text)]">
            <CountryText id="home.globalMarketLabel" />
          </span>
          <span className="hidden rounded-full border border-[var(--gg-border)] px-3 py-1 text-xs font-bold text-[var(--gg-muted)] sm:inline-flex">
            <CountryText id="home.safeTradeBadge" />
          </span>
        </div>

        <h1 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:mt-6 sm:text-4xl lg:text-6xl">
          <CountryText id="home.heroTitleA" />
          <br />
          <BrandLogo size="lg" className="mt-2 align-middle sm:mt-3" />
        </h1>
        <div className="mt-4 flex gap-2 overflow-x-auto whitespace-nowrap sm:mt-5 sm:flex-wrap sm:overflow-visible sm:whitespace-normal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <HeroChip labelKey="home.escrowChip" />
          <HeroChip labelKey="home.orderChatChip" />
          <HeroChip labelKey="home.usdtTopUpChip" />
          <HeroChip labelKey="home.disputeSupportChip" />
        </div>

        <form
          action="/listings"
          className="mt-5 grid gap-2 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-2 sm:mt-8 sm:gap-3 sm:rounded-2xl sm:p-3 md:grid-cols-[180px_1fr_150px_auto]"
        >
          <input type="hidden" name="mode" value="sell" />
          <select
            name="game"
            className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2.5 text-sm font-bold outline-none sm:rounded-xl sm:px-4 sm:py-3"
            defaultValue=""
          >
            <option value="">
              <CountryText id="home.allGames" />
            </option>
            {games.map((game) => (
              <option key={game.name} value={game.name}>
                {game.localizedNames.KR || game.name}
              </option>
            ))}
          </select>
          <LocalizedInput
            name="query"
            placeholderKey="home.searchPlaceholder"
            className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2.5 text-sm font-semibold outline-none placeholder:text-[var(--gg-subtle)] sm:rounded-xl sm:px-4 sm:py-3"
          />
          <select
            name="category"
            defaultValue="GAME_MONEY"
            className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2.5 text-sm font-bold outline-none sm:rounded-xl sm:px-4 sm:py-3"
          >
            <option value="GAME_MONEY">
              <CountryText id="common.gameMoney" />
            </option>
            <option value="GAME_ITEM">
              <CountryText id="common.item" />
            </option>
            <option value="GAME_ACCOUNT">
              <CountryText id="common.account" />
            </option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-[var(--gg-accent)] px-5 py-2.5 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] sm:rounded-xl sm:px-6 sm:py-3"
          >
            <CountryText id="home.search" />
          </button>
        </form>

        <div className="mt-4 flex gap-2 overflow-x-auto whitespace-nowrap sm:mt-6 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:whitespace-normal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <HomeButton href="/listings">
            <CountryText id="home.browseListings" />
          </HomeButton>
          <OutlineButton href="/my/listings/new">
            <CountryText id="home.createListing" />
          </OutlineButton>
          <OutlineButton href="/my/buy-requests/new">
            <CountryText id="home.createBuyRequest" />
          </OutlineButton>
          <OutlineButton href="/my/wallet?action=deposit">
            <CountryText id="home.walletTopUp" />
          </OutlineButton>
        </div>
      </div>
    </section>
  );
}

function HeroChip({ labelKey }: { labelKey: TranslationKey }) {
  return (
    <span className="shrink-0 rounded-full border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] px-3 py-1.5 text-xs font-black text-[var(--gg-muted)] sm:px-4 sm:py-2 sm:text-sm">
      <CountryText id={labelKey} />
    </span>
  );
}

function HomeButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="shrink-0 rounded-lg bg-[var(--gg-accent)] px-4 py-2.5 text-xs font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm"
    >
      {children}
    </Link>
  );
}

function OutlineButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="shrink-0 rounded-lg border border-[var(--gg-border)] px-4 py-2.5 text-xs font-bold hover:bg-[var(--gg-control-bg)] sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm"
    >
      {children}
    </Link>
  );
}

function HomeAction({
  href,
  titleKey,
  labelKey,
}: {
  href: string;
  titleKey: TranslationKey;
  labelKey: TranslationKey;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--gg-accent)] sm:rounded-2xl sm:p-5"
    >
      <p className="text-xs font-black text-[var(--gg-muted)] sm:text-sm">
        <CountryText id={titleKey} />
      </p>
      <p className="mt-1 text-xl font-black text-[var(--gg-text)] sm:mt-2 sm:text-2xl">
        <CountryText id={labelKey} />
      </p>
    </Link>
  );
}

function LiveTradeBoard({ listings }: { listings: MarketplaceListingSummary[] }) {
  return (
    <aside className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">
            <CountryText id="home.liveBoardLabel" />
          </p>
          <h2 className="mt-1 text-2xl font-black">
            <CountryText id="home.liveBoard" />
          </h2>
        </div>
        <span className="h-3 w-3 rounded-full bg-[var(--gg-accent)]" />
      </div>

      <div className="mt-5 grid gap-3">
        {listings.map((listing, index) => {
          const price = getListingDisplayPrice(listing);

          return (
            <Link
              key={listing.listingId}
              href={`/listings/${listing.listingId}`}
              prefetch={false}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4 hover:border-[var(--gg-accent)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black">
                  <GameNameText name={listing.gameName} localizedNames={listing.gameLocalizedNames} />
                </p>
                <span className="text-xs text-[var(--gg-subtle)]">
                  {index === 0 ? (
                    <CountryText id="home.justNow" />
                  ) : (
                    <>
                      {index * 6 + 3}
                      <CountryText id="home.minutesAgoSuffix" />
                    </>
                  )}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm text-[var(--gg-muted)]">
                <UserContentText text={listing.title} />
              </p>
              <p className="mt-2 text-sm font-black text-[var(--gg-accent)]">
                {price.amount} {listing.currency}
                {listing.category === "GAME_MONEY" ? (
                  <span className="text-xs font-bold text-[var(--gg-muted)]">
                    {" / "}
                    <GameMoneyPriceUnitText
                      priceUnitQuantity={listing.priceUnitQuantity}
                      moneyUnitName={listing.moneyUnitName}
                    />
                  </span>
                ) : null}
              </p>
            </Link>
          );
        })}
        {listings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--gg-border)] p-5 text-sm text-[var(--gg-muted)]">
            <CountryText id="common.emptyListings" />
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function GameIndex({
  games,
}: {
  games: Array<GameCatalogOption & { count: string }>;
}) {
  return (
    <aside className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5">
      <p className="text-sm font-black text-[var(--gg-accent)]">
        <CountryText id="home.gameIndexLabel" />
      </p>
      <h2 className="mt-2 text-2xl font-black">
        <CountryText id="home.popularGames" />
      </h2>
      <div className="mt-5 grid gap-3">
        {games.map((game) => (
          <Link
            key={game.name}
            href={`/listings?game=${encodeURIComponent(game.name)}`}
            prefetch={false}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-3 hover:border-[var(--gg-accent)]"
          >
            <div className="flex items-center gap-3">
              <OptimizedGameImage
                src={game.imageUrl ?? `/api/game-card/${game.code}`}
                alt={game.name}
                width={48}
                height={48}
                sizes="48px"
                className="h-12 w-12 rounded-lg border border-[var(--gg-border)] object-cover"
              />
              <div>
                <p className="text-sm font-black">
                  <GameNameText name={game.name} localizedNames={game.localizedNames} />
                </p>
                <p className="text-xs text-[var(--gg-muted)]">{game.region}</p>
              </div>
            </div>
            <span className="text-xs font-black text-[var(--gg-accent)]">
              {game.count}
              <CountryText id="home.countSuffix" />
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}

function FeaturedListings({
  listings,
}: {
  listings: MarketplaceListingSummary[];
}) {
  return (
    <section className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] sm:rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--gg-border-soft)] px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <p className="text-xs font-black text-[var(--gg-accent)] sm:text-sm">
            <CountryText id="home.marketFeedLabel" />
          </p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">
            <CountryText id="home.marketFeed" />
          </h2>
        </div>
        <Link
          href="/listings"
          prefetch={false}
          className="shrink-0 rounded-lg border border-[var(--gg-border)] px-3 py-2 text-xs font-bold hover:bg-[var(--gg-control-bg)] sm:px-4 sm:text-sm"
        >
          <CountryText id="common.viewAll" />
        </Link>
      </div>

      <div className="grid gap-3 p-3 sm:gap-4 sm:p-5 md:grid-cols-2">
        {listings.map((listing) => (
          <ListingCard key={listing.listingId} listing={listing} />
        ))}
        {listings.length === 0 ? <EmptyListingNotice /> : null}
      </div>
    </section>
  );
}

export function ListingCard({ listing }: { listing: MarketplaceListingSummary }) {
  const price = getListingDisplayPrice(listing);

  return (
    <Link
      href={`/listings/${listing.listingId}`}
      prefetch={false}
      className="block rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-3 hover:border-[var(--gg-accent)] sm:rounded-2xl sm:p-4"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <span className="rounded-md bg-[var(--gg-control-bg)] px-2 py-1 text-[11px] font-bold text-[var(--gg-muted)] sm:text-xs">
            <GameNameText name={listing.gameName} localizedNames={listing.gameLocalizedNames} />
          </span>
          <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-[11px] font-bold text-[var(--gg-accent)] sm:text-xs">
            <CategoryName category={listing.category} />
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-black leading-snug sm:mt-3">
          <UserContentText text={listing.title} />
        </h3>
        <p className="mt-1.5 line-clamp-1 text-xs text-[var(--gg-muted)] sm:mt-2 sm:text-sm">
          <SourceCountryFlag text={listing.title} />{" "}
          {listing.serverName ?? <CountryText id="home.allServers" />} ·{" "}
          <CountryText id="home.seller" /> {listing.sellerName}
        </p>
        <div className="mt-3 grid gap-3 sm:mt-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--gg-subtle)]">
              <CountryText id="home.unitPrice" />
            </p>
            <p className="mt-0.5 text-xl font-black leading-tight text-[var(--gg-accent)] sm:text-2xl md:text-xl">
              {price.amount} {listing.currency}
            </p>
            {listing.category === "GAME_MONEY" ? (
              <p className="mt-1 text-xs font-bold leading-snug text-[var(--gg-muted)]">
                <GameMoneyPriceUnitText
                  priceUnitQuantity={listing.priceUnitQuantity}
                  moneyUnitName={listing.moneyUnitName}
                />{" "}
                <CountryText id="listingDetail.unitBasisSuffix" />
              </p>
            ) : null}
            {price.unitLabel ? (
              <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">
                {price.unitLabel} 기준
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-[var(--gg-border)] bg-white/60 px-3 py-2 text-xs font-bold text-[var(--gg-muted)] sm:text-right">
            <span className="mr-1 text-[var(--gg-subtle)]">
              <CountryText id="home.stock" />
            </span>
            <span className="text-[var(--gg-text)]">{formatLiveListingQuantity(listing)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatLiveListingQuantity(listing: MarketplaceListingSummary) {
  if (listing.category === "GAME_MONEY") {
    return (
      <GameMoneyQuantityText
        quantity={listing.availableQuantity}
        priceUnitQuantity={listing.priceUnitQuantity}
        moneyUnitName={listing.moneyUnitName}
      />
    );
  }

  return listing.availableQuantity;
}

function CategoryName({ category }: { category: string }) {
  if (category === "GAME_ITEM") {
    return <CountryText id="common.item" />;
  }

  if (category === "GAME_ACCOUNT") {
    return <CountryText id="common.account" />;
  }

  return <CountryText id="common.gameMoney" />;
}

function getListingDisplayPrice(listing: MarketplaceListingSummary) {
  if (listing.category !== "GAME_MONEY") {
    return {
      amount: listing.unitPrice,
      unitLabel: null,
    };
  }

  const unitQuantity = Number(listing.priceUnitQuantity || "1");
  const unitPrice = Number(listing.unitPrice || "0");

  return {
    amount: formatDisplayNumber(unitPrice * unitQuantity),
    unitLabel: null,
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

function EmptyListingNotice() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-8 text-center text-sm text-[var(--gg-muted)] md:col-span-2">
      <CountryText id="common.emptyListings" />
    </div>
  );
}

function buildGameCards(
  listings: MarketplaceListingSummary[],
  games: GameCatalogOption[],
) {
  const counts = new Map<string, number>();

  for (const listing of listings) {
    counts.set(listing.gameName, (counts.get(listing.gameName) ?? 0) + 1);
  }

  const byName = new Map<string, GameCatalogOption>();

  for (const game of games) {
    if (!byName.has(game.name)) {
      byName.set(game.name, game);
    }
  }

  return Array.from(byName.values()).slice(0, 8).map((game) => {
    return {
      ...game,
      count: (counts.get(game.name) ?? 0).toLocaleString(),
    };
  });
}

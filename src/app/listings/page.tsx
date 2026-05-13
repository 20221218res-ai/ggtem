import Link from "next/link";
import OptimizedGameImage from "@/components/optimized-game-image";
import type { MarketplaceListingSummary } from "@/lib/market/listings";
import {
  getMarketplaceGameDirectory,
  getMarketplaceListings,
} from "@/lib/market/listings";
import { MarketplaceHeader } from "../marketplace-home";
import type { MarketplaceBuyRequestSummary } from "@/lib/market/buy-requests";
import { getMarketplaceBuyRequests } from "@/lib/market/buy-requests";
import BuyRequestOfferForm from "./buy-request-offer-form";
import CountryText from "../country-text";
import LocalizedInput from "../localized-input";
import UserContentText, { SourceCountryFlag } from "../user-content-text";
import type { TranslationKey } from "../i18n";
import GameNameText from "../game-name-text";
import type { GameCatalogOption, LocalizedGameNames } from "@/lib/market/game-localization";
import {
  getGameMoneyPriceUnitLabel,
  getTradeUnitLabel,
  normalizeGameMoneyPriceUnit,
} from "@/lib/market/trade-unit";
import {
  accountTransferTypeOptions,
  normalizeAccountTransferType,
} from "@/lib/market/account-transfer-types";
import { getServerDetailOptionsForGameCode } from "@/lib/market/server-detail-options";

export const dynamic = "force-dynamic";

type ListingsPageProps = {
  searchParams?: Promise<{
    category?: string;
    mode?: string;
    game?: string;
    gameSearch?: string;
    query?: string;
    sort?: string;
    server?: string;
    serverDetail?: string;
    minPrice?: string;
    maxPrice?: string;
    accountType?: string;
  }>;
};

type MarketFeedItem =
  | { type: "listing"; item: MarketplaceListingSummary }
  | { type: "buyRequest"; item: MarketplaceBuyRequestSummary };

type ListingSectionTone = "lowest" | "premium" | "regular";

type GameCard = {
  name: string;
  code: string;
  region: string;
  imageUrl: string | null;
  localizedNames: LocalizedGameNames;
  sellCount: number;
  buyCount: number;
};

const categoryTabs = [
  { labelKey: "common.gameMoney", value: "GAME_MONEY" },
  { labelKey: "common.item", value: "GAME_ITEM" },
  { labelKey: "common.account", value: "GAME_ACCOUNT" },
] satisfies Array<{ labelKey: TranslationKey; value: string }>;

const tradeModeTabs = [
  { labelKey: "listings.sellMode", value: "sell" },
  { labelKey: "listings.buyMode", value: "buy" },
] satisfies Array<{ labelKey: TranslationKey; value: string }>;

const pricePresets = [
  { label: "~10 USDT", minPrice: "", maxPrice: "10" },
  { label: "~50 USDT", minPrice: "", maxPrice: "50" },
  { label: "~100 USDT", minPrice: "", maxPrice: "100" },
  { label: "~500 USDT", minPrice: "", maxPrice: "500" },
];

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const hasCategoryFilter = Boolean(resolvedSearchParams?.category);
  const selectedCategory = resolvedSearchParams?.category || "GAME_MONEY";
  const selectedMode = resolvedSearchParams?.mode === "buy" ? "buy" : "sell";
  const selectedGame = resolvedSearchParams?.game?.trim() ?? "";
  const gameSearch = resolvedSearchParams?.gameSearch?.trim() ?? "";
  const query = resolvedSearchParams?.query?.trim() ?? "";
  const selectedServer = resolvedSearchParams?.server?.trim() ?? "";
  const selectedServerDetail = resolvedSearchParams?.serverDetail?.trim() ?? "";
  const minPrice = resolvedSearchParams?.minPrice?.trim() ?? "";
  const maxPrice = resolvedSearchParams?.maxPrice?.trim() ?? "";
  const selectedAccountType =
    normalizeAccountTransferType(resolvedSearchParams?.accountType) ?? "";
  const shouldShowResults = Boolean(selectedGame || query);
  const buyRequestCategoryFilter =
    selectedMode === "buy" && !hasCategoryFilter ? "" : selectedCategory;

  const view = shouldShowResults
    ? selectedMode === "buy"
      ? await getMarketplaceBuyRequests({
          category: buyRequestCategoryFilter,
          game: selectedGame,
          query: resolvedSearchParams?.query,
          server: selectedServer || undefined,
          serverDetail: selectedServerDetail || undefined,
          sort: resolvedSearchParams?.sort,
          accountTransferType: selectedAccountType || undefined,
          includeCategories: false,
        })
      : await getMarketplaceListings({
          category: selectedCategory,
          game: selectedGame,
          query: resolvedSearchParams?.query,
          server: selectedServer || undefined,
          serverDetail: selectedServerDetail || undefined,
          sort: resolvedSearchParams?.sort,
          accountTransferType: selectedAccountType || undefined,
          includeCategories: false,
          includeSellerReviewSummaries: false,
        })
    : null;
  const directory = shouldShowResults
    ? null
    : await getMarketplaceGameDirectory({
        category: selectedCategory,
      });
  const canonicalSelectedGame = view?.appliedFilters.game || selectedGame;

  const viewItems = view ? getMarketItems(view) : [];
  const gameCards = shouldShowResults
    ? []
    : buildGameCardsFromDirectory(directory?.games ?? [], selectedMode, gameSearch);
  const visibleItems = view
    ? filterMarketItemsByServerAndPrice(
        viewItems,
        selectedServer,
        selectedServerDetail,
        minPrice,
        maxPrice,
        selectedAccountType,
      )
    : [];

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] text-[var(--gg-text)] transition-colors">
      <MarketplaceHeader />

      <section className="mx-auto grid max-w-[1360px] gap-6 px-5 py-6 lg:px-8">
        <MarketCategoryHeader
          selectedCategory={selectedCategory}
          selectedMode={selectedMode}
          selectedGame={canonicalSelectedGame}
        />
        <TradeModeSelector
          selectedCategory={selectedCategory}
          selectedMode={selectedMode}
          selectedGame={canonicalSelectedGame}
        />

        {shouldShowResults ? (
          <>
            {selectedGame ? (
              <ServerPriceSelector
                selectedCategory={selectedCategory}
                selectedMode={selectedMode}
                selectedGame={canonicalSelectedGame}
                selectedServer={selectedServer}
                selectedServerDetail={selectedServerDetail}
                serverOptions={view?.filterOptions.serverOptions ?? []}
                serverDetailOptions={getServerDetailOptionsForGameCode(
                  view?.filterOptions.gameOptions.find((game) => game.name === canonicalSelectedGame)?.code,
                )}
                minPrice={minPrice}
                maxPrice={maxPrice}
                selectedAccountType={selectedAccountType}
              />
            ) : null}
            <GameListingView
              items={visibleItems}
              selectedCategory={selectedCategory}
              selectedMode={selectedMode}
              selectedGame={canonicalSelectedGame}
              query={query}
              selectedServer={selectedServer}
              selectedServerDetail={selectedServerDetail}
              minPrice={minPrice}
              maxPrice={maxPrice}
              selectedAccountType={selectedAccountType}
            />
          </>
        ) : (
          <GameCardSelector
            games={gameCards}
            selectedCategory={selectedCategory}
            selectedMode={selectedMode}
            gameSearch={gameSearch}
          />
        )}
      </section>
    </main>
  );
}

function ServerPriceSelector({
  selectedCategory,
  selectedMode,
  selectedGame,
  selectedServer,
  selectedServerDetail,
  serverOptions,
  serverDetailOptions,
  minPrice,
  maxPrice,
  selectedAccountType,
}: {
  selectedCategory: string;
  selectedMode: string;
  selectedGame: string;
  selectedServer: string;
  selectedServerDetail: string;
  serverOptions: string[];
  serverDetailOptions: string[];
  minPrice: string;
  maxPrice: string;
  selectedAccountType: string;
}) {
  const servers = Array.from(
    new Set([
      ...serverOptions,
      ...(selectedServer && !serverOptions.includes(selectedServer)
        ? [selectedServer]
        : []),
    ]),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)]">
      <FilterRow label={<CountryText id="listings.server" />}>
        <div className="flex flex-wrap gap-3">
          {[
            { key: "__all__", label: <CountryText id="listings.all" />, value: "" },
            ...servers.map((server) => ({ key: server, label: server, value: server })),
          ].map((server) => {
            const active = selectedServer === server.value;

            return (
              <Link
                key={server.key}
                href={buildListingFilterHref({
                  selectedCategory,
                  selectedMode,
                  selectedGame,
                  server: server.value,
                  serverDetail: "",
                  minPrice,
                  maxPrice,
                  accountType: selectedAccountType,
                })}
                className={active ? filterActiveClass : filterIdleClass}
              >
                {server.label}
              </Link>
            );
          })}
        </div>
      </FilterRow>

      {serverDetailOptions.length > 0 ? (
        <FilterRow label="서버 상세">
          <div className="flex flex-wrap gap-3">
            {[
              { key: "__all__", label: <CountryText id="listings.all" />, value: "" },
              ...serverDetailOptions.map((detail) => ({ key: detail, label: detail, value: detail })),
            ].map((detail) => {
              const active = selectedServerDetail === detail.value;

              return (
                <Link
                  key={detail.key}
                  href={buildListingFilterHref({
                    selectedCategory,
                    selectedMode,
                    selectedGame,
                    server: selectedServer,
                    serverDetail: detail.value,
                    minPrice,
                    maxPrice,
                    accountType: selectedAccountType,
                  })}
                  className={active ? filterActiveClass : filterIdleClass}
                >
                  {detail.label}
                </Link>
              );
            })}
          </div>
        </FilterRow>
      ) : null}

      {selectedCategory === "GAME_ACCOUNT" ? (
        <FilterRow label={<CountryText id="listings.accountType" />}>
          <div className="flex flex-wrap gap-3">
            {[
              { value: "", label: <CountryText key="all" id="listings.all" /> },
              ...accountTransferTypeOptions.map((option) => ({
                value: option.value,
                label: <AccountTransferTypeText key={option.value} value={option.value} />,
              })),
            ].map((option) => {
              const active = selectedAccountType === option.value;

              return (
                <Link
                  key={option.value || "ALL"}
                  href={buildListingFilterHref({
                    selectedCategory,
                    selectedMode,
                  selectedGame,
                  server: selectedServer,
                  serverDetail: selectedServerDetail,
                  minPrice,
                  maxPrice,
                    accountType: option.value,
                  })}
                  className={active ? filterActiveClass : filterIdleClass}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </FilterRow>
      ) : null}

      <FilterRow label={<CountryText id="listings.price" />}>
        <form action="/listings" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="category" value={selectedCategory} />
          <input type="hidden" name="mode" value={selectedMode} />
          <input type="hidden" name="game" value={selectedGame} />
          <input type="hidden" name="server" value={selectedServer} />
          <input type="hidden" name="serverDetail" value={selectedServerDetail} />
          <input type="hidden" name="accountType" value={selectedAccountType} />
          <LocalizedInput
            name="minPrice"
            defaultValue={minPrice}
            placeholderKey="listings.minPricePlaceholder"
            className="h-12 w-44 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 text-sm font-semibold outline-none placeholder:text-[var(--gg-subtle)]"
          />
          <span className="font-black">USDT ~</span>
          <LocalizedInput
            name="maxPrice"
            defaultValue={maxPrice}
            placeholderKey="listings.maxPricePlaceholder"
            className="h-12 w-44 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 text-sm font-semibold outline-none placeholder:text-[var(--gg-subtle)]"
          />
          <span className="font-black">USDT</span>
          {pricePresets.map((preset) => (
            <Link
              key={preset.label}
              href={buildListingFilterHref({
                selectedCategory,
                selectedMode,
                selectedGame,
                server: selectedServer,
                serverDetail: selectedServerDetail,
                minPrice: preset.minPrice,
                maxPrice: preset.maxPrice,
                accountType: selectedAccountType,
              })}
              className={
                maxPrice === preset.maxPrice && minPrice === preset.minPrice
                  ? filterActiveClass
                  : filterIdleClass
              }
            >
              {preset.label}
            </Link>
          ))}
          <button
            type="submit"
            className="rounded-xl bg-[var(--gg-accent)] px-6 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
          >
            <CountryText id="listings.apply" />
          </button>
        </form>
      </FilterRow>

      <FilterRow label={<CountryText id="listings.itemSearch" />}>
        <form action="/listings" className="grid w-full gap-3 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="category" value={selectedCategory} />
          <input type="hidden" name="mode" value={selectedMode} />
          <input type="hidden" name="game" value={selectedGame} />
          <input type="hidden" name="server" value={selectedServer} />
          <input type="hidden" name="serverDetail" value={selectedServerDetail} />
          <input type="hidden" name="minPrice" value={minPrice} />
          <input type="hidden" name="maxPrice" value={maxPrice} />
          <input type="hidden" name="accountType" value={selectedAccountType} />
          <LocalizedInput
            name="query"
            placeholderKey="listings.itemSearchPlaceholder"
            className="h-12 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 text-sm font-semibold outline-none placeholder:text-[var(--gg-subtle)]"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--gg-accent)] px-10 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
          >
            <CountryText id="home.search" />
          </button>
        </form>
      </FilterRow>

      <div className="grid items-center gap-4 border-t border-[var(--gg-border-soft)] px-5 py-6 md:grid-cols-[1fr_auto_1fr]">
        <div />
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={buildListingFilterHref({
              selectedCategory,
              selectedMode,
              selectedGame,
              server: selectedServer,
              serverDetail: selectedServerDetail,
              minPrice,
              maxPrice,
              accountType: selectedAccountType,
            })}
            className="rounded-xl bg-[var(--gg-accent)] px-12 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
          >
            <CountryText id="home.search" />
          </Link>
          <button
            type="button"
            className="rounded-xl border border-[var(--gg-accent)] px-12 py-4 text-sm font-black text-[var(--gg-accent)]"
          >
            <CountryText id="listings.saveSearch" />
          </button>
          <Link
            href={`/listings?category=${selectedCategory}&mode=${selectedMode}&game=${encodeURIComponent(selectedGame)}`}
            className="rounded-xl border border-[var(--gg-accent)] px-12 py-4 text-sm font-black text-[var(--gg-accent)]"
          >
            <CountryText id="listings.reset" />
          </Link>
        </div>
        <Link
          href={`/listings?category=${selectedCategory}&mode=${selectedMode}`}
          className="justify-self-center rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-8 py-4 text-sm font-black hover:bg-[var(--gg-control-bg)] md:justify-self-end"
        >
          <CountryText id="listings.chooseGameAgain" />
        </Link>
      </div>
    </section>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 border-b border-[var(--gg-border-soft)] px-5 py-4 md:grid-cols-[140px_1fr]">
      <div className="text-base font-black">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function MarketCategoryHeader({
  selectedCategory,
  selectedMode,
  selectedGame,
}: {
  selectedCategory: string;
  selectedMode: string;
  selectedGame: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">
            <CountryText id="listings.category" />
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-4xl">
            {selectedGame || <CategoryName category={selectedCategory} />}
          </h1>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-bold hover:bg-[var(--gg-control-bg)]"
        >
          <CountryText id="listings.home" />
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {categoryTabs.map((tab) => {
          const active = selectedCategory === tab.value;

          return (
            <Link
              key={tab.value}
              href={`/listings?category=${tab.value}&mode=${selectedMode}`}
              className={
                active
                  ? "rounded-2xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,transparent)] p-5"
                  : "rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-5 hover:border-[var(--gg-accent)]"
              }
            >
              <p className="text-xs font-black text-[var(--gg-accent)]">
                <CountryText id={active ? "listings.selected" : "listings.category"} />
              </p>
              <h2 className="mt-2 text-2xl font-black">
                <CountryText id={tab.labelKey} />
              </h2>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TradeModeSelector({
  selectedCategory,
  selectedMode,
  selectedGame,
}: {
  selectedCategory: string;
  selectedMode: string;
  selectedGame: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5">
      <div className="grid gap-3 md:grid-cols-2">
        {tradeModeTabs.map((tab) => {
          const active = selectedMode === tab.value;
          const gameParam = selectedGame ? `&game=${encodeURIComponent(selectedGame)}` : "";

          return (
            <Link
              key={tab.value}
              href={`/listings?category=${selectedCategory}&mode=${tab.value}${gameParam}`}
              className={
                active
                  ? "rounded-2xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,transparent)] p-5"
                  : "rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-5 hover:border-[var(--gg-accent)]"
              }
            >
              <p className="text-xs font-black text-[var(--gg-accent)]">
                <CountryText id={active ? "listings.selected" : "listings.itemStatus"} />
              </p>
              <h2 className="mt-2 text-2xl font-black">
                <CountryText id={tab.labelKey} />
              </h2>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function GameCardSelector({
  games,
  selectedCategory,
  selectedMode,
  gameSearch,
}: {
  games: GameCard[];
  selectedCategory: string;
  selectedMode: string;
  gameSearch: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">
            <CountryText id="listings.gameCategory" />
          </p>
          <h2 className="mt-1 text-2xl font-black">
            <CountryText id="listings.gameCategory" />
          </h2>
        </div>
        <p className="text-sm font-bold text-[var(--gg-muted)]">
          <CategoryName category={selectedCategory} /> /{" "}
          <CountryText id={selectedMode === "buy" ? "listings.buyMode" : "listings.sellMode"} />
        </p>
      </div>

      <form
        action="/listings"
        className="mt-5 grid gap-3 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-3 md:grid-cols-[1fr_auto]"
      >
        <input type="hidden" name="category" value={selectedCategory} />
        <input type="hidden" name="mode" value={selectedMode} />
        <LocalizedInput
          name="gameSearch"
          defaultValue={gameSearch}
          placeholderKey="listings.gameSearchPlaceholder"
          className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-4 py-3 text-sm font-semibold outline-none placeholder:text-[var(--gg-subtle)]"
        />
        <button
          type="submit"
          className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
        >
          <CountryText id="home.search" />
        </button>
      </form>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((game) => (
          <Link
            key={game.name}
            href={`/listings?category=${selectedCategory}&mode=${selectedMode}&game=${encodeURIComponent(game.name)}`}
            className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4 hover:border-[var(--gg-accent)]"
          >
            <OptimizedGameImage
              src={game.imageUrl ?? `/api/game-card/${game.code}`}
              alt={game.name}
              width={320}
              height={160}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="h-24 w-full rounded-xl border border-[var(--gg-border)] object-cover"
            />
            <h3 className="mt-4 text-base font-black">
              <GameNameText name={game.name} localizedNames={game.localizedNames} />
            </h3>
            <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">{game.region}</p>
            <p className="mt-3 text-sm font-black text-[var(--gg-accent)]">
              {selectedMode === "buy" ? game.buyCount : game.sellCount}
              <CountryText id="home.countSuffix" />
            </p>
          </Link>
        ))}
        {games.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-8 text-center text-sm font-bold text-[var(--gg-muted)] sm:col-span-2 lg:col-span-4">
            <CountryText id="listings.noMatchingGames" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function GameListingView({
  items,
  selectedCategory,
  selectedMode,
  selectedGame,
  query,
  selectedServer,
  selectedServerDetail,
  minPrice,
  maxPrice,
  selectedAccountType,
}: {
  items: MarketFeedItem[];
  selectedCategory: string;
  selectedMode: string;
  selectedGame: string;
  query: string;
  selectedServer: string;
  selectedServerDetail: string;
  minPrice: string;
  maxPrice: string;
  selectedAccountType: string;
}) {
  const titlePrefix = selectedGame || query;
  const sections = buildListingSections(items, selectedCategory, selectedMode);

  return (
    <section className="grid gap-4">
      <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
              <CountryText id="home.marketFeedLabel" />
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {selectedGame || query || <CategoryName category={selectedCategory} />}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip active>
              <CountryText id={selectedMode === "buy" ? "listings.buyRequestChip" : "listings.sellMarketChip"} />
            </StatusChip>
            <StatusChip>
              {formatServerLabel(selectedServer, selectedServerDetail) || <CountryText id="home.allServers" />}
            </StatusChip>
            <StatusChip>
              {minPrice || maxPrice ? (
                <>
                  {minPrice || "0"}-{maxPrice || <CountryText id="listings.unlimited" />} USDT
                </>
              ) : (
                <CountryText id="listings.allPrices" />
              )}
            </StatusChip>
            {selectedCategory === "GAME_ACCOUNT" ? (
              <StatusChip>
                {selectedAccountType ? (
                  <AccountTransferTypeText value={selectedAccountType} />
                ) : (
                  <CountryText id="listings.allAccounts" />
                )}
              </StatusChip>
            ) : null}
            <Link
              href={`/listings?category=${selectedCategory}&mode=${selectedMode}`}
              className="rounded-full border border-[var(--gg-border)] px-4 py-2 text-xs font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              <CountryText id="listings.chooseGameAgain" />
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="home.marketFeedLabel" />
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {titlePrefix ? <>{titlePrefix} </> : null}
              <CategoryName category={selectedCategory} />{" "}
              <CountryText
                id={selectedMode === "buy" ? "listings.buyRequestList" : "listings.sellList"}
              />
            </h2>
          </div>
          <Link
            href={selectedMode === "buy" ? "/my/buy-requests/new" : "/my/listings/new"}
            className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
          >
            <CountryText id={selectedMode === "buy" ? "listings.createBuyRequestCta" : "listings.createListingCta"} />
          </Link>
        </div>

        <div className="mt-5 grid gap-5">
          {sections.map((section) => (
            <ListingSection
              key={section.key}
              title={section.title}
              tone={section.tone}
              items={section.items}
            />
          ))}
          {items.length === 0 ? (
            <EmptyState
              titleKey={selectedMode === "buy" ? "listings.emptyBuyTitle" : "listings.emptySellTitle"}
              descriptionKey={selectedMode === "buy" ? "listings.emptyBuyDesc" : "listings.emptySellDesc"}
              actionHref={selectedMode === "buy" ? "/my/buy-requests/new" : "/my/listings/new"}
              actionLabelKey={selectedMode === "buy" ? "listings.createBuyRequestCta" : "listings.createListingCta"}
            />
          ) : null}
        </div>
      </section>
    </section>
  );
}

function ListingSection({
  title,
  tone,
  items,
}: {
  title: string;
  tone: ListingSectionTone;
  items: MarketFeedItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  const sectionClass =
    tone === "premium"
      ? "rounded-2xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_9%,white)] p-4 shadow-lg shadow-[color-mix(in_srgb,var(--gg-accent)_24%,transparent)]"
      : tone === "lowest"
        ? "rounded-2xl border border-[#10b981] bg-[#ecfdf5] p-4 shadow-sm shadow-[#10b9812e]"
        : "rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4";

  return (
    <section className={sectionClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">{title}</h3>
        <span className="rounded-full bg-[var(--gg-card-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
          {items.length}
          <CountryText id="home.countSuffix" />
        </span>
      </div>
      <div className="grid gap-3">
        {items.map((entry) =>
          entry.type === "listing" ? (
            <ListingRow key={entry.item.listingId} listing={entry.item} tone={tone} />
          ) : (
            <BuyRequestRow key={entry.item.buyRequestId} request={entry.item} tone={tone} />
          ),
        )}
      </div>
    </section>
  );
}

function getDisplayUnitPrice({
  category,
  unitPrice,
  priceUnitQuantity,
  moneyUnitName,
}: {
  category: string;
  unitPrice: string;
  priceUnitQuantity: string;
  moneyUnitName: string;
}) {
  if (category !== "GAME_MONEY") {
    return {
      price: unitPrice,
      unitLabel: moneyUnitName,
    };
  }

  const normalizedPriceUnitQuantity = normalizeGameMoneyPriceUnit(priceUnitQuantity);
  const quantity = Number(normalizedPriceUnitQuantity);
  const price = Number(unitPrice);
  const displayPrice =
    Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price)
      ? price * quantity
      : price;

  return {
    price: formatDisplayNumber(displayPrice),
    unitLabel: getGameMoneyPriceUnitLabel(normalizedPriceUnitQuantity, moneyUnitName),
  };
}

function calculateDisplayTotalAmount(quantity: string, unitPrice: string) {
  const nextQuantity = Number(quantity);
  const nextUnitPrice = Number(unitPrice);

  if (!Number.isFinite(nextQuantity) || !Number.isFinite(nextUnitPrice)) {
    return "0";
  }

  return formatDisplayNumber(nextQuantity * nextUnitPrice);
}

function formatDisplayNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

function ListingRow({
  listing,
  tone = "regular",
}: {
  listing: MarketplaceListingSummary;
  tone?: ListingSectionTone;
}) {
  const moneyUnit = getTradeUnitLabel(
    listing.category,
    listing.moneyUnitName,
    listing.gameName,
  );
  const priceDisplay = getDisplayUnitPrice({
    category: listing.category,
    unitPrice: listing.unitPrice,
    priceUnitQuantity: listing.priceUnitQuantity,
    moneyUnitName: listing.moneyUnitName,
  });
  const rowClass = getListingRowClass(tone);

  return (
    <Link
      href={`/listings/${listing.listingId}`}
      className={`grid gap-4 rounded-2xl border bg-[var(--gg-card-bg)] p-4 hover:border-[var(--gg-accent)] md:grid-cols-[1fr_220px] ${rowClass}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            <CountryText id="listings.activeSale" />
          </span>
          {tone === "lowest" ? (
            <span className="rounded-full bg-[#10b981] px-3 py-1 text-xs font-black text-white">
              최저가 TOP
            </span>
          ) : null}
          {listing.isPremium ? (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--gg-accent)_14%,white)] px-3 py-1 text-xs font-black text-[var(--gg-accent)]">
              프리미엄
            </span>
          ) : null}
          <span className="text-xs font-bold text-[var(--gg-muted)]">
            <CountryText id="listings.createdPrefix" /> {listing.createdAt}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-lg font-black">
          <UserContentText text={listing.title} />
        </h3>
        <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
          <SourceCountryFlag text={listing.title} />{" "}
          {formatServerLabel(listing.serverName, listing.serverDetail) || <CountryText id="listings.noServer" />} /{" "}
          <CountryText id="listings.seller" /> {listing.sellerName}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[var(--gg-muted)]">
          {listing.category === "GAME_ACCOUNT" ? (
            <AccountTypeChip value={listing.accountTransferType} />
          ) : null}
          <span className="rounded-lg bg-[var(--gg-card-bg)] px-3 py-2">
            <CountryText id="listings.minimum" /> {listing.minimumQuantity} {moneyUnit}
          </span>
          <span className="rounded-lg bg-[var(--gg-card-bg)] px-3 py-2">
            <CountryText id="listings.stock" /> {listing.availableQuantity} {moneyUnit}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 md:text-right">
        <div>
          <p className="text-sm font-bold text-[var(--gg-muted)]">
            {priceDisplay.unitLabel} <CountryText id="listings.unitPricePerUnit" />
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--gg-accent)]">
            {priceDisplay.price} {listing.currency}
          </p>
        </div>
        <span className="inline-flex justify-center rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)]">
          <CountryText id="listings.instantBuy" />
        </span>
      </div>
    </Link>
  );
}

function BuyRequestRow({
  request,
  tone = "regular",
}: {
  request: MarketplaceBuyRequestSummary;
  tone?: ListingSectionTone;
}) {
  const moneyUnit = getTradeUnitLabel(
    request.category,
    request.moneyUnitName,
    request.gameName,
  );
  const priceDisplay = getDisplayUnitPrice({
    category: request.category,
    unitPrice: request.unitPrice,
    priceUnitQuantity: request.priceUnitQuantity,
    moneyUnitName: request.moneyUnitName,
  });
  const offerQuantity = request.remainingQuantity || request.quantity;
  const offerTotalAmount = calculateDisplayTotalAmount(offerQuantity, request.unitPrice);
  const rowClass = getListingRowClass(tone);

  return (
    <article className={`grid gap-4 rounded-2xl border bg-[var(--gg-card-bg)] p-4 md:grid-cols-[1fr_240px] ${rowClass}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
            <CountryText id="listings.buyRequestChip" />
          </span>
          {request.isPremium ? (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--gg-accent)_14%,white)] px-3 py-1 text-xs font-black text-[var(--gg-accent)]">
              프리미엄
            </span>
          ) : null}
          <span className="text-xs font-bold text-[var(--gg-muted)]">
            <CountryText id="listings.createdPrefix" /> {request.createdAt}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-lg font-black">
          <UserContentText text={request.title || "Buy request"} />
        </h3>
        <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
          <SourceCountryFlag text={request.title || request.description || "Buy request"} />{" "}
          {formatServerLabel(request.serverName, request.serverDetail) || <CountryText id="listings.noServer" />} /{" "}
          <CountryText id="listings.buyer" /> {request.buyerName}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[var(--gg-muted)]">
          {request.category === "GAME_ACCOUNT" ? (
            <AccountTypeChip value={request.accountTransferType} />
          ) : null}
          <span className="rounded-lg bg-[var(--gg-card-bg)] px-3 py-2">
            <CountryText id="listings.wanted" /> {request.remainingQuantity} / {request.quantity} {moneyUnit}
          </span>
          {request.category === "GAME_MONEY" ? (
            <span className="rounded-lg bg-[var(--gg-card-bg)] px-3 py-2">
              {request.tradeMode === "BULK" ? "일괄구매" : "분할구매"} / 최소 {request.minimumQuantity} {moneyUnit}
            </span>
          ) : null}
          <span className="rounded-lg bg-[var(--gg-card-bg)] px-3 py-2">
            <CountryText id="listings.offerCountPrefix" /> {request.offerCount}
            <CountryText id="listings.offerCountSuffix" />
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 md:text-right">
        <div>
          <p className="text-sm font-bold text-[var(--gg-muted)]">
            <CountryText id="listings.lockedTotal" />
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--gg-accent)]">
            {request.totalAmount} {request.currency}
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">
            <CountryText id="listings.unitPriceShort" /> {priceDisplay.price} {request.currency} / {priceDisplay.unitLabel}
          </p>
        </div>
        <BuyRequestOfferForm
          buyRequestId={request.buyRequestId}
          category={request.category}
          defaultQuantity={offerQuantity}
          minimumQuantity={request.minimumQuantity}
          tradeMode={request.tradeMode}
          defaultUnitPrice={priceDisplay.price}
          canonicalUnitPrice={request.unitPrice}
          priceUnitLabel={priceDisplay.unitLabel}
          totalAmount={offerTotalAmount}
          currency={request.currency}
          serverLabel={formatServerLabel(request.serverName, request.serverDetail) || "전체 서버"}
        />
      </div>
    </article>
  );
}

function buildListingSections(
  items: MarketFeedItem[],
  selectedCategory: string,
  selectedMode: string,
) {
  const usedIds = new Set<string>();
  const sections: Array<{
    key: string;
    title: string;
    tone: ListingSectionTone;
    items: MarketFeedItem[];
  }> = [];
  const canShowLowest =
    selectedMode === "sell" &&
    selectedCategory === "GAME_MONEY" &&
    items.some((entry) => entry.type === "listing");

  if (canShowLowest) {
    const lowestItems = items
      .filter((entry): entry is { type: "listing"; item: MarketplaceListingSummary } => entry.type === "listing")
      .sort((left, right) => Number(left.item.unitPrice) - Number(right.item.unitPrice))
      .slice(0, 5);

    for (const entry of lowestItems) {
      usedIds.add(getMarketItemId(entry));
    }

    sections.push({
      key: "lowest",
      title: "최저가 판매글",
      tone: "lowest",
      items: lowestItems,
    });
  }

  const premiumItems = items.filter((entry) => {
    if (!isMarketItemPremium(entry) || usedIds.has(getMarketItemId(entry))) {
      return false;
    }

    usedIds.add(getMarketItemId(entry));
    return true;
  });

  if (premiumItems.length > 0) {
    sections.push({
      key: "premium",
      title: "프리미엄글",
      tone: "premium",
      items: premiumItems,
    });
  }

  sections.push({
    key: "regular",
    title: "일반글",
    tone: "regular",
    items: items.filter((entry) => !usedIds.has(getMarketItemId(entry))),
  });

  return sections;
}

function getMarketItemId(entry: MarketFeedItem) {
  return entry.type === "listing" ? entry.item.listingId : entry.item.buyRequestId;
}

function isMarketItemPremium(entry: MarketFeedItem) {
  return entry.item.isPremium;
}

function getListingRowClass(tone: ListingSectionTone) {
  if (tone === "premium") {
    return "border-[var(--gg-accent)] shadow-sm shadow-[color-mix(in_srgb,var(--gg-accent)_24%,transparent)]";
  }

  if (tone === "lowest") {
    return "border-[#10b981] shadow-sm shadow-[#10b9812e]";
  }

  return "border-[var(--gg-border)]";
}

function StatusChip({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-[var(--gg-accent)] px-4 py-2 text-xs font-black text-[var(--gg-inverse-text)]"
          : "rounded-full border border-[var(--gg-border)] px-4 py-2 text-xs font-black text-[var(--gg-muted)]"
      }
    >
      {children}
    </span>
  );
}

function AccountTypeChip({ value }: { value?: string | null }) {
  const normalized = normalizeAccountTransferType(value);

  if (!normalized) {
    return null;
  }

  return (
    <span className="rounded-lg bg-[var(--gg-card-bg)] px-3 py-2 text-[var(--gg-accent)]">
      <AccountTransferTypeText value={normalized} />
    </span>
  );
}

function AccountTransferTypeText({ value }: { value?: string | null }) {
  const normalized = normalizeAccountTransferType(value);

  if (normalized === "GOOGLE") {
    return <CountryText id="account.google" />;
  }

  if (normalized === "GAME_COMPANY") {
    return <CountryText id="account.gameCompany" />;
  }

  return <>{value}</>;
}

function EmptyState({
  titleKey,
  descriptionKey,
  actionHref,
  actionLabelKey,
}: {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  actionHref: string;
  actionLabelKey: TranslationKey;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-8 text-center">
      <h3 className="text-xl font-black">
        <CountryText id={titleKey} />
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-bold text-[var(--gg-muted)]">
        <CountryText id={descriptionKey} />
      </p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
      >
        <CountryText id={actionLabelKey} />
      </Link>
    </div>
  );
}

function getMarketItems(view: Awaited<ReturnType<typeof getMarketplaceListings | typeof getMarketplaceBuyRequests>>) {
  if ("listings" in view) {
    return view.listings.map((item) => ({ type: "listing", item }) satisfies MarketFeedItem);
  }

  return view.buyRequests.map((item) => ({ type: "buyRequest", item }) satisfies MarketFeedItem);
}

function filterMarketItemsByServerAndPrice(
  items: MarketFeedItem[],
  selectedServer: string,
  selectedServerDetail: string,
  minPrice: string,
  maxPrice: string,
  selectedAccountType: string,
) {
  const min = minPrice ? Number(minPrice) : null;
  const max = maxPrice ? Number(maxPrice) : null;
  const accountType = normalizeAccountTransferType(selectedAccountType);

  return items.filter((entry) => {
    const item = entry.item;

    if (selectedServer && item.serverName !== selectedServer) {
      return false;
    }

    if (selectedServerDetail && item.serverDetail !== selectedServerDetail) {
      return false;
    }

    const price = Number(item.unitPrice);

    if (min !== null && price < min) {
      return false;
    }

    if (max !== null && price > max) {
      return false;
    }

    if (accountType && item.category === "GAME_ACCOUNT") {
      const itemAccountType = normalizeAccountTransferType(item.accountTransferType);

      if (itemAccountType !== accountType) {
        return false;
      }
    }

    return true;
  });
}

function buildGameCards(
  items: MarketFeedItem[],
  games: GameCatalogOption[],
  gameSearch: string,
) {
  const counts = new Map<string, { sellCount: number; buyCount: number }>();

  for (const entry of items) {
    const gameName = entry.item.gameName;
    const current = counts.get(gameName) ?? { sellCount: 0, buyCount: 0 };

    if (entry.type === "listing") {
      current.sellCount += 1;
    } else {
      current.buyCount += 1;
    }

    counts.set(gameName, current);
  }

  const byName = new Map<string, GameCatalogOption>();

  for (const game of games) {
    if (!byName.has(game.name)) {
      byName.set(game.name, game);
    }
  }

  const normalizedSearch = gameSearch.toLowerCase();

  return Array.from(byName.values())
    .filter((game) => !normalizedSearch || game.name.toLowerCase().includes(normalizedSearch))
    .slice(0, 12)
    .map((game) => {
      const count = counts.get(game.name) ?? { sellCount: 0, buyCount: 0 };

      return {
        ...game,
        sellCount: count.sellCount,
        buyCount: count.buyCount,
      };
    });
}

function buildGameCardsFromDirectory(
  games: Array<GameCatalogOption & { sellCount: number; buyCount: number }>,
  selectedMode: string,
  gameSearch: string,
) {
  const normalizedSearch = gameSearch.toLowerCase();

  return games
    .filter((game) => !normalizedSearch || game.name.toLowerCase().includes(normalizedSearch))
    .slice(0, 12)
    .map((game) => ({
      ...game,
      sellCount: selectedMode === "buy" ? 0 : game.sellCount,
      buyCount: selectedMode === "sell" ? 0 : game.buyCount,
    }));
}

function buildListingFilterHref({
  selectedCategory,
  selectedMode,
  selectedGame,
  server,
  serverDetail,
  minPrice,
  maxPrice,
  accountType,
}: {
  selectedCategory: string;
  selectedMode: string;
  selectedGame: string;
  server: string;
  serverDetail?: string | null;
  minPrice: string;
  maxPrice: string;
  accountType?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("category", selectedCategory);
  params.set("mode", selectedMode);

  if (selectedGame) {
    params.set("game", selectedGame);
  }

  if (server) {
    params.set("server", server);
  }

  if (serverDetail) {
    params.set("serverDetail", serverDetail);
  }

  if (minPrice) {
    params.set("minPrice", minPrice);
  }

  if (maxPrice) {
    params.set("maxPrice", maxPrice);
  }

  const normalizedAccountType = normalizeAccountTransferType(accountType);
  if (normalizedAccountType) {
    params.set("accountType", normalizedAccountType);
  }

  return `/listings?${params.toString()}`;
}

function formatServerLabel(serverName?: string | null, serverDetail?: string | null) {
  if (!serverName) return "";
  return serverDetail ? `${serverName} ${serverDetail}` : serverName;
}

function CategoryName({ category }: { category: string }) {
  if (category === "GAME_MONEY") {
    return <CountryText id="common.gameMoney" />;
  }

  if (category === "GAME_ITEM") {
    return <CountryText id="common.item" />;
  }

  if (category === "GAME_ACCOUNT") {
    return <CountryText id="common.account" />;
  }

  return <>{category}</>;
}

const filterActiveClass =
  "rounded-xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,transparent)] px-5 py-3 text-sm font-black text-[var(--gg-accent)]";
const filterIdleClass =
  "rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-5 py-3 text-sm font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)]";

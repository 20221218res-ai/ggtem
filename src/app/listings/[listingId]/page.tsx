import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { MarketplaceListingSummary } from "@/lib/market/listings";
import { getMarketplaceListingDetail } from "@/lib/market/listings";
import { MarketplaceHeader } from "../../marketplace-home";
import CountryText from "../../country-text";
import { GameMoneyPriceUnitText, GameMoneyQuantityText } from "../../game-money-unit-text";
import UserContentText, { SourceCountryFlag } from "../../user-content-text";
import { PurchasePreviewPanel } from "./purchase-preview-panel";
import {
  formatGameMoneyQuantityWithUnit,
  getGameMoneyPriceUnitLabel,
  getTradeUnitLabel,
  safeNormalizeGameMoneyPriceUnit,
  type MoneyUnitNameSource,
} from "@/lib/market/trade-unit";
import { normalizeAccountTransferType } from "@/lib/market/account-transfer-types";

export const dynamic = "force-dynamic";

type ListingDetailPageProps = {
  params: Promise<{
    listingId: string;
  }>;
};

export default async function ListingDetailPage({
  params,
}: ListingDetailPageProps) {
  const { listingId } = await params;
  const listing = await getMarketplaceListingDetail(listingId);

  if (!listing) {
    notFound();
  }

  const sellerGrade = getSellerGrade(listing.sellerReviewSummary.reviewCount);
  const reviewLabel =
    listing.sellerReviewSummary.reviewCount > 0
      ? `${listing.sellerReviewSummary.averageRating}/5`
      : null;
  const serverLabel = listing.serverName;
  const moneyUnit = getTradeUnitLabel(
    listing.category,
    listing.moneyUnitName,
    listing.gameName,
  );
  const priceDisplay = getListingPriceDisplay({
    category: listing.category,
    unitPrice: listing.unitPrice,
    priceUnitQuantity: listing.priceUnitQuantity,
    moneyUnitName: listing.moneyUnitName,
  });
  const minimumQuantityLabel = getListingQuantityLabel(listing, listing.minimumQuantity, moneyUnit);
  const availableQuantityLabel = getListingQuantityLabel(listing, listing.availableQuantity, moneyUnit);
  const lockedQuantityLabel = getListingQuantityLabel(listing, listing.lockedQuantity, moneyUnit);
  const soldQuantityLabel = getListingQuantityLabel(listing, listing.soldQuantity, moneyUnit);
  const accountTransferTypeLabel =
    listing.category === "GAME_ACCOUNT"
      ? normalizeAccountTransferType(listing.accountTransferType)
      : null;
  const description = listing.description;

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] text-[var(--gg-text)]">
      <MarketplaceHeader />

      <section className="mx-auto grid max-w-[1280px] gap-4 px-4 py-4 sm:gap-5 sm:py-5 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--gg-muted)] sm:text-sm">
          <Link href="/" className="hover:text-[var(--gg-accent)]">
            <CountryText id="common.home" />
          </Link>
          <span>/</span>
          <Link
            href={`/listings?category=${listing.category}&mode=sell&game=${encodeURIComponent(listing.gameName)}`}
            className="hover:text-[var(--gg-accent)]"
          >
            {listing.gameName}
          </Link>
          <span>/</span>
          <span className="text-[var(--gg-text)]">
            {serverLabel ?? <CountryText id="listingDetail.allServers" />}
          </span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="grid gap-5">
            <section className="overflow-hidden rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-sm shadow-[var(--gg-shadow)] sm:rounded-2xl">
              <div className="p-4 sm:p-6">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <Badge>
                      <CategoryName category={listing.category} />
                    </Badge>
                    <Badge>{listing.gameName}</Badge>
                    <Badge>{serverLabel ?? <CountryText id="listingDetail.allServers" />}</Badge>
                    {accountTransferTypeLabel ? (
                      <Badge>
                        <AccountTransferTypeText value={accountTransferTypeLabel} />
                      </Badge>
                    ) : null}
                    <span className="w-full text-xs font-bold text-[var(--gg-muted)] sm:ml-auto sm:w-auto">
                      <CountryText id="listingDetail.registeredPrefix" /> {listing.createdAt}
                    </span>
                  </div>

                  <h1 className="mt-4 text-2xl font-black leading-tight sm:mt-5 sm:text-3xl lg:text-4xl">
                    <SourceCountryFlag text={listing.title} />
                    <UserContentText text={listing.title} showSourceFlag={false} />
                  </h1>

                  <div className="mt-4 grid gap-2 sm:mt-6 sm:gap-3 md:grid-cols-3">
                    <Metric
                      label={<CountryText id="listingDetail.unitPrice" />}
                      value={`${priceDisplay.price} ${listing.currency}`}
                      hint={
                        listing.category === "GAME_MONEY" ? (
                          <>
                            <GameMoneyPriceUnitText
                              priceUnitQuantity={listing.priceUnitQuantity}
                              moneyUnitName={listing.moneyUnitName}
                            />{" "}
                            <CountryText id="listingDetail.unitBasisSuffix" />
                          </>
                        ) : (
                          <CountryText id="listingDetail.eachBasis" />
                        )
                      }
                      strong
                    />
                    <Metric
                      label={<CountryText id="listingDetail.minimumQuantity" />}
                      value={
                        listing.category === "GAME_MONEY" ? (
                          <GameMoneyQuantityText
                            quantity={listing.minimumQuantity}
                            priceUnitQuantity={listing.priceUnitQuantity}
                            moneyUnitName={listing.moneyUnitName}
                          />
                        ) : (
                          minimumQuantityLabel
                        )
                      }
                    />
                    <Metric
                      label={<CountryText id="listingDetail.availableQuantity" />}
                      value={
                        listing.category === "GAME_MONEY" ? (
                          <GameMoneyQuantityText
                            quantity={listing.availableQuantity}
                            priceUnitQuantity={listing.priceUnitQuantity}
                            moneyUnitName={listing.moneyUnitName}
                          />
                        ) : (
                          availableQuantityLabel
                        )
                      }
                    />
                  </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 sm:rounded-2xl sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
                    <CountryText id="listingDetail.sellerInfo" />
                  </p>
                  <h2 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl"><CountryText id="listingDetail.sellerInfo" /></h2>
                </div>
                <Link
                  href={`/sellers/${listing.sellerId}`}
                  className="rounded-lg border border-[var(--gg-border)] px-4 py-2.5 text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)] sm:rounded-xl sm:py-3"
                >
                  <CountryText id="listingDetail.sellerView" />
                </Link>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-[260px_1fr]">
                <div className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4 sm:rounded-2xl sm:p-5">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-lg font-black text-[var(--gg-inverse-text)]">
                      {getInitials(listing.sellerName)}
                    </span>
                    <div>
                      <h3 className="text-lg font-black">
                        <SourceCountryFlag text={listing.sellerName} />
                        {listing.sellerName}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
                        {reviewLabel ? (
                          <>
                            {reviewLabel} · <CountryText id="listingDetail.reviewCountSuffix" />{" "}
                            {listing.sellerReviewSummary.reviewCount}
                          </>
                        ) : (
                          <CountryText id="listingDetail.firstReviewWaiting" />
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SmallBadge>{sellerGrade}</SmallBadge>
                    <SmallBadge><CountryText id="listingDetail.escrow" /></SmallBadge>
                    <SmallBadge><CountryText id="listingDetail.tradeProtection" /></SmallBadge>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoTile label={<CountryText id="listingDetail.deliveryMethod" />} value={listing.settlementLabel} />
                  {accountTransferTypeLabel ? (
                    <InfoTile
                      label={<CountryText id="listings.accountType" />}
                      value={<AccountTransferTypeText value={accountTransferTypeLabel} />}
                    />
                  ) : null}
                  <InfoTile label={<CountryText id="listingDetail.lockedQuantity" />} value={lockedQuantityLabel} />
                  <InfoTile label={<CountryText id="listingDetail.soldQuantity" />} value={soldQuantityLabel} />
                  <InfoTile label={<CountryText id="listingDetail.status" />} value={<CountryText id="listingDetail.activeStatus" />} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 sm:rounded-2xl sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
                <CountryText id="listingDetail.sellerContent" />
              </p>
              <h2 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl"><CountryText id="listingDetail.sellerContent" /></h2>
              <div className="mt-4 rounded-xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] p-4 text-sm leading-7 text-[var(--gg-muted)] sm:mt-5 sm:rounded-2xl sm:p-5">
                {description ? (
                  <UserContentText text={description} multiline className="whitespace-pre-wrap" />
                ) : (
                  <CountryText id="listingDetail.defaultDescription" />
                )}
              </div>
              {listing.contentImages.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2">
                  {listing.contentImages.map((image, index) => (
                    <div
                      key={`${image.imageUrl}-${index}`}
                      className="overflow-hidden rounded-xl border border-[var(--gg-border-soft)] bg-[var(--gg-control-bg)] sm:rounded-2xl"
                    >
                      <Image
                        src={image.imageUrl}
                        alt={image.altText || listing.title}
                        width={960}
                        height={640}
                        className="h-auto w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <details className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 sm:rounded-2xl sm:p-6">
              <summary className="cursor-pointer text-lg font-black sm:text-xl">
                <CountryText id="listingDetail.reviewAndRelated" />
              </summary>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <section className="grid gap-3">
                  <h3 className="text-sm font-black text-[var(--gg-muted)]"><CountryText id="listingDetail.recentReviews" /></h3>
                  {listing.sellerRecentReviews.slice(0, 2).map((review) => (
                    <ReviewSnippet key={review.reviewId} review={review} />
                  ))}
                  {listing.sellerRecentReviews.length === 0 ? (
                    <EmptyBox><CountryText id="listingDetail.noReviews" /></EmptyBox>
                  ) : null}
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-black text-[var(--gg-muted)]"><CountryText id="listingDetail.relatedListings" /></h3>
                  {listing.relatedListings.slice(0, 3).map((relatedListing) => (
                    <RelatedListingCard
                      key={relatedListing.listingId}
                      listing={relatedListing}
                    />
                  ))}
                  {listing.relatedListings.length === 0 ? (
                    <EmptyBox><CountryText id="listingDetail.noRelatedListings" /></EmptyBox>
                  ) : null}
                </section>
              </div>
            </details>
          </div>

          <aside className="flex flex-col gap-4 xl:sticky xl:top-28 xl:self-start">
            <PurchasePreviewPanel
              listingId={listing.listingId}
              category={listing.category}
              tradeMode={listing.tradeMode}
              unitPrice={listing.unitPrice}
              displayUnitPrice={priceDisplay.price}
              priceUnitQuantity={listing.priceUnitQuantity}
              priceUnitLabel={priceDisplay.unitLabel}
              currency={listing.currency}
              availableQuantity={listing.availableQuantity}
              minimumQuantity={listing.minimumQuantity}
              tradeUnitLabel={moneyUnit}
              serverLabel={serverLabel ?? undefined}
            />

            <section className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 sm:rounded-2xl sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
                <CountryText id="listingDetail.tradeProtection" />
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-[var(--gg-muted)]">
                <span className="rounded-lg bg-[var(--gg-card-soft-bg)] px-2 py-2"><CountryText id="listingDetail.payment" /></span>
                <span className="rounded-lg bg-[var(--gg-card-soft-bg)] px-2 py-2"><CountryText id="listingDetail.delivery" /></span>
                <span className="rounded-lg bg-[var(--gg-card-soft-bg)] px-2 py-2"><CountryText id="listingDetail.confirmation" /></span>
              </div>
            </section>

            <Link
              href={`/listings?category=${listing.category}&mode=sell&game=${encodeURIComponent(listing.gameName)}`}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              <CountryText id="listingDetail.backToListings" />
            </Link>
          </aside>
        </section>
      </section>
    </main>
  );
}

function getListingPriceDisplay({
  category,
  unitPrice,
  priceUnitQuantity,
  moneyUnitName,
}: {
  category: string;
  unitPrice: string;
  priceUnitQuantity: string;
  moneyUnitName: MoneyUnitNameSource;
}) {
  if (category !== "GAME_MONEY") {
    return {
      price: formatDisplayNumber(Number(unitPrice)),
      unitLabel: "",
    };
  }

  const normalizedPriceUnitQuantity =
    safeNormalizeGameMoneyPriceUnit(priceUnitQuantity);
  const quantity = Number(normalizedPriceUnitQuantity);
  const price = Number(unitPrice) * quantity;

  return {
    price: formatDisplayNumber(price),
    unitLabel: getGameMoneyPriceUnitLabel(normalizedPriceUnitQuantity, moneyUnitName),
  };
}

function formatDisplayNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

function Metric({
  label,
  value,
  hint,
  strong,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-3 sm:rounded-2xl sm:p-4">
      <p className="text-xs font-bold text-[var(--gg-subtle)]">{label}</p>
      <p className={strong ? "mt-1.5 text-xl font-black text-[var(--gg-accent)] sm:mt-2 sm:text-2xl" : "mt-1.5 text-lg font-black sm:mt-2 sm:text-xl"}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">{hint}</p> : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-3 sm:rounded-2xl sm:p-4">
      <p className="text-xs font-bold text-[var(--gg-subtle)]">{label}</p>
      <p className="mt-2 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] px-2.5 py-1.5 text-xs font-black text-[var(--gg-muted)] sm:px-3 sm:py-2">
      {children}
    </span>
  );
}

function SmallBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[color-mix(in_srgb,var(--gg-accent)_14%,transparent)] px-2 py-1 text-xs font-bold text-[var(--gg-accent)]">
      {children}
    </span>
  );
}

function RelatedListingCard({ listing }: { listing: MarketplaceListingSummary }) {
  return (
    <Link
      href={`/listings/${listing.listingId}`}
      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4 hover:border-[var(--gg-accent)]"
    >
      <p className="line-clamp-1 text-sm font-black">
        <UserContentText text={listing.title} />
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xs font-bold text-[var(--gg-muted)]">
          {listing.serverName ?? <CountryText id="listingDetail.allServers" />}
        </p>
        <p className="text-base font-black text-[var(--gg-accent)]">
          {listing.unitPrice}
        </p>
      </div>
    </Link>
  );
}

function ReviewSnippet({
  review,
}: {
  review: {
    rating: number;
    comment: string | null;
    buyerName: string;
    orderNumber: string;
    createdAt: string;
  };
}) {
  return (
    <article className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">
            <CountryText id="listingDetail.ratingPrefix" /> {review.rating}/5 · <SourceCountryFlag text={review.buyerName} />
            {review.buyerName}
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--gg-subtle)]">
            <CountryText id="listingDetail.orderPrefix" /> {review.orderNumber}
          </p>
        </div>
        <p className="shrink-0 text-xs font-bold text-[var(--gg-muted)]">{review.createdAt}</p>
      </div>
      <div className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--gg-muted)]">
        {review.comment ? <UserContentText text={review.comment} /> : <CountryText id="listingDetail.ratingOnlyReview" />}
      </div>
    </article>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-5 text-center text-sm font-bold text-[var(--gg-muted)]">
      {children}
    </div>
  );
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

function formatTradeQuantity(quantity: string, unitLabel: string) {
  const formattedQuantity = quantity.includes(".")
    ? quantity.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "")
    : quantity;
  return unitLabel ? `${formattedQuantity} ${unitLabel}` : formattedQuantity;
}

function getListingQuantityLabel(
  listing: Pick<
    MarketplaceListingSummary,
    "category" | "priceUnitQuantity" | "moneyUnitName"
  >,
  quantity: string,
  fallbackUnit: string,
) {
  if (listing.category === "GAME_MONEY") {
    return formatGameMoneyQuantityWithUnit(
      quantity,
      listing.priceUnitQuantity,
      listing.moneyUnitName,
    );
  }

  return formatTradeQuantity(quantity, fallbackUnit);
}

function getSellerGrade(reviewCount: number) {
  if (reviewCount >= 1000) {
    return "Diamond";
  }

  if (reviewCount >= 300) {
    return "Gold";
  }

  return "Silver";
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "GG";
  }

  return trimmed.slice(0, 2).toUpperCase();
}

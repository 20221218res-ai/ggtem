import Link from "next/link";
import { notFound } from "next/navigation";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import { MarketplaceHeader } from "@/app/marketplace-home";
import UserContentText, { SourceCountryFlag } from "@/app/user-content-text";
import { getMarketplaceSellerProfile } from "@/lib/market/sellers";
import {
  formatGameMoneyQuantityWithUnit,
  getGameMoneyPriceUnitLabel,
} from "@/lib/market/trade-unit";

type SellerProfilePageProps = {
  params: Promise<{
    sellerId: string;
  }>;
};

type TrustStatus = {
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  className: string;
};

type SellerTrustGuide = {
  badgeKey: TranslationKey;
  descriptionKey: TranslationKey;
};

type SellerProfile = NonNullable<
  Awaited<ReturnType<typeof getMarketplaceSellerProfile>>
>;
type SellerListing = SellerProfile["listings"][number];

export default async function SellerProfilePage({ params }: SellerProfilePageProps) {
  const { sellerId } = await params;
  const seller = await getMarketplaceSellerProfile(sellerId);

  if (!seller) {
    notFound();
  }

  const sellerGrade = getSellerGrade(seller.reviewSummary.reviewCount);
  const trustStatus = getTrustStatus(seller.trustSignals);
  const sellerTrustGuide = getSellerTrustGuide(seller.reviewSummary.reviewCount);

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] text-[var(--gg-text)] transition-colors">
      <MarketplaceHeader />

      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--gg-muted)]">
          <Link href="/" className="hover:text-[var(--gg-text)]">
            <CountryText id="common.home" />
          </Link>
          <span>/</span>
          <Link href="/listings" className="hover:text-[var(--gg-text)]">
            <CountryText id="home.browseListings" />
          </Link>
          <span>/</span>
          <span className="text-[var(--gg-text)]">
            <SourceCountryFlag text={seller.sellerName} />
            {seller.sellerName}
          </span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] shadow-lg shadow-[var(--gg-shadow)]">
          <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
            <div className="border-b border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-4">
                <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-2xl font-black text-white">
                  {getInitials(seller.sellerName)}
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-[var(--gg-card-bg)] bg-emerald-400" />
                </span>
                <div>
                  <p className="text-xs font-black text-[var(--gg-accent)]">
                    <CountryText id="seller.profile" />
                  </p>
                  <h1 className="mt-2 text-2xl font-black">
                    <SourceCountryFlag text={seller.sellerName} />
                    {seller.sellerName}
                  </h1>
                  <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
                    <CountryText id="seller.joinedAt" /> {seller.joinedAt}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <SmallBadge>{sellerGrade}</SmallBadge>
                <SmallBadge>
                  <CountryText id="listingDetail.escrow" />
                </SmallBadge>
                <SmallBadge>
                  <CountryText id={sellerTrustGuide.badgeKey} />
                </SmallBadge>
                <SmallBadge>
                  <CountryText id="seller.activeListings" /> {seller.activeListingCount}
                </SmallBadge>
              </div>

              <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-xs font-bold leading-5 text-emerald-900">
                <CountryText id={sellerTrustGuide.descriptionKey} />
              </p>

              <Link
                href="/listings"
                className="mt-6 inline-flex w-full justify-center rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-black hover:bg-[var(--gg-control-bg)]"
              >
                <CountryText id="seller.backToListings" />
              </Link>
            </div>

            <div className="p-6">
              <p className="text-sm font-black text-[var(--gg-accent)]">
                <CountryText id="seller.trustOverview" />
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                <CountryText id="seller.trustOverview" />
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--gg-muted)]">
                <CountryText id="seller.trustOverviewDescription" />
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label={<CountryText id="seller.grade" />} value={sellerGrade} />
                <SummaryCard
                  label={<CountryText id="seller.rating" />}
                  value={<ReviewLabel averageRating={seller.reviewSummary.averageRating} reviewCount={seller.reviewSummary.reviewCount} />}
                />
                <SummaryCard label={<CountryText id="seller.activeListings" />} value={seller.activeListingCount} />
                <SummaryCard label={<CountryText id="seller.totalAvailableQuantity" />} value={seller.totalAvailableQuantity} />
              </div>

              <div className={`mt-5 rounded-2xl border p-4 ${trustStatus.className}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-black">
                      <CountryText id={trustStatus.labelKey} />
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      <CountryText id={trustStatus.descriptionKey} />
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs font-black sm:grid-cols-3 lg:min-w-[360px]">
                    <TrustSignal label={<CountryText id="seller.recentLowRatings" />} value={seller.trustSignals.lowRecentReviewCount} />
                    <TrustSignal label={<CountryText id="seller.openReports" />} value={seller.trustSignals.openReportCount} />
                    <TrustSignal label={<CountryText id="seller.highSeverityReports" />} value={seller.trustSignals.highSeverityOpenReportCount} />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] p-4">
                <p className="text-sm font-black">
                  <CountryText id="seller.buyerCheckTitle" />
                </p>
                <div className="mt-3 grid gap-2 text-xs font-bold leading-5 text-[var(--gg-muted)] md:grid-cols-3">
                  <p><CountryText id="seller.buyerCheckReview" /></p>
                  <p><CountryText id="seller.buyerCheckReports" /></p>
                  <p><CountryText id="seller.buyerCheckEscrow" /></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">
                <CountryText id="seller.recentReviews" />
              </p>
              <h2 className="mt-1 text-2xl font-black">
                <CountryText id="seller.recentReviews" />
              </h2>
            </div>
            <p className="text-sm font-bold text-[var(--gg-muted)]">
              <CountryText id="seller.totalReviews" /> {seller.reviewSummary.reviewCount}
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {seller.recentReviews.map((review) => (
              <article
                key={review.reviewId}
                className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">
                      <CountryText id="listingDetail.ratingPrefix" /> {review.rating}/5 / <SourceCountryFlag text={review.buyerName} />
                      {review.buyerName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[var(--gg-subtle)]">
                      <CountryText id="listingDetail.orderPrefix" /> {review.orderNumber}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-[var(--gg-muted)]">{review.createdAt}</p>
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--gg-muted)]">
                  {review.comment ? (
                    <UserContentText text={review.comment} />
                  ) : (
                    <CountryText id="listingDetail.ratingOnlyReview" />
                  )}
                </div>
              </article>
            ))}

            {seller.recentReviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-8 text-center text-sm font-bold text-[var(--gg-muted)] lg:col-span-2">
                <CountryText id="seller.noBuyerReviews" />
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">
                <CountryText id="seller.sellerListings" />
              </p>
              <h2 className="mt-1 text-2xl font-black">
                <CountryText id="seller.sellerListings" />
              </h2>
            </div>
            <p className="text-sm font-bold text-[var(--gg-muted)]">{seller.listings.length}</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {seller.listings.map((listing) => (
              <SellerListingCard key={listing.listingId} listing={listing} />
            ))}

            {seller.listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-8 text-center text-sm font-bold text-[var(--gg-muted)] lg:col-span-2">
                <CountryText id="seller.noActiveListings" />
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
      <p className="text-xs font-bold text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function SellerListingCard({ listing }: { listing: SellerListing }) {
  const price = getSellerListingDisplayPrice(listing);
  const availableQuantity = formatSellerListingQuantity(listing, listing.availableQuantity);
  const lockedQuantity = formatSellerListingQuantity(listing, listing.lockedQuantity);
  const soldQuantity = formatSellerListingQuantity(listing, listing.soldQuantity);

  return (
    <Link
      href={`/listings/${listing.listingId}`}
      className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-5 transition hover:border-[var(--gg-accent)] hover:bg-[var(--gg-control-bg)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="line-clamp-2 text-base font-black">
            <UserContentText text={listing.title} />
          </p>
          <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
            {listing.gameName} / <CategoryName category={listing.category} />
          </p>
          {listing.category === "GAME_MONEY" ? (
            <p className="mt-2 text-xs font-black text-[var(--gg-accent)]">
              {listing.tradeMode === "BULK" ? "일괄 판매" : "분할 판매"}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black text-[var(--gg-accent)]">
            {price.amount}
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">
            {listing.currency}
            {price.unitLabel ? ` / ${price.unitLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--gg-muted)]">
        <InfoBadge><CountryText id="seller.buyAvailable" /> {availableQuantity}</InfoBadge>
        <InfoBadge><CountryText id="seller.lockedQuantity" /> {lockedQuantity}</InfoBadge>
        <InfoBadge><CountryText id="seller.soldQuantity" /> {soldQuantity}</InfoBadge>
      </div>

      <p className="mt-4 text-xs font-bold text-[var(--gg-subtle)]">
        <CountryText id="manage.registeredAt" /> {listing.createdAt}
      </p>
    </Link>
  );
}

function formatSellerListingQuantity(listing: SellerListing, quantity: string) {
  if (listing.category === "GAME_MONEY") {
    return formatGameMoneyQuantityWithUnit(
      quantity,
      listing.priceUnitQuantity,
      listing.moneyUnitName,
    );
  }

  return quantity;
}

function TrustSignal({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <div className="rounded-xl bg-white/55 px-3 py-2 text-center text-[var(--gg-text)]">
      <p className="text-[11px] text-[var(--gg-muted)]">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function SmallBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-bold text-[var(--gg-accent)]">
      {children}
    </span>
  );
}

function InfoBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2">
      {children}
    </span>
  );
}

function getSellerListingDisplayPrice(listing: SellerListing) {
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
    unitLabel: getGameMoneyPriceUnitLabel(
      listing.priceUnitQuantity,
      listing.moneyUnitName,
    ),
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

function ReviewLabel({
  averageRating,
  reviewCount,
}: {
  averageRating: string;
  reviewCount: number;
}) {
  if (reviewCount <= 0) {
    return <CountryText id="listingDetail.firstReviewWaiting" />;
  }

  return (
    <>
      {averageRating}/5 ({reviewCount})
    </>
  );
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

function getSellerTrustGuide(reviewCount: number): SellerTrustGuide {
  if (reviewCount >= 100) {
    return {
      badgeKey: "seller.reviewEnough",
      descriptionKey: "seller.reviewEnoughDescription",
    };
  }

  if (reviewCount > 0) {
    return {
      badgeKey: "seller.reviewCheckAvailable",
      descriptionKey: "seller.reviewCheckDescription",
    };
  }

  return {
    badgeKey: "seller.firstReviewWaiting",
    descriptionKey: "seller.firstReviewDescription",
  };
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

function getTrustStatus(signals: {
  lowRecentReviewCount: number;
  openReportCount: number;
  highSeverityOpenReportCount: number;
}): TrustStatus {
  if (signals.highSeverityOpenReportCount > 0) {
    return {
      labelKey: "seller.operationReviewSignal",
      descriptionKey: "seller.operationReviewDescription",
      className: "border-rose-300 bg-rose-50 text-rose-950",
    };
  }

  if (signals.openReportCount > 0 || signals.lowRecentReviewCount > 0) {
    return {
      labelKey: "seller.tradeCheckRecommended",
      descriptionKey: "seller.tradeCheckDescription",
      className: "border-amber-300 bg-amber-50 text-amber-950",
    };
  }

  return {
    labelKey: "seller.noRecentRiskSignal",
    descriptionKey: "seller.noRecentRiskDescription",
    className: "border-emerald-300 bg-emerald-50 text-emerald-950",
  };
}

function getInitials(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return "GG";
  }

  return trimmed.slice(0, 2).toUpperCase();
}

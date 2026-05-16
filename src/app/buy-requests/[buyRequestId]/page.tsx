import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import CountryText from "@/app/country-text";
import { GameMoneyPriceUnitText, GameMoneyQuantityText } from "@/app/game-money-unit-text";
import { MarketplaceHeader } from "@/app/marketplace-home";
import UserContentText, { SourceCountryFlag } from "@/app/user-content-text";
import BuyRequestOfferForm from "@/app/listings/buy-request-offer-form";
import { getMarketplaceBuyRequestDetail } from "@/lib/market/buy-requests";
import {
  formatGameMoneyQuantityWithUnit,
  getGameMoneyPriceUnitLabel,
  getTradeUnitLabel,
  normalizeGameMoneyPriceUnit,
  type MoneyUnitNameSource,
} from "@/lib/market/trade-unit";
import { normalizeAccountTransferType } from "@/lib/market/account-transfer-types";

export const dynamic = "force-dynamic";

type BuyRequestDetailPageProps = {
  params: Promise<{
    buyRequestId: string;
  }>;
};

export default async function BuyRequestDetailPage({
  params,
}: BuyRequestDetailPageProps) {
  const { buyRequestId } = await params;
  const request = await getMarketplaceBuyRequestDetail(buyRequestId);

  if (!request) {
    notFound();
  }

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
  const quantityLabel = getDisplayQuantity({
    category: request.category,
    quantity: request.quantity,
    priceUnitQuantity: request.priceUnitQuantity,
    moneyUnitName: request.moneyUnitName,
    fallbackUnit: moneyUnit,
  });
  const remainingQuantityLabel = getDisplayQuantity({
    category: request.category,
    quantity: request.remainingQuantity,
    priceUnitQuantity: request.priceUnitQuantity,
    moneyUnitName: request.moneyUnitName,
    fallbackUnit: moneyUnit,
  });
  const minimumQuantityLabel = getDisplayQuantity({
    category: request.category,
    quantity: request.minimumQuantity,
    priceUnitQuantity: request.priceUnitQuantity,
    moneyUnitName: request.moneyUnitName,
    fallbackUnit: moneyUnit,
  });
  const accountTransferTypeLabel =
    request.category === "GAME_ACCOUNT"
      ? normalizeAccountTransferType(request.accountTransferType)
      : null;
  const serverLabel = formatServerLabel(request.serverName, request.serverDetail);

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] text-[var(--gg-text)]">
      <MarketplaceHeader />

      <section className="mx-auto grid max-w-[1280px] gap-5 px-4 py-5 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--gg-muted)]">
          <Link href="/" className="hover:text-[var(--gg-accent)]">
            <CountryText id="common.home" />
          </Link>
          <span>/</span>
          <Link
            href={`/listings?mode=buy&game=${encodeURIComponent(request.gameName)}`}
            className="hover:text-[var(--gg-accent)]"
          >
            {request.gameName}
          </Link>
          <span>/</span>
          <span className="text-[var(--gg-text)]">
            <CountryText id="listings.buyRequestChip" />
          </span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="grid gap-5">
            <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 shadow-sm shadow-[var(--gg-shadow)]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>
                  <CountryText id="listings.buyRequestChip" />
                </Badge>
                <Badge>
                  <CategoryName category={request.category} />
                </Badge>
                <Badge>{request.gameName}</Badge>
                <Badge>{serverLabel || <CountryText id="listings.noServer" />}</Badge>
                {request.isPremium ? (
                  <Badge>
                    <CountryText id="listings.premiumBadge" />
                  </Badge>
                ) : null}
                <span className="ml-auto text-xs font-bold text-[var(--gg-muted)]">
                  <CountryText id="listings.createdPrefix" /> {request.createdAt}
                </span>
              </div>

              <h1 className="mt-5 text-3xl font-black leading-tight lg:text-4xl">
                <SourceCountryFlag text={request.title || request.description || request.gameName} />
                <UserContentText text={request.title || buildFallbackTitle(request)} showSourceFlag={false} />
              </h1>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <Metric
                  label={<CountryText id="listings.lockedTotal" />}
                  value={`${request.totalAmount} ${request.currency}`}
                  strong
                />
                <Metric
                  label={<CountryText id="listings.unitPriceShort" />}
                  value={`${priceDisplay.price} ${request.currency}`}
                  hint={
                    request.category === "GAME_MONEY" ? (
                      <GameMoneyPriceUnitText
                        priceUnitQuantity={request.priceUnitQuantity}
                        moneyUnitName={request.moneyUnitName}
                      />
                    ) : (
                      priceDisplay.unitLabel
                    )
                  }
                />
                <Metric
                  label={<CountryText id="listings.wanted" />}
                  value={
                    request.category === "GAME_MONEY" ? (
                      <>
                        <GameMoneyQuantityText
                          quantity={request.remainingQuantity}
                          priceUnitQuantity={request.priceUnitQuantity}
                          moneyUnitName={request.moneyUnitName}
                        />{" "}
                        /{" "}
                        <GameMoneyQuantityText
                          quantity={request.quantity}
                          priceUnitQuantity={request.priceUnitQuantity}
                          moneyUnitName={request.moneyUnitName}
                        />
                      </>
                    ) : (
                      `${remainingQuantityLabel} / ${quantityLabel}`
                    )
                  }
                />
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--gg-accent)]">
                <CountryText id="listingForm.buyCondition" />
              </p>
              <h2 className="mt-2 text-2xl font-black">
                <CountryText id="listingForm.tradeContent" />
              </h2>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <InfoTile label={<CountryText id="listingForm.buyMode" />} value={request.tradeMode === "BULK" ? <CountryText id="listingForm.bulkBuy" /> : <CountryText id="listingForm.splitBuy" />} />
                <InfoTile
                  label={<CountryText id="listings.minimum" />}
                  value={
                    request.category === "GAME_MONEY" ? (
                      <GameMoneyQuantityText
                        quantity={request.minimumQuantity}
                        priceUnitQuantity={request.priceUnitQuantity}
                        moneyUnitName={request.moneyUnitName}
                      />
                    ) : (
                      minimumQuantityLabel
                    )
                  }
                />
                <InfoTile label={<CountryText id="listings.offerCountPrefix" />} value={`${request.offerCount}`} />
                {accountTransferTypeLabel ? (
                  <InfoTile label={<CountryText id="listings.accountType" />} value={<AccountTransferTypeText value={accountTransferTypeLabel} />} />
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] p-5 text-sm leading-7 text-[var(--gg-muted)]">
                {request.accountRank ? (
                  <p className="mb-3 font-black text-[var(--gg-text)]">
                    <CountryText id="listingForm.accountSpec" />: {request.accountRank}
                  </p>
                ) : null}
                {request.description ? (
                  <UserContentText text={request.description} multiline className="whitespace-pre-wrap" />
                ) : (
                  <CountryText id="listingForm.buyDescriptionTooShort" />
                )}
              </div>

              {request.contentImages.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {request.contentImages.map((image, index) => (
                    <div
                      key={image.imageId}
                      className="overflow-hidden rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-control-bg)]"
                    >
                      <img
                        src={image.imageUrl}
                        alt={image.altText || request.title || request.gameName}
                        loading="lazy"
                        className="h-auto w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="flex flex-col gap-4 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
              <p className="text-sm font-black text-[var(--gg-muted)]">
                <CountryText id="listings.buyer" />
              </p>
              <p className="mt-2 text-xl font-black">{request.buyerName}</p>
              <div className="mt-4 grid gap-2 text-sm font-bold text-[var(--gg-muted)]">
                <p>{request.gameName}</p>
                <p>{serverLabel || <CountryText id="listings.noServer" />}</p>
                <p>
                  <CategoryName category={request.category} />
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5">
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-black text-sky-700">
                  <CountryText id="listingForm.summaryActualStoredQuantity" />
                </p>
                <p className="mt-1 text-lg font-black text-sky-900">
                  {request.category === "GAME_MONEY" ? (
                    <GameMoneyQuantityText
                      quantity={request.remainingQuantity}
                      priceUnitQuantity={request.priceUnitQuantity}
                      moneyUnitName={request.moneyUnitName}
                    />
                  ) : (
                    remainingQuantityLabel
                  )}
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
                priceUnitQuantity={request.priceUnitQuantity}
                priceUnitLabel={priceDisplay.unitLabel}
                totalAmount={offerTotalAmount}
                currency={request.currency}
                serverLabel={serverLabel || undefined}
              />
            </section>

            <Link
              href={`/listings?mode=buy&game=${encodeURIComponent(request.gameName)}`}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-center text-sm font-black hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            >
              <CountryText id="home.viewBuyRequests" />
            </Link>
          </aside>
        </section>
      </section>
    </main>
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
  moneyUnitName: MoneyUnitNameSource;
}) {
  if (category !== "GAME_MONEY") {
    return {
      price: unitPrice,
      unitLabel: typeof moneyUnitName === "string" ? moneyUnitName : "",
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

function getDisplayQuantity({
  category,
  quantity,
  priceUnitQuantity,
  moneyUnitName,
  fallbackUnit,
}: {
  category: string;
  quantity: string;
  priceUnitQuantity: string;
  moneyUnitName: MoneyUnitNameSource;
  fallbackUnit: string;
}) {
  if (category === "GAME_MONEY") {
    return formatGameMoneyQuantityWithUnit(quantity, priceUnitQuantity, moneyUnitName);
  }

  return `${quantity} ${fallbackUnit}`.trim();
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

function formatServerLabel(serverName?: string | null, serverDetail?: string | null) {
  if (!serverName) return "";
  return serverDetail ? `${serverName} ${serverDetail}` : serverName;
}

function buildFallbackTitle(request: { gameName: string; serverName: string | null }) {
  return `${request.gameName} ${request.serverName ?? ""}`.trim();
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--gg-card-soft-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
      <p className="text-xs font-bold text-[var(--gg-subtle)]">{label}</p>
      <p className={strong ? "mt-2 text-2xl font-black text-[var(--gg-accent)]" : "mt-2 text-xl font-black"}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs font-bold text-[var(--gg-muted)]">{hint}</p> : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
      <p className="text-xs font-bold text-[var(--gg-subtle)]">{label}</p>
      <p className="mt-2 text-sm font-black">{value}</p>
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

function AccountTransferTypeText({ value }: { value: string }) {
  if (value === "GOOGLE") return <CountryText id="account.google" />;
  if (value === "GAME_COMPANY") return <CountryText id="account.gameCompany" />;
  return <>{value}</>;
}

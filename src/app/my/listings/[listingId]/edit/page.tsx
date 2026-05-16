import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import CountryText from "@/app/country-text";
import type { TranslationKey } from "@/app/i18n";
import { getMarketplaceSellerListingEditorView } from "@/lib/market/my-listings";
import { formatGameMoneyQuantityWithUnit } from "@/lib/market/trade-unit";
import SellerListingActions from "../../seller-listing-actions";
import EditListingForm from "./edit-listing-form";

type SellerListingEditorView = NonNullable<
  Awaited<ReturnType<typeof getMarketplaceSellerListingEditorView>>
>;

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const listing = await getMarketplaceSellerListingEditorView(listingId);

  if (!listing) {
    notFound();
  }

  const isPubliclyVisible =
    listing.status === "ACTIVE" && Number(listing.availableQuantity) > 0;
  const statusGuide = getStatusGuide(listing.status, listing.availableQuantity);
  const inventorySummary = formatInventorySummary(listing);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 text-[var(--gg-text)]">
      <header className="flex flex-col gap-4 border-b border-[var(--gg-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">EDIT</p>
          <h1 className="mt-2 text-3xl font-black">{listing.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/my/listings"
            className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:bg-[var(--gg-control-bg)]"
          >
            <CountryText id="manage.mySellPosts" />
          </Link>
          {isPubliclyVisible ? (
            <Link
              href={`/listings/${listing.listingId}`}
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              <CountryText id="listingEdit.viewPublicListing" />
            </Link>
          ) : null}
        </div>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <SummaryCard
          label={<CountryText id="listingEdit.status" />}
          value={<CountryText id={getStatusKey(listing.status)} />}
        />
        <SummaryCard
          label={<CountryText id="listingForm.gameAndServer" />}
          value={
            listing.serverName
              ? `${listing.gameName} / ${listing.serverName}`
              : listing.gameName
          }
          emptySuffix={!listing.serverName ? <CountryText id="listingEdit.noServer" /> : null}
        />
        <SummaryCard
          label={<CountryText id="listingEdit.category" />}
          value={<CountryText id={getCategoryKey(listing.category)} />}
        />
        <SummaryCard label={<CountryText id="listingEdit.inventory" />} value={inventorySummary} />
      </section>

      <section className={`mt-6 rounded-2xl border p-5 ${statusGuide.className}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black">{statusGuide.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black">{statusGuide.title}</h2>
          </div>
          <div className="min-w-[180px] rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 text-sm font-bold text-[var(--gg-muted)]">
            <CountryText
              id={isPubliclyVisible ? "listingEdit.publicNow" : "listingEdit.hiddenFromList"}
            />
          </div>
        </div>
        <div className="mt-4">
          <SellerListingActions
            listingId={listing.listingId}
            status={listing.status}
            availableQuantity={listing.availableQuantity}
          />
        </div>
      </section>

      <section className="mt-6">
        <EditListingForm
          listingId={listing.listingId}
          currency={listing.currency}
          initialTitle={listing.title}
          initialDescription={listing.description ?? ""}
          initialCategory={listing.category}
          initialUnitPrice={listing.unitPrice}
          initialPriceUnitQuantity={listing.priceUnitQuantity}
          initialTradeMode={listing.tradeMode}
          moneyUnitName={listing.moneyUnitName}
          initialTotalQuantity={listing.totalQuantity}
          initialMinimumQuantity={listing.minimumQuantity}
          initialImages={listing.contentImages}
        />
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  emptySuffix,
}: {
  label: ReactNode;
  value: ReactNode;
  emptySuffix?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-xs font-bold text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-lg font-black">
        {value}
        {emptySuffix ? (
          <>
            {" / "}
            {emptySuffix}
          </>
        ) : null}
      </p>
    </div>
  );
}

function getStatusGuide(status: string, availableQuantity: string) {
  if (status === "ACTIVE" && Number(availableQuantity) > 0) {
    return {
      eyebrow: <CountryText id="listingEdit.statusActiveEyebrow" />,
      title: <CountryText id="listingEdit.statusActiveTitle" />,
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (status === "ACTIVE" && Number(availableQuantity) <= 0) {
    return {
      eyebrow: <CountryText id="listingEdit.statusNoStockEyebrow" />,
      title: <CountryText id="listingEdit.statusNoStockTitle" />,
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }

  if (status === "PAUSED") {
    return {
      eyebrow: <CountryText id="listingEdit.statusPausedEyebrow" />,
      title: <CountryText id="listingEdit.statusPausedTitle" />,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (status === "HIDDEN") {
    return {
      eyebrow: <CountryText id="listingEdit.statusHiddenEyebrow" />,
      title: <CountryText id="listingEdit.statusHiddenTitle" />,
      className: "border-slate-200 bg-slate-50 text-slate-800",
    };
  }

  if (status === "SOLD_OUT") {
    return {
      eyebrow: <CountryText id="listingEdit.statusSoldOutEyebrow" />,
      title: <CountryText id="listingEdit.statusSoldOutTitle" />,
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }

  return {
    eyebrow: <CountryText id="listingEdit.statusCheckEyebrow" />,
    title: <CountryText id="listingEdit.statusCheckTitle" />,
    className: "border-[var(--gg-border)] bg-[var(--gg-card-bg)] text-[var(--gg-text)]",
  };
}

function getStatusKey(status: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    ACTIVE: "manage.statusActiveSell",
    PAUSED: "manage.statusPaused",
    SOLD_OUT: "manage.soldOut",
    HIDDEN: "manage.statusHidden",
  };

  return labels[status] ?? "listingEdit.statusCheckEyebrow";
}

function getCategoryKey(category: string): TranslationKey {
  const labels: Record<string, TranslationKey> = {
    GAME_MONEY: "common.gameMoney",
    GAME_ITEM: "common.item",
    GAME_ACCOUNT: "common.account",
  };

  return labels[category] ?? "common.trade";
}

function formatInventorySummary(listing: SellerListingEditorView) {
  const quantities = [
    listing.availableQuantity,
    listing.lockedQuantity,
    listing.soldQuantity,
  ];

  if (listing.category !== "GAME_MONEY") {
    return quantities.join(" / ");
  }

  return quantities
    .map((quantity) =>
      formatGameMoneyQuantityWithUnit(
        quantity,
        listing.priceUnitQuantity,
        listing.moneyUnitName,
      ),
    )
    .join(" / ");
}

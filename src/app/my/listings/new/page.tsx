import type { ReactNode } from "react";
import Link from "next/link";
import CountryText from "@/app/country-text";
import {
  getMarketplaceMyListings,
  getMarketplaceSellerListingFormView,
} from "@/lib/market/my-listings";
import CreateListingForm from "./create-listing-form";

export default async function NewListingPage() {
  const [formView, listingsView] = await Promise.all([
    getMarketplaceSellerListingFormView(),
    getMarketplaceMyListings(),
  ]);
  const walletCurrency = listingsView.wallet?.currency ?? formView.currency;

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto max-w-[1180px] space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="manage.sellingEyebrow" />
            </p>
            <h1 className="mt-1 text-3xl font-black">
              <CountryText id="manage.createSell" />
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/my/listings"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-black hover:bg-[var(--gg-control-bg)]"
            >
              <CountryText id="manage.mySellPosts" />
            </Link>
            <Link
              href="/"
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              <CountryText id="common.backHome" />
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard
            label={<CountryText id="manage.selling" />}
            value={
              <>
                {listingsView.summary.activeListings}
                <CountryText id="manage.countSuffix" />
              </>
            }
          />
          <SummaryCard label={<CountryText id="listingForm.server" />} value={<CountryText id="manage.serverOnePerPost" />} />
          <SummaryCard
            label={<CountryText id="manage.holdingAmount" />}
            value={`${listingsView.wallet?.availableBalance ?? "0"} ${walletCurrency}`}
          />
        </section>

        <CreateListingForm
          currency={formView.currency}
          availableBalance={listingsView.wallet?.availableBalance ?? "0"}
          categoryOptions={formView.categoryOptions}
          games={formView.games}
        />
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-xs font-bold text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-black">{value}</p>
    </div>
  );
}

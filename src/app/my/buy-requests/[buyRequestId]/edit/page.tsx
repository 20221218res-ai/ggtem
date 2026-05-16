import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import CountryText from "@/app/country-text";
import { getMarketplaceMyBuyRequestEditorView } from "@/lib/market/buy-requests";
import EditBuyRequestForm from "./edit-buy-request-form";

export const dynamic = "force-dynamic";

export default async function EditBuyRequestPage({
  params,
}: {
  params: Promise<{ buyRequestId: string }>;
}) {
  const { buyRequestId } = await params;
  const request = await getMarketplaceMyBuyRequestEditorView(buyRequestId);

  if (!request || request.status !== "ACTIVE") {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 text-[var(--gg-text)]">
      <header className="flex flex-col gap-4 border-b border-[var(--gg-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--gg-accent)]">
            <CountryText id="common.buyModeShort" />
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {request.title || request.gameName}
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--gg-muted)]">
            {request.serverName ? `${request.gameName} / ${request.serverName}` : request.gameName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/my/buy-requests"
            className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black hover:bg-[var(--gg-control-bg)]"
          >
            <CountryText id="listingForm.viewMyBuyRequest" />
          </Link>
          <Link
            href={`/buy-requests/${request.buyRequestId}`}
            className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
          >
            <CountryText id="orderManage.detail" />
          </Link>
        </div>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <SummaryCard label={<CountryText id="listingEdit.status" />} value={<CountryText id="manage.statusActiveBuy" />} />
        <SummaryCard label={<CountryText id="listingForm.itemType" />} value={<CountryText id={getCategoryKey(request.category)} />} />
        <SummaryCard label={<CountryText id="manage.reserveAmount" />} value={`${request.lockAmount} ${request.currency}`} />
      </section>

      <section className="mt-6">
        <EditBuyRequestForm
          buyRequestId={request.buyRequestId}
          category={request.category}
          initialTitle={request.title ?? ""}
          initialDescription={request.description ?? ""}
          initialAccountRank={request.accountRank ?? ""}
          initialBuyerGameNickname={request.buyerGameNickname ?? ""}
          initialImages={request.contentImages}
        />
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-xs font-bold text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function getCategoryKey(category: string) {
  const labels = {
    GAME_MONEY: "common.gameMoney",
    GAME_ITEM: "common.item",
    GAME_ACCOUNT: "common.account",
  } as const;

  return labels[category as keyof typeof labels] ?? "common.trade";
}

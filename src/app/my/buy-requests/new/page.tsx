import Link from "next/link";
import { getMarketplaceBuyRequestFormView } from "@/lib/market/buy-requests";
import CreateBuyRequestForm from "./create-buy-request-form";

export default async function NewBuyRequestPage() {
  const formView = await getMarketplaceBuyRequestFormView();

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto max-w-[1180px] space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">BUY</p>
            <h1 className="mt-1 text-3xl font-black">구매 등록</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/my/buy-requests"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-black hover:bg-[var(--gg-control-bg)]"
            >
              내 구매글
            </Link>
            <Link
              href="/listings?mode=buy"
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              구매글 보기
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="방식" value="판매자가 즉시 판매" />
          <SummaryCard label="서버" value="글마다 1개" />
          <SummaryCard label="예약금" value="잔액에서 잠금" />
        </section>

        <CreateBuyRequestForm
          currency={formView.currency}
          wallet={formView.wallet}
          categoryOptions={formView.categoryOptions}
          games={formView.games}
        />
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-xs font-bold text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

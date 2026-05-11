import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketplaceSellerListingEditorView } from "@/lib/market/my-listings";
import SellerListingActions from "../../seller-listing-actions";
import EditListingForm from "./edit-listing-form";

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
            내 판매글
          </Link>
          {isPubliclyVisible ? (
            <Link
              href={`/listings/${listing.listingId}`}
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
            >
              공개 매물 보기
            </Link>
          ) : null}
        </div>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <SummaryCard label="상태" value={formatStatus(listing.status)} />
        <SummaryCard
          label="게임 / 서버"
          value={`${listing.gameName} / ${listing.serverName ?? "서버 없음"}`}
        />
        <SummaryCard label="품목" value={formatCategory(listing.category)} />
        <SummaryCard
          label="재고"
          value={`${listing.availableQuantity} / ${listing.lockedQuantity} / ${listing.soldQuantity}`}
        />
      </section>

      <section className={`mt-6 rounded-2xl border p-5 ${statusGuide.className}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black">{statusGuide.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black">{statusGuide.title}</h2>
          </div>
          <div className="min-w-[180px] rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 text-sm font-bold text-[var(--gg-muted)]">
            {isPubliclyVisible ? "공개 중" : "목록 숨김"}
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
          initialTotalQuantity={listing.totalQuantity}
          initialImageUrl={listing.primaryImageUrl}
          initialImageAlt={listing.primaryImageAlt ?? ""}
        />
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <p className="text-xs font-bold text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function getStatusGuide(status: string, availableQuantity: string) {
  if (status === "ACTIVE" && Number(availableQuantity) > 0) {
    return {
      eyebrow: "판매중",
      title: "공개 목록에 노출 중입니다.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (status === "ACTIVE" && Number(availableQuantity) <= 0) {
    return {
      eyebrow: "재고 없음",
      title: "판매 가능 수량이 없어 목록에서 숨겨집니다.",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }

  if (status === "PAUSED") {
    return {
      eyebrow: "일시중지",
      title: "판매자가 판매를 멈춘 상태입니다.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (status === "HIDDEN") {
    return {
      eyebrow: "숨김",
      title: "공개 목록에서 숨겨진 판매글입니다.",
      className: "border-slate-200 bg-slate-50 text-slate-800",
    };
  }

  if (status === "SOLD_OUT") {
    return {
      eyebrow: "판매완료",
      title: "더 이상 공개 판매하지 않는 글입니다.",
      className: "border-sky-200 bg-sky-50 text-sky-800",
    };
  }

  return {
    eyebrow: "상태 확인",
    title: "판매글 상태를 확인해 주세요.",
    className: "border-[var(--gg-border)] bg-[var(--gg-card-bg)] text-[var(--gg-text)]",
  };
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "판매중",
    PAUSED: "일시중지",
    SOLD_OUT: "판매완료",
    HIDDEN: "숨김",
  };

  return labels[status] ?? status;
}

function formatCategory(category: string) {
  const labels: Record<string, string> = {
    GAME_MONEY: "게임머니",
    GAME_ITEM: "아이템",
    GAME_ACCOUNT: "계정",
  };

  return labels[category] ?? category;
}

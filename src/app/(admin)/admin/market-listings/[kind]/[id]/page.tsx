import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminMarketListingDetail } from "@/lib/admin/market-listings";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { FormSubmitButton } from "../../../form-submit-button";
import { cancelBuyRequestByAdminAction, moderateSellerListingAction } from "../../actions";

type AdminMarketListingDetailPageProps = {
  params: Promise<{
    kind: string;
    id: string;
  }>;
};

export default async function AdminMarketListingDetailPage({
  params,
}: AdminMarketListingDetailPageProps) {
  await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const { kind, id } = await params;
  if (kind !== "sell" && kind !== "buy") {
    notFound();
  }

  const detail = await getAdminMarketListingDetail(kind, id);
  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f3f6fa] px-5 py-6 text-slate-950">
      <section className="mx-auto max-w-[1500px] space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-wide text-[var(--color-primary)]">
                {detail.kind === "sell" ? "SELL LISTING" : "BUY REQUEST"}
              </p>
              <h1 className="mt-1 break-words text-3xl font-black tracking-tight">
                {detail.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={detail.kind === "sell" ? "cyan" : "amber"}>
                  {detail.kind === "sell" ? "판매글" : "구매글"}
                </Badge>
                <Badge tone={detail.status === "ACTIVE" ? "green" : "slate"}>
                  {detail.status}
                </Badge>
                <Badge tone="slate">{formatCategoryLabel(detail.category)}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <HeaderLink href="/admin/market-listings" label="목록" />
              <HeaderLink href={detail.auditHref} label="감사 로그" />
              <HeaderLink href={detail.userHref} label="작성자" />
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            <Panel title="등록 정보">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Info label="작성자" value={`${detail.ownerName} / ${detail.ownerEmail}`} />
                <Info label="게임" value={detail.gameName} />
                <Info label="서버" value={detail.serverDetail || detail.serverName} />
                <Info label="거래 방식" value={formatTradeMode(detail.tradeMode, detail.kind)} />
                <Info label="가격 기준 단위" value={detail.priceUnitQuantity} />
                <Info label="단가" value={`${detail.unitPrice} ${detail.currency}`} />
                <Info label="등록일" value={detail.createdAt} />
                <Info label="수정일" value={detail.updatedAt} />
                <Info label="프리미엄 시작" value={detail.premiumStartedAt} />
                <Info label="프리미엄 만료" value={detail.premiumEndsAt} />
                {detail.gameNickname ? <Info label="게임 ID" value={detail.gameNickname} /> : null}
                {detail.accountTransferType ? (
                  <Info label="계정 종류" value={detail.accountTransferType} />
                ) : null}
                {detail.kind === "buy" && detail.accountRank ? (
                  <Info label="계정 등급" value={detail.accountRank} />
                ) : null}
              </div>
            </Panel>

            {detail.kind === "sell" ? <SellQuantityPanel detail={detail} /> : <BuyQuantityPanel detail={detail} />}

            <Panel title="본문">
              {detail.description ? (
                <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-700">
                  {detail.description}
                </p>
              ) : (
                <EmptyState label="본문 내용 없음" />
              )}
            </Panel>

            <Panel title={`본문 이미지 ${detail.images.length.toLocaleString("ko-KR")}장`}>
              {detail.images.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {detail.images.map((image) => (
                    <a
                      key={image.id}
                      href={image.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.imageUrl}
                        alt={image.altText}
                        className="h-64 w-full object-contain"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState label="본문 이미지 없음" />
              )}
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="운영 조치">
              {detail.kind === "sell" ? (
                <form action={moderateSellerListingAction} className="grid gap-3">
                  <input type="hidden" name="listingId" value={detail.id} />
                <select name="nextStatus" defaultValue="HIDDEN" className={inputClass}>
                  <option value="HIDDEN">숨김</option>
                  <option value="PAUSED">중지</option>
                </select>
                  <input name="reason" className={inputClass} placeholder="조치 사유" />
                  <FormSubmitButton className="rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-black text-black">
                    저장
                  </FormSubmitButton>
                </form>
              ) : detail.actionLocked ? (
                <form action={cancelBuyRequestByAdminAction} className="grid gap-3">
                  <input type="hidden" name="buyRequestId" value={detail.id} />
                  <input name="reason" className={inputClass} placeholder="취소/환불 사유" />
                  <FormSubmitButton className="rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white">
                    구매글 취소 + 환불
                  </FormSubmitButton>
                </form>
              ) : (
                <EmptyState label="현재 상태에서는 즉시 조치할 항목이 없습니다." />
              )}
            </Panel>

            <Panel title="운영 신호">
              <div className="grid gap-3">
                <Info label={detail.kind === "sell" ? "주문" : "제안"} value={`${detail.offerCount}건`} />
                {detail.kind === "sell" ? (
                  <>
                    <Info label="전체 주문" value={`${detail.orderCount}건`} />
                    <Info label="진행 주문" value={`${detail.activeOrderCount}건`} />
                    <Info label="분쟁 주문" value={`${detail.disputeOrderCount}건`} />
                    <Info
                      label="잠긴 재고"
                      value={`${detail.lockedQuantity}`}
                      tone={Number(detail.lockedQuantity) > 0 ? "amber" : "slate"}
                    />
                  </>
                ) : null}
                <Info label="본문 이미지" value={`${detail.images.length}장`} />
                <Info label="ID" value={detail.id} breakAll />
              </div>
            </Panel>
          </aside>
        </section>
      </section>
    </main>
  );
}

function SellQuantityPanel({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getAdminMarketListingDetail>>> & { kind: "sell" };
}) {
  return (
    <Panel title="판매 수량">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Info label="총 수량" value={detail.totalQuantity} />
        <Info label="최소 수량" value={detail.minimumQuantity} />
        <Info label="구매 가능" value={detail.availableQuantity} />
        <Info label="잠금" value={detail.lockedQuantity} />
        <Info label="판매 완료" value={detail.soldQuantity} />
      </div>
    </Panel>
  );
}

function BuyQuantityPanel({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getAdminMarketListingDetail>>> & { kind: "buy" };
}) {
  return (
    <Panel title="구매 수량">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label="요청 수량" value={detail.quantity} />
        <Info label="최소 수량" value={detail.minimumQuantity} />
        <Info label="남은 수량" value={detail.remainingQuantity} />
        <Info label="만료" value={detail.expiresAt} />
        <Info label="총액" value={`${detail.totalAmount} ${detail.currency}`} />
        <Info label="잠금액" value={`${detail.lockAmount} ${detail.currency}`} />
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function Info({
  label,
  value,
  breakAll = false,
  tone = "slate",
}: {
  label: string;
  value: string;
  breakAll?: boolean;
  tone?: "slate" | "amber";
}) {
  const toneClass =
    tone === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-black text-slate-950 ${breakAll ? "break-all" : "break-words"}`}>
        {value || "-"}
      </p>
    </div>
  );
}

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      {label}
    </Link>
  );
}

function Badge({ tone, children }: { tone: "green" | "slate" | "cyan" | "amber"; children: ReactNode }) {
  const classes = {
    green: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    cyan: "bg-sky-100 text-[var(--color-primary)]",
    amber: "bg-amber-100 text-amber-700",
  };
  return <span className={`rounded px-2 py-1 text-xs font-black ${classes[tone]}`}>{children}</span>;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm font-black text-slate-500">
      {label}
    </div>
  );
}

function formatCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    GAME_MONEY: "게임머니",
    GAME_ITEM: "아이템",
    GAME_ACCOUNT: "계정",
  };

  return labels[category] ?? category;
}

function formatTradeMode(value: string, kind: "sell" | "buy") {
  if (value === "BULK") return kind === "sell" ? "일괄판매" : "일괄구매";
  if (value === "SPLIT") return kind === "sell" ? "분할판매" : "분할구매";
  return value;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-950 outline-none focus:border-[var(--color-primary)]";

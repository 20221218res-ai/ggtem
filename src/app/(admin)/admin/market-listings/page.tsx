import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminMarketListingsState } from "@/lib/admin/market-listings";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { FormSubmitButton } from "../form-submit-button";
import { cancelBuyRequestByAdminAction, moderateSellerListingAction } from "./actions";

type AdminMarketListingsPageProps = {
  searchParams?: Promise<{
    mode?: string;
    status?: string;
    category?: string;
    query?: string;
    notice?: string;
    error?: string;
  }>;
};

type State = Awaited<ReturnType<typeof getAdminMarketListingsState>>;
type SellerListingRow = State["listings"][number];
type BuyRequestRow = State["buyRequests"][number];

export default async function AdminMarketListingsPage({
  searchParams,
}: AdminMarketListingsPageProps) {
  await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const params = searchParams ? await searchParams : {};
  const state = await getAdminMarketListingsState(params);
  const reviewCount =
    state.summary.sellHidden + state.summary.sellRemoved + state.summary.buyActive;

  return (
    <main className="min-h-screen bg-[#f3f6fa] px-5 py-6 text-slate-950">
      <section className="mx-auto max-w-[1720px] space-y-4">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--color-primary)]">
              MARKET CONTROL
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">거래글 관리</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/admin/market-listings?mode=SELL&status=ACTIVE">판매중</QuickLink>
            <QuickLink href="/admin/market-listings?mode=BUY&status=ACTIVE">구매중</QuickLink>
            <QuickLink href="/admin/audit?targetType=LISTING">감사</QuickLink>
          </div>
        </header>

        {params.notice === "moderated" ? (
          <Banner tone="success">거래글 조치 완료</Banner>
        ) : null}
        {params.notice === "buy-request-canceled" ? (
          <Banner tone="success">구매글 취소와 예약금 환불 완료</Banner>
        ) : null}
        {params.error ? <Banner tone="error">{params.error}</Banner> : null}

        <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-amber-700">다음 액션</p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                검토 대상 {reviewCount.toLocaleString("ko-KR")}건
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton href="/admin/market-listings?mode=SELL&status=HIDDEN">
                숨김 판매글
              </ActionButton>
              <ActionButton href="/admin/market-listings?mode=BUY&status=ACTIVE">
                구매글 환불
              </ActionButton>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="판매 전체" value={state.summary.sellTotal} />
          <Metric label="판매중" value={state.summary.sellActive} tone="green" />
          <Metric label="숨김" value={state.summary.sellHidden} tone="amber" />
          <Metric label="삭제 처리" value={state.summary.sellRemoved} tone="red" />
          <Metric label="구매 전체" value={state.summary.buyTotal} />
          <Metric label="구매중" value={state.summary.buyActive} tone="green" />
          <Metric label="수락됨" value={state.summary.buyAccepted} tone="cyan" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <form className="grid gap-2 lg:grid-cols-[130px_150px_150px_1fr_96px]">
            <select name="mode" defaultValue={state.filters.mode} className={inputClass}>
              <option value="ALL">전체</option>
              <option value="SELL">판매글</option>
              <option value="BUY">구매글</option>
            </select>
            <select name="status" defaultValue={state.filters.status} className={inputClass}>
              <option value="ALL">전체 상태</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="SOLD_OUT">SOLD_OUT</option>
              <option value="HIDDEN">HIDDEN</option>
              <option value="REMOVED">REMOVED</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="CANCELED">CANCELED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            <select name="category" defaultValue={state.filters.category} className={inputClass}>
              <option value="ALL">전체 품목</option>
              <option value="GAME_MONEY">게임머니</option>
              <option value="GAME_ITEM">아이템</option>
              <option value="GAME_ACCOUNT">계정</option>
            </select>
            <input
              name="query"
              defaultValue={state.filters.query}
              className={inputClass}
              placeholder="제목, ID, 유저, 게임, 서버"
            />
            <button className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-black text-black">
              검색
            </button>
          </form>
        </section>

        {state.filters.mode !== "BUY" ? (
          <Panel title={`판매글 ${state.listings.length.toLocaleString("ko-KR")}건`}>
            <div className="divide-y divide-slate-100">
              {state.listings.map((listing) => (
                <SellerListingRow key={listing.id} listing={listing} />
              ))}
              {state.listings.length === 0 ? <EmptyState label="판매글 없음" /> : null}
            </div>
          </Panel>
        ) : null}

        {state.filters.mode !== "SELL" ? (
          <Panel title={`구매글 ${state.buyRequests.length.toLocaleString("ko-KR")}건`}>
            <div className="divide-y divide-slate-100">
              {state.buyRequests.map((request) => (
                <BuyRequestRow key={request.id} request={request} />
              ))}
              {state.buyRequests.length === 0 ? <EmptyState label="구매글 없음" /> : null}
            </div>
          </Panel>
        ) : null}
      </section>
    </main>
  );
}

function SellerListingRow({ listing }: { listing: SellerListingRow }) {
  return (
    <article className="grid gap-3 py-4 xl:grid-cols-[1fr_560px]">
      <ListingMain
        kind="판매"
        title={listing.title}
        status={listing.status}
        category={listing.category}
        ownerName={listing.ownerName}
        createdAt={listing.createdAt}
        price={`${listing.price} ${listing.currency}`}
        href={listing.href}
        auditHref={listing.auditHref}
        badges={[
          listing.gameName,
          listing.serverName,
          `주문 ${listing.orderCount}`,
          `이미지 ${listing.imageCount}`,
          listing.isPremium ? "프리미엄" : "",
        ]}
      />
      <form action={moderateSellerListingAction} className="grid gap-2 lg:grid-cols-[130px_1fr_78px_78px]">
        <input type="hidden" name="listingId" value={listing.id} />
        <select name="nextStatus" defaultValue="HIDDEN" className={inputClass}>
          <option value="HIDDEN">숨김</option>
          <option value="REMOVED">삭제 처리</option>
          <option value="PAUSED">중지</option>
          <option value="ACTIVE">복구</option>
        </select>
        <input name="reason" className={inputClass} placeholder="조치 사유" />
        <FormSubmitButton className="rounded-lg bg-slate-950 px-3 py-2.5 text-sm font-black text-white">
          저장
        </FormSubmitButton>
        <Link href={listing.href} className="rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-black">
          보기
        </Link>
      </form>
    </article>
  );
}

function BuyRequestRow({ request }: { request: BuyRequestRow }) {
  return (
    <article className="grid gap-3 py-4 xl:grid-cols-[1fr_360px]">
      <ListingMain
        kind="구매"
        title={request.title}
        status={request.status}
        category={request.category}
        ownerName={request.ownerName}
        createdAt={request.createdAt}
        price={`${request.price} ${request.currency}`}
        href={request.href}
        auditHref={request.auditHref}
        badges={[
          `총액 ${request.totalAmount} ${request.currency}`,
          `잠금 ${request.lockAmount} ${request.currency}`,
          `제안 ${request.offerCount}`,
          `이미지 ${request.imageCount}`,
          request.isPremium ? "프리미엄" : "",
        ]}
      />
      {request.actionLocked ? (
        <form action={cancelBuyRequestByAdminAction} className="grid gap-2 lg:grid-cols-[1fr_150px]">
          <input type="hidden" name="buyRequestId" value={request.id} />
          <input name="reason" className={inputClass} placeholder="취소/환불 사유" />
          <FormSubmitButton className="rounded-lg bg-red-600 px-3 py-2.5 text-sm font-black text-white">
            취소 + 환불
          </FormSubmitButton>
        </form>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-600">
          조치 불가
        </div>
      )}
    </article>
  );
}

function ListingMain({
  kind,
  title,
  status,
  category,
  ownerName,
  createdAt,
  price,
  href,
  auditHref,
  badges,
}: {
  kind: string;
  title: string;
  status: string;
  category: string;
  ownerName: string;
  createdAt: string;
  price: string;
  href: string;
  auditHref: string;
  badges: string[];
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={kind === "판매" ? "cyan" : "amber"}>{kind}</Pill>
        <Pill tone={status === "ACTIVE" ? "green" : status === "REMOVED" ? "red" : "slate"}>
          {status}
        </Pill>
        <Pill tone="slate">{category}</Pill>
      </div>
      <h2 className="mt-2 truncate text-lg font-black">{title}</h2>
      <p className="mt-1 text-sm font-bold text-slate-500">
        {ownerName} / {createdAt} / {price}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {badges.filter(Boolean).map((badge) => (
          <span key={badge} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
            {badge}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <Link href={href} className="text-sm font-black text-[var(--color-primary)]">
          유저 화면
        </Link>
        <Link href={auditHref} className="text-sm font-black text-slate-500">
          감사 로그
        </Link>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: number;
  tone?: "blue" | "green" | "amber" | "red" | "cyan";
}) {
  const colors = {
    blue: "text-blue-700",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
    cyan: "text-[var(--color-primary)]",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colors[tone]}`}>{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function QuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm">
      {children}
    </Link>
  );
}

function ActionButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-black text-white">
      {children}
    </Link>
  );
}

function Banner({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <div
      className={`rounded-lg border-l-4 px-4 py-3 text-sm font-black ${
        tone === "success"
          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
          : "border-red-500 bg-red-50 text-red-800"
      }`}
    >
      {children}
    </div>
  );
}

function Pill({ tone, children }: { tone: "green" | "slate" | "cyan" | "amber" | "red"; children: ReactNode }) {
  const classes = {
    green: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    cyan: "bg-sky-100 text-[var(--color-primary)]",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
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

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-950 outline-none focus:border-[var(--color-primary)]";

import Link from "next/link";
import UserMarketHeader from "@/app/user-market-header";
import {
  getCustomerCenterDocuments,
  getCustomerCenterTypes,
  type CustomerCenterType,
} from "@/lib/support/customer-center";

const tabs = [
  { key: "notice", label: "공지사항", type: "NOTICE" },
  { key: "faq", label: "자주묻는질문", type: "FAQ" },
  { key: "inquiry", label: "1:1문의", type: null },
  { key: "policy", label: "회원정책", type: "POLICY" },
  { key: "paid", label: "유료 서비스", type: "PAID_SERVICE" },
  { key: "game-request", label: "신규 게임 / 서버 신청", type: "GAME_SERVER_REQUEST" },
] satisfies Array<{ key: string; label: string; type: CustomerCenterType | null }>;

export default async function CustomerCenterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const selectedTab = typeof params.tab === "string" ? params.tab : "notice";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const selected = tabs.find((tab) => tab.key === selectedTab) ?? tabs[0];
  const documents = await getCustomerCenterDocuments();
  const visibleDocuments = selected.type
    ? documents.filter((document) => document.type === selected.type)
    : [];
  const searchedDocuments = query
    ? visibleDocuments.filter((document) =>
        `${document.title} ${document.body}`.toLowerCase().includes(query.toLowerCase()),
      )
    : visibleDocuments;

  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] text-[var(--gg-text)]">
      <UserMarketHeader />
      <section className="mx-auto grid max-w-[1360px] gap-6 px-5 py-8 lg:grid-cols-[230px_1fr] lg:px-8">
        <CustomerSidebar />

        <section className="min-w-0 space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-black text-[var(--gg-accent)]">CUSTOMER CENTER</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">고객센터</h1>
          </div>

          <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={`/support?tab=${tab.key}`}
                prefetch={false}
                className={`rounded-lg border px-4 py-3 text-center text-sm font-black transition ${
                  selected.key === tab.key
                    ? "border-[var(--gg-accent)] bg-[var(--gg-accent)] text-white"
                    : "border-[var(--gg-border)] bg-white text-slate-950 hover:border-[var(--gg-accent)]"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {selected.key === "faq" ? (
            <FaqSearch query={query} />
          ) : null}

          {selected.key === "inquiry" ? (
            <InquiryPanel />
          ) : selected.key === "game-request" ? (
            <GameRequestPanel documents={searchedDocuments} />
          ) : (
            <DocumentList title={selected.label} documents={searchedDocuments} />
          )}
        </section>
      </section>
    </main>
  );
}

function CustomerSidebar() {
  return (
    <aside className="space-y-6 rounded-lg border border-[var(--gg-border)] bg-white p-5 shadow-sm lg:sticky lg:top-32 lg:self-start">
      <div>
        <h2 className="text-xl font-black">고객센터</h2>
        <div className="mt-4 grid gap-2 text-sm font-black">
          {tabs.map((tab) => (
            <Link key={tab.key} href={`/support?tab=${tab.key}`} prefetch={false} className="py-1 hover:text-[var(--gg-accent)]">
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--gg-border)] pt-5">
        <p className="text-sm font-black text-slate-500">고객지원센터</p>
        <p className="mt-2 text-2xl font-black text-slate-950">온라인 문의</p>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
          충전, 출금, 분쟁, 계정 거래 문의는 로그인 후 주문/지갑 화면에서 접수하면 더 빠르게 확인할 수 있습니다.
        </p>
      </div>
      <Link
        href="/my/chat"
        prefetch={false}
        className="block rounded-lg bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-white"
      >
        채팅 문의 보기
      </Link>
    </aside>
  );
}

function FaqSearch({ query }: { query: string }) {
  return (
    <form action="/support" className="rounded-lg border border-[var(--gg-border)] bg-white p-4">
      <input type="hidden" name="tab" value="faq" />
      <label className="sr-only" htmlFor="support-search">FAQ 검색</label>
      <input
        id="support-search"
        name="q"
        defaultValue={query}
        placeholder="궁금하신 내용을 검색해 주세요."
        className="h-12 w-full rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
      />
    </form>
  );
}

function DocumentList({
  title,
  documents,
}: {
  title: string;
  documents: Array<{ slug: string; typeLabel: string; title: string; body: string; updatedAt: string }>;
}) {
  return (
    <section className="rounded-lg border border-[var(--gg-border)] bg-white">
      <div className="border-b border-[var(--gg-border)] px-5 py-4">
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      <div className="divide-y divide-[var(--gg-border)]">
        {documents.length ? (
          documents.map((document) => (
            <details key={document.slug} className="group px-5 py-4">
              <summary className="grid cursor-pointer gap-3 text-sm font-black text-slate-950 sm:grid-cols-[120px_1fr_90px]">
                <span className="text-[var(--gg-accent)]">{document.typeLabel}</span>
                <span>{document.title}</span>
                <span className="text-right text-slate-500">{document.updatedAt}</span>
              </summary>
              <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-700">
                {document.body}
              </p>
            </details>
          ))
        ) : (
          <p className="px-5 py-10 text-sm font-bold text-slate-500">등록된 내용이 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function InquiryPanel() {
  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-[var(--gg-border)] bg-white p-6">
        <h2 className="text-xl font-black">1:1 문의</h2>
        <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
          돈이 이동하는 충전, 출금, 분쟁, 계정 거래 문의는 관련 주문이나 지갑 내역과 함께 접수되어야 합니다.
          현재는 채팅/주문 화면을 통해 문의를 남기면 운영자가 확인합니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/my/orders" prefetch={false} className="rounded-lg border border-[var(--gg-border)] px-4 py-3 text-sm font-black">
            주문 문의
          </Link>
          <Link href="/my/wallet" prefetch={false} className="rounded-lg border border-[var(--gg-border)] px-4 py-3 text-sm font-black">
            지갑 문의
          </Link>
          <Link href="/my/chat" prefetch={false} className="rounded-lg bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-white">
            채팅 문의
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["입금자명과 회원명이 달라요", "출금 처리가 되지 않아요", "마일리지 충전이 되지 않아요"].map((title, index) => (
          <div key={title} className="rounded-lg border border-[var(--gg-border)] bg-white p-5">
            <span className="rounded bg-[color-mix(in_srgb,var(--gg-accent)_18%,white)] px-2 py-1 text-xs font-black text-[var(--gg-accent)]">
              TOP {index + 1}
            </span>
            <p className="mt-4 text-sm font-black leading-6">{title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GameRequestPanel({
  documents,
}: {
  documents: Array<{ slug: string; typeLabel: string; title: string; body: string; updatedAt: string }>;
}) {
  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-[var(--gg-border)] bg-white p-6">
        <h2 className="text-xl font-black">게임 / 서버 신청</h2>
        <form className="mt-6 grid gap-4 sm:grid-cols-[180px_1fr]">
          <label className="text-sm font-black" htmlFor="request-kind">신청 종류</label>
          <select id="request-kind" className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold">
            <option>선택</option>
            <option>신규 게임 신청</option>
            <option>신규 서버 신청</option>
            <option>게임 정보 수정</option>
          </select>
          <label className="text-sm font-black" htmlFor="request-title">신청 내용</label>
          <input id="request-title" className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold" placeholder="게임명, 서버명, 참고 링크를 입력해 주세요." />
        </form>
        <p className="mt-4 text-xs font-bold leading-6 text-slate-500">
          신청 저장 기능은 다음 묶음에서 로그인 계정 기반 접수함으로 연결할 예정입니다.
        </p>
      </div>
      <DocumentList title="신청 안내" documents={documents} />
    </section>
  );
}

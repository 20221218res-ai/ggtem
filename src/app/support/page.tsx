import Link from "next/link";
import { redirect } from "next/navigation";
import UserMarketHeader from "@/app/user-market-header";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { sendAdminTelegramAlert } from "@/lib/notifications/telegram";
import { getPrismaClient } from "@/lib/prisma";
import {
  getCustomerCenterDocuments,
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

const inquiryCategories = [
  { value: "WALLET", label: "충전/출금" },
  { value: "ORDER", label: "주문/거래" },
  { value: "DISPUTE", label: "분쟁/신고" },
  { value: "ACCOUNT", label: "계정" },
  { value: "GAME_SERVER", label: "게임/서버" },
  { value: "OTHER", label: "기타" },
] as const;

export default async function CustomerCenterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const selectedTab = typeof params.tab === "string" ? params.tab : "notice";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const selected = tabs.find((tab) => tab.key === selectedTab) ?? tabs[0];
  const currentUser = await getCurrentSessionUser();
  const prisma = getPrismaClient();
  const [documents, myInquiries] = await Promise.all([
    getCustomerCenterDocuments(),
    selectedTab === "inquiry" && currentUser
      ? prisma.supportInquiry.findMany({
          where: { userId: currentUser.userId },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
  ]);
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
            <InquiryPanel
              isSignedIn={Boolean(currentUser)}
              submitted={params.submitted === "1"}
              inquiries={myInquiries.map((inquiry) => ({
                id: inquiry.id,
                category: inquiry.category,
                title: inquiry.title,
                status: inquiry.status,
                adminNote: inquiry.adminNote,
                createdAt: formatSupportDate(inquiry.createdAt),
              }))}
            />
          ) : selected.key === "game-request" ? (
            <GameRequestPanel
              documents={searchedDocuments}
              isSignedIn={Boolean(currentUser)}
              submitted={params.submitted === "1"}
            />
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

function InquiryPanel({
  isSignedIn,
  submitted,
  inquiries,
}: {
  isSignedIn: boolean;
  submitted: boolean;
  inquiries: Array<{
    id: string;
    category: string;
    title: string;
    status: string;
    adminNote: string | null;
    createdAt: string;
  }>;
}) {
  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-[var(--gg-border)] bg-white p-6">
        <h2 className="text-xl font-black">1:1 문의</h2>
        <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
          충전, 출금, 분쟁, 계정 거래처럼 운영자 확인이 필요한 내용을 접수하세요.
          접수 즉시 운영자 텔레그램과 어드민 문의함에 표시됩니다.
        </p>
        {submitted ? (
          <div className="mt-5 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800">
            문의가 접수되었습니다. 운영자가 확인 후 답변 메모를 남깁니다.
          </div>
        ) : null}
        {isSignedIn ? (
          <form action={createSupportInquiryAction} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-black">
              문의 종류
              <select name="category" className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold">
                {inquiryCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black">
              제목
              <input
                name="title"
                required
                minLength={2}
                maxLength={100}
                placeholder="문의 제목을 입력해 주세요."
                className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              내용
              <textarea
                name="body"
                required
                minLength={10}
                maxLength={2000}
                rows={6}
                placeholder="주문번호, 지갑 요청번호, 상황 설명을 함께 적어 주세요."
                className="rounded-lg border border-[var(--gg-border)] px-4 py-3 text-sm font-bold leading-6"
              />
            </label>
            <button type="submit" className="h-12 rounded-lg bg-[var(--gg-accent)] px-4 text-sm font-black text-white">
              문의 접수
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-lg border border-[var(--gg-border)] bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-600">1:1 문의 접수는 로그인 후 이용할 수 있습니다.</p>
            <Link
              href="/sign-in?next=/support?tab=inquiry"
              prefetch={false}
              className="mt-3 inline-flex rounded-lg bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-white"
            >
              로그인하고 문의하기
            </Link>
          </div>
        )}
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
      {isSignedIn ? (
        <section className="rounded-lg border border-[var(--gg-border)] bg-white">
          <div className="border-b border-[var(--gg-border)] px-5 py-4">
            <h3 className="text-lg font-black">내 문의 내역</h3>
          </div>
          <div className="divide-y divide-[var(--gg-border)]">
            {inquiries.length ? (
              inquiries.map((inquiry) => (
                <div key={inquiry.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[110px_1fr_100px]">
                  <span className="font-black text-[var(--gg-accent)]">{inquiryCategoryLabel(inquiry.category)}</span>
                  <div>
                    <p className="font-black text-slate-950">{inquiry.title}</p>
                    {inquiry.adminNote ? (
                      <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
                        운영자 답변: {inquiry.adminNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-700">{supportInquiryStatusLabel(inquiry.status)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{inquiry.createdAt}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-8 text-sm font-bold text-slate-500">아직 접수한 문의가 없습니다.</p>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function GameRequestPanel({
  documents,
  isSignedIn,
  submitted,
}: {
  documents: Array<{ slug: string; typeLabel: string; title: string; body: string; updatedAt: string }>;
  isSignedIn: boolean;
  submitted: boolean;
}) {
  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-[var(--gg-border)] bg-white p-6">
        <h2 className="text-xl font-black">게임 / 서버 신청</h2>
        <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
          원하는 게임이나 서버가 목록에 없으면 이곳에서 신청하세요. 접수 즉시 운영자 문의함과 텔레그램에 표시됩니다.
        </p>
        {submitted ? (
          <div className="mt-5 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800">
            게임/서버 신청이 접수되었습니다. 운영자가 검토 후 반영 여부를 답변합니다.
          </div>
        ) : null}
        {isSignedIn ? (
          <form action={createGameServerRequestAction} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-black">
              신청 종류
              <select name="requestKind" className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold">
                <option value="신규 게임 신청">신규 게임 신청</option>
                <option value="신규 서버 신청">신규 서버 신청</option>
                <option value="게임 정보 수정">게임 정보 수정</option>
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                게임명
                <input
                  name="gameName"
                  required
                  minLength={2}
                  maxLength={80}
                  className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
                  placeholder="예: 리니지 클래식"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                서버명
                <input
                  name="serverName"
                  maxLength={80}
                  className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
                  placeholder="신규 서버 신청일 때 입력"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-black">
              참고 링크
              <input
                name="referenceUrl"
                maxLength={300}
                className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
                placeholder="공식 홈페이지나 서버 공지 링크"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              요청 사유
              <textarea
                name="body"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                className="rounded-lg border border-[var(--gg-border)] px-4 py-3 text-sm font-bold leading-6"
                placeholder="거래 수요, 서버명, 필요한 카테고리 등을 적어 주세요."
              />
            </label>
            <button type="submit" className="h-12 rounded-lg bg-[var(--gg-accent)] px-4 text-sm font-black text-white">
              신청 접수
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-lg border border-[var(--gg-border)] bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-600">게임/서버 신청은 로그인 후 접수할 수 있습니다.</p>
            <Link
              href="/sign-in?next=/support?tab=game-request"
              prefetch={false}
              className="mt-3 inline-flex rounded-lg bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-white"
            >
              로그인하고 신청하기
            </Link>
          </div>
        )}
      </div>
      <DocumentList title="신청 안내" documents={documents} />
    </section>
  );
}

async function createSupportInquiryAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    redirect("/sign-in?next=/support?tab=inquiry");
  }

  const category = String(formData.get("category") ?? "OTHER").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const safeCategory = inquiryCategories.some((item) => item.value === category)
    ? category
    : "OTHER";

  if (title.length < 2 || body.length < 10) {
    redirect("/support?tab=inquiry&error=invalid");
  }

  const prisma = getPrismaClient();
  const inquiry = await prisma.supportInquiry.create({
    data: {
      userId: currentUser.userId,
      category: safeCategory,
      title: title.slice(0, 100),
      body: body.slice(0, 2000),
    },
  });

  await sendAdminTelegramAlert({
    title: "1:1 문의 접수",
    lines: [
      `문의 ID: ${inquiry.id}`,
      `종류: ${inquiryCategoryLabel(safeCategory)}`,
      `회원: ${currentUser.displayName} / ${currentUser.email}`,
      `제목: ${title.slice(0, 100)}`,
      `어드민: ${(process.env.ADMIN_BASE_URL ?? process.env.NEXT_PUBLIC_ADMIN_BASE_URL ?? "").replace(/\/$/, "")}/admin/support-inquiries`,
    ],
  });

  redirect("/support?tab=inquiry&submitted=1");
}

async function createGameServerRequestAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    redirect("/sign-in?next=/support?tab=game-request");
  }

  const requestKind = String(formData.get("requestKind") ?? "신규 게임 신청").trim();
  const gameName = String(formData.get("gameName") ?? "").trim();
  const serverName = String(formData.get("serverName") ?? "").trim();
  const referenceUrl = String(formData.get("referenceUrl") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (gameName.length < 2 || body.length < 10) {
    redirect("/support?tab=game-request&error=invalid");
  }

  const title = `[${requestKind.slice(0, 30)}] ${gameName}${serverName ? ` / ${serverName}` : ""}`;
  const detailLines = [
    `신청 종류: ${requestKind}`,
    `게임명: ${gameName}`,
    serverName ? `서버명: ${serverName}` : null,
    referenceUrl ? `참고 링크: ${referenceUrl}` : null,
    "",
    body,
  ].filter(Boolean);

  const prisma = getPrismaClient();
  const inquiry = await prisma.supportInquiry.create({
    data: {
      userId: currentUser.userId,
      category: "GAME_SERVER",
      title: title.slice(0, 100),
      body: detailLines.join("\n").slice(0, 2000),
    },
  });

  await sendAdminTelegramAlert({
    title: "게임/서버 신청 접수",
    lines: [
      `문의 ID: ${inquiry.id}`,
      `신청 종류: ${requestKind}`,
      `게임명: ${gameName}`,
      serverName ? `서버명: ${serverName}` : null,
      `회원: ${currentUser.displayName} / ${currentUser.email}`,
      `어드민: ${(process.env.ADMIN_BASE_URL ?? process.env.NEXT_PUBLIC_ADMIN_BASE_URL ?? "").replace(/\/$/, "")}/admin/support-inquiries`,
    ],
  });

  redirect("/support?tab=game-request&submitted=1");
}

function inquiryCategoryLabel(category: string) {
  return inquiryCategories.find((item) => item.value === category)?.label ?? "기타";
}

function supportInquiryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "접수",
    IN_PROGRESS: "확인중",
    ANSWERED: "답변완료",
    CLOSED: "종료",
  };

  return labels[status] ?? status;
}

function formatSupportDate(date: Date) {
  return date.toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

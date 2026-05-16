import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import CountryText from "@/app/country-text";
import LocalizedInput, { LocalizedTextarea } from "@/app/localized-input";
import UserMarketHeader from "@/app/user-market-header";
import type { TranslationKey } from "@/app/i18n";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import {
  getCustomerCenterDocuments,
  type CustomerCenterType,
} from "@/lib/support/customer-center";

const tabs = [
  { key: "notice", labelKey: "support.notice", type: "NOTICE" },
  { key: "faq", labelKey: "support.faq", type: "FAQ" },
  { key: "inquiry", labelKey: "support.inquiry", type: null },
  { key: "policy", labelKey: "support.policy", type: "POLICY" },
  { key: "paid", labelKey: "support.paidService", type: "PAID_SERVICE" },
  { key: "game-request", labelKey: "support.gameRequest", type: "GAME_SERVER_REQUEST" },
] satisfies Array<{ key: string; labelKey: TranslationKey; type: CustomerCenterType | null }>;

const inquiryCategories = [
  { value: "WALLET", labelKey: "support.walletCategory" },
  { value: "ORDER", labelKey: "support.orderCategory" },
  { value: "DISPUTE", labelKey: "support.disputeCategory" },
  { value: "ACCOUNT", labelKey: "support.accountCategory" },
  { value: "GAME_SERVER", labelKey: "support.gameServerCategory" },
  { value: "OTHER", labelKey: "support.otherCategory" },
] satisfies Array<{ value: string; labelKey: TranslationKey }>;

const gameRequestKinds = [
  { value: "NEW_GAME", labelKey: "support.newGameRequest", adminLabel: "신규 게임 신청" },
  { value: "NEW_SERVER", labelKey: "support.newServerRequest", adminLabel: "신규 서버 신청" },
  { value: "GAME_INFO_EDIT", labelKey: "support.gameInfoEdit", adminLabel: "게임 정보 수정" },
] satisfies Array<{ value: string; labelKey: TranslationKey; adminLabel: string }>;

type InquirySummary = {
  id: string;
  category: string;
  title: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

type DocumentSummary = {
  slug: string;
  typeLabel: string;
  title: string;
  body: string;
  updatedAt: string;
};

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
    selected.key === "inquiry" && currentUser
      ? prisma.supportInquiry.findMany({
          where: { userId: currentUser.userId },
          select: {
            id: true,
            category: true,
            title: true,
            status: true,
            adminNote: true,
            createdAt: true,
          },
          orderBy: [
            { status: "asc" },
            { createdAt: "desc" },
          ],
          take: 12,
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
            <p className="text-sm font-black text-[var(--gg-accent)]">
              <CountryText id="support.customerCenterEyebrow" />
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              <CountryText id="support.customerCenter" />
            </h1>
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
                <CountryText id={tab.labelKey} />
              </Link>
            ))}
          </nav>

          {selected.key === "faq" ? <FaqSearch query={query} /> : null}

          {selected.key === "inquiry" ? (
            <InquiryPanel
              isSignedIn={Boolean(currentUser)}
              submitted={params.submitted === "1"}
              error={params.error === "invalid"}
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
              error={params.error === "invalid"}
            />
          ) : (
            <DocumentList title={<CountryText id={selected.labelKey} />} documents={searchedDocuments} />
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
        <h2 className="text-xl font-black">
          <CountryText id="support.customerCenter" />
        </h2>
        <div className="mt-4 grid gap-2 text-sm font-black">
          {tabs.map((tab) => (
            <Link key={tab.key} href={`/support?tab=${tab.key}`} prefetch={false} className="py-1 hover:text-[var(--gg-accent)]">
              <CountryText id={tab.labelKey} />
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--gg-border)] pt-5">
        <p className="text-sm font-black text-slate-500">
          <CountryText id="support.supportCenter" />
        </p>
        <p className="mt-2 text-2xl font-black text-slate-950">
          <CountryText id="support.onlineInquiry" />
        </p>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
          <CountryText id="support.sidebarDescription" />
        </p>
      </div>
      <Link
        href="/support?tab=inquiry"
        prefetch={false}
        className="block rounded-lg bg-[var(--gg-accent)] px-4 py-3 text-center text-sm font-black text-white"
      >
        <CountryText id="support.inquiryAction" />
      </Link>
    </aside>
  );
}

function FaqSearch({ query }: { query: string }) {
  return (
    <form action="/support" className="rounded-lg border border-[var(--gg-border)] bg-white p-4">
      <input type="hidden" name="tab" value="faq" />
      <label className="sr-only" htmlFor="support-search">
        <CountryText id="support.faqSearch" />
      </label>
      <LocalizedInput
        id="support-search"
        name="q"
        defaultValue={query}
        placeholderKey="support.faqSearchPlaceholder"
        className="h-12 w-full rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
      />
    </form>
  );
}

function DocumentList({
  title,
  documents,
}: {
  title: ReactNode;
  documents: DocumentSummary[];
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
          <p className="px-5 py-10 text-sm font-bold text-slate-500">
            <CountryText id="support.emptyDocuments" />
          </p>
        )}
      </div>
    </section>
  );
}

function InquiryPanel({
  isSignedIn,
  submitted,
  error,
  inquiries,
}: {
  isSignedIn: boolean;
  submitted: boolean;
  error: boolean;
  inquiries: InquirySummary[];
}) {
  const answeredCount = inquiries.filter((inquiry) => inquiry.status === "ANSWERED").length;

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-[var(--gg-border)] bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black">
              <CountryText id="support.inquiry" />
            </h2>
            <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
              <CountryText id="support.inquiryDescription" />
            </p>
          </div>
          {isSignedIn ? (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
              <CountryText id="support.answeredCount" values={{ count: answeredCount }} />
            </div>
          ) : null}
        </div>
        <SupportNotice submitted={submitted} error={error} successKey="support.inquirySubmitted" />
        {isSignedIn ? (
          <form action={createSupportInquiryAction} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-black">
              <CountryText id="support.inquiryCategory" />
              <select name="category" className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold">
                {inquiryCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    <CountryText id={category.labelKey} />
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black">
              <CountryText id="support.title" />
              <LocalizedInput
                name="title"
                required
                minLength={2}
                maxLength={100}
                placeholderKey="support.titlePlaceholder"
                className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              <CountryText id="support.body" />
              <LocalizedTextarea
                name="body"
                required
                minLength={10}
                maxLength={2000}
                rows={6}
                placeholderKey="support.bodyPlaceholder"
                className="rounded-lg border border-[var(--gg-border)] px-4 py-3 text-sm font-bold leading-6"
              />
            </label>
            <button type="submit" className="h-12 rounded-lg bg-[var(--gg-accent)] px-4 text-sm font-black text-white">
              <CountryText id="support.submitInquiry" />
            </button>
          </form>
        ) : (
          <SignInPrompt next="/support?tab=inquiry" label={<CountryText id="support.signInInquiry" />} />
        )}
      </div>
      <TopQuestions />
      {isSignedIn ? <InquiryHistory inquiries={inquiries} /> : null}
    </section>
  );
}

function GameRequestPanel({
  documents,
  isSignedIn,
  submitted,
  error,
}: {
  documents: DocumentSummary[];
  isSignedIn: boolean;
  submitted: boolean;
  error: boolean;
}) {
  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-[var(--gg-border)] bg-white p-6">
        <h2 className="text-xl font-black">
          <CountryText id="support.gameRequestTitle" />
        </h2>
        <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
          <CountryText id="support.gameRequestDescription" />
        </p>
        <SupportNotice
          submitted={submitted}
          error={error}
          successKey="support.gameRequestSubmitted"
          errorKey="support.gameRequestInvalidInput"
        />
        {isSignedIn ? (
          <form action={createGameServerRequestAction} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-black">
              <CountryText id="support.requestKind" />
              <select name="requestKind" className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold">
                {gameRequestKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    <CountryText id={kind.labelKey} />
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                <CountryText id="support.gameName" />
                <LocalizedInput
                  name="gameName"
                  required
                  minLength={2}
                  maxLength={80}
                  className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
                  placeholderKey="support.gameNamePlaceholder"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                <CountryText id="support.serverName" />
                <LocalizedInput
                  name="serverName"
                  maxLength={80}
                  className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
                  placeholderKey="support.serverNamePlaceholder"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-black">
              <CountryText id="support.referenceLink" />
              <LocalizedInput
                name="referenceUrl"
                maxLength={300}
                className="h-12 rounded-lg border border-[var(--gg-border)] px-4 text-sm font-bold"
                placeholderKey="support.referenceLinkPlaceholder"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              <CountryText id="support.requestReason" />
              <LocalizedTextarea
                name="body"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                className="rounded-lg border border-[var(--gg-border)] px-4 py-3 text-sm font-bold leading-6"
                placeholderKey="support.requestReasonPlaceholder"
              />
            </label>
            <button type="submit" className="h-12 rounded-lg bg-[var(--gg-accent)] px-4 text-sm font-black text-white">
              <CountryText id="support.submitRequest" />
            </button>
          </form>
        ) : (
          <SignInPrompt next="/support?tab=game-request" label={<CountryText id="support.signInRequest" />} />
        )}
      </div>
      <DocumentList title={<CountryText id="support.requestGuide" />} documents={documents} />
    </section>
  );
}

function SupportNotice({
  submitted,
  error,
  successKey,
  errorKey = "support.invalidInput",
}: {
  submitted: boolean;
  error: boolean;
  successKey: TranslationKey;
  errorKey?: TranslationKey;
}) {
  if (submitted) {
    return (
      <div className="mt-5 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800">
        <CountryText id={successKey} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
        <CountryText id={errorKey} />
      </div>
    );
  }

  return null;
}

function SignInPrompt({ next, label }: { next: string; label: ReactNode }) {
  return (
    <div className="mt-5 rounded-lg border border-[var(--gg-border)] bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-600">
        <CountryText id="support.signInRequired" />
      </p>
      <Link
        href={`/sign-in?next=${encodeURIComponent(next)}`}
        prefetch={false}
        className="mt-3 inline-flex rounded-lg bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-white"
      >
        {label}
      </Link>
    </div>
  );
}

function TopQuestions() {
  const questions: TranslationKey[] = [
    "support.topQuestion1",
    "support.topQuestion2",
    "support.topQuestion3",
    "support.topQuestion4",
    "support.topQuestion5",
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {questions.map((key, index) => (
        <div key={key} className="rounded-lg border border-[var(--gg-border)] bg-white p-5">
          <span className="rounded bg-[color-mix(in_srgb,var(--gg-accent)_18%,white)] px-2 py-1 text-xs font-black text-[var(--gg-accent)]">
            TOP {index + 1}
          </span>
          <p className="mt-4 text-sm font-black leading-6">
            <CountryText id={key} />
          </p>
        </div>
      ))}
    </div>
  );
}

function InquiryHistory({ inquiries }: { inquiries: InquirySummary[] }) {
  return (
    <section className="rounded-lg border border-[var(--gg-border)] bg-white">
      <div className="border-b border-[var(--gg-border)] px-5 py-4">
        <h3 className="text-lg font-black">
          <CountryText id="support.myInquiries" />
        </h3>
      </div>
      <div className="divide-y divide-[var(--gg-border)]">
        {inquiries.length ? (
          inquiries.map((inquiry) => (
            <div key={inquiry.id} className="grid gap-3 px-5 py-4 text-sm lg:grid-cols-[110px_1fr_120px]">
              <span className="font-black text-[var(--gg-accent)]">{inquiryCategoryLabel(inquiry.category)}</span>
              <div>
                <p className="font-black text-slate-950">{inquiry.title}</p>
                {inquiry.adminNote ? (
                  <p className="mt-2 whitespace-pre-line rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-sm font-semibold leading-6 text-cyan-900">
                    <CountryText id="support.operatorAnswer" />: {inquiry.adminNote}
                  </p>
                ) : (
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-500">
                    <CountryText id="support.operatorChecking" />
                  </p>
                )}
              </div>
              <div className="lg:text-right">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${supportInquiryStatusClass(inquiry.status)}`}>
                  {supportInquiryStatusLabel(inquiry.status)}
                </span>
                <p className="mt-2 text-xs font-bold text-slate-500">{inquiry.createdAt}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="px-5 py-8 text-sm font-bold text-slate-500">
            <CountryText id="support.noInquiries" />
          </p>
        )}
      </div>
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
  await prisma.supportInquiry.create({
    data: {
      userId: currentUser.userId,
      category: safeCategory,
      title: title.slice(0, 100),
      body: body.slice(0, 2000),
    },
  });

  redirect("/support?tab=inquiry&submitted=1");
}

async function createGameServerRequestAction(formData: FormData) {
  "use server";

  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    redirect("/sign-in?next=/support?tab=game-request");
  }

  const requestKindValue = String(formData.get("requestKind") ?? "NEW_GAME").trim();
  const requestKind =
    gameRequestKinds.find((kind) => kind.value === requestKindValue) ?? gameRequestKinds[0];
  const gameName = String(formData.get("gameName") ?? "").trim();
  const serverName = String(formData.get("serverName") ?? "").trim();
  const referenceUrl = String(formData.get("referenceUrl") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (gameName.length < 2 || body.length < 10) {
    redirect("/support?tab=game-request&error=invalid");
  }

  const title = `[${requestKind.adminLabel}] ${gameName}${serverName ? ` / ${serverName}` : ""}`;
  const detailLines = [
    `신청 종류: ${requestKind.adminLabel}`,
    `게임명: ${gameName}`,
    serverName ? `서버명: ${serverName}` : null,
    referenceUrl ? `참고 링크: ${referenceUrl}` : null,
    "",
    body,
  ].filter(Boolean);

  const prisma = getPrismaClient();
  await prisma.supportInquiry.create({
    data: {
      userId: currentUser.userId,
      category: "GAME_SERVER",
      title: title.slice(0, 100),
      body: detailLines.join("\n").slice(0, 2000),
    },
  });

  redirect("/support?tab=game-request&submitted=1");
}

function inquiryCategoryLabel(category: string) {
  const labelKey = inquiryCategories.find((item) => item.value === category)?.labelKey ?? "support.otherCategory";
  return <CountryText id={labelKey} />;
}

function supportInquiryStatusLabel(status: string) {
  const labels: Record<string, TranslationKey> = {
    OPEN: "support.statusOpen",
    IN_PROGRESS: "support.statusInProgress",
    ANSWERED: "support.statusAnswered",
    CLOSED: "support.statusClosed",
  };

  const labelKey = labels[status];
  return labelKey ? <CountryText id={labelKey} /> : status;
}

function supportInquiryStatusClass(status: string) {
  if (status === "ANSWERED") return "bg-emerald-50 text-emerald-700";
  if (status === "IN_PROGRESS") return "bg-cyan-50 text-cyan-700";
  if (status === "CLOSED") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

function formatSupportDate(date: Date) {
  return date.toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

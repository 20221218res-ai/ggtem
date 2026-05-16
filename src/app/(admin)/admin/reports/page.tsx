import type { ReactNode } from "react";
import Link from "next/link";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { getAdminReportsState } from "@/lib/admin/reports";

type AdminReportsPageProps = {
  searchParams?: Promise<{
    kind?: string;
    range?: string;
    from?: string;
    to?: string;
    query?: string;
    status?: string;
    gameId?: string;
    serverId?: string;
  }>;
};

const REPORT_KINDS = [
  ["ALL", "전체"],
  ["ORDERS", "거래"],
  ["DISPUTES", "분쟁/신고"],
  ["WALLET", "입출금"],
  ["LISTINGS", "매물"],
  ["USERS", "유저"],
  ["AUDIT", "관리자 이력"],
] as const;

const RANGES = [
  ["today", "오늘"],
  ["7d", "최근 7일"],
  ["30d", "최근 30일"],
  ["custom", "직접 선택"],
] as const;

const inputClassName =
  "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-[var(--gg-accent)]";

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const currentUser = await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin/sign-in",
  });
  const params = searchParams ? await searchParams : undefined;
  const state = await getAdminReportsState({
    kind: params?.kind,
    range: params?.range,
    from: params?.from,
    to: params?.to,
    query: params?.query,
    status: params?.status,
    gameId: params?.gameId,
    serverId: params?.serverId,
  });

  const xlsxExportHref = buildExportHref(state.filters, "xlsx");
  const csvExportHref = buildExportHref(state.filters, "csv");
  const downloadRequiresSuper = state.filters.kind === "ALL" || state.filters.kind === "USERS";
  const canDownloadCurrentView = currentUser.role === "SUPER" || !downloadRequiresSuper;
  const selectedGame = state.filterOptions.games.find((game) => game.id === state.filters.gameId);
  const serverOptions = selectedGame
    ? selectedGame.servers
    : state.filterOptions.games.flatMap((game) =>
        game.servers.map((server) => ({ ...server, name: `${game.name} / ${server.name}` })),
      );
  const totalRows =
    state.orders.length +
    state.disputes.length +
    state.walletRequests.length +
    state.listings.length +
    state.users.length +
    state.adminActivity.length;
  const nextAction = getReportNextAction({
    canDownloadCurrentView,
    downloadRequiresSuper,
    kind: state.filters.kind,
    range: state.filters.range,
    totalRows,
    xlsxExportHref,
  });
  const walletRequests = state.walletRequests as Array<{
    kind: string;
    rawStatus?: string;
    status: string;
    user: string;
    amount: string;
    provider: string;
    reference: string;
    requestedAt: string;
  }>;

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--gg-accent)]">REPORT CENTER</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">운영 데이터 조회</h1>
            <p className="sr-only">
              거래, 입출금, 분쟁, 유저, 관리자 이력을 한 곳에서 조회하고 다운로드합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TopLink href="/admin/game-settings" label="게임/서버 관리" />
            <TopLink href="/admin/audit" label="감사 로그" />
            <ExportButton href={xlsxExportHref} disabled={!canDownloadCurrentView} label="XLSX 다운로드" primary />
            <ExportButton href={csvExportHref} disabled={!canDownloadCurrentView} label="CSV 다운로드" />
          </div>
        </header>

        <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <p className="text-sm font-black text-sky-800">NEXT ACTION</p>
          <h2 className="mt-2 text-2xl font-black">{nextAction.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={nextAction.href}
              className="inline-flex rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
            >
              {nextAction.actionLabel}
            </Link>
            <SecurityRule label="직접 선택 최대" value="30일" />
            <SecurityRule label="유저 데이터" value="SUPER 전용" />
            <SecurityRule label="다운로드" value="감사 로그 기록" />
          </div>
          {!canDownloadCurrentView ? (
            <p className="sr-only">
              현재 범위에는 유저 데이터가 포함되어 SUPER 관리자만 다운로드할 수 있습니다.
            </p>
          ) : null}
        </section>

        <ReportWorkflow canDownloadCurrentView={canDownloadCurrentView} />

        <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1.5fr]">
            <Field label="데이터 종류">
              <select name="kind" defaultValue={state.filters.kind} className={inputClassName}>
                {REPORT_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="날짜 범위">
              <select name="range" defaultValue={state.filters.range} className={inputClassName}>
                {RANGES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="상태">
              <select name="status" defaultValue={state.filters.status} className={inputClassName}>
                {state.filterOptions.statuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {statusOptionLabel(option.value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="게임">
              <select name="gameId" defaultValue={state.filters.gameId} className={inputClassName}>
                <option value="">전체 게임</option>
                {state.filterOptions.games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="서버">
              <select name="serverId" defaultValue={state.filters.serverId} className={inputClassName}>
                <option value="">전체 서버</option>
                {serverOptions.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="시작일">
              <input type="date" name="from" defaultValue={state.filters.from} className={inputClassName} />
            </Field>
            <Field label="종료일">
              <input type="date" name="to" defaultValue={state.filters.to} className={inputClassName} />
            </Field>
            <Field label="검색">
              <input
                name="query"
                defaultValue={state.filters.query}
                placeholder="주문번호, 유저, 매물명, TXID"
                className={inputClassName}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
            >
              조회
            </button>
            <Link
              href="/admin/reports"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[var(--gg-accent)] hover:text-slate-950"
            >
              초기화
            </Link>
          </div>
        </form>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <Metric label="거래 건수" value={`${state.summary.orderCount.toLocaleString("ko-KR")}건`} />
          <Metric label="총 거래액" value={`${state.summary.grossAmount} USDT`} />
          <Metric label="플랫폼 수익" value={`${state.summary.platformFeeAmount} USDT`} />
          <Metric label="분쟁/신고" value={`${state.summary.disputeCount.toLocaleString("ko-KR")}건`} />
          <Metric label="입출금 요청" value={`${state.summary.walletRequestCount.toLocaleString("ko-KR")}건`} />
          <Metric label="신규 유저" value={`${state.summary.userCount.toLocaleString("ko-KR")}명`} />
          <Metric label="관리자 업무" value={`${state.summary.adminActivityCount.toLocaleString("ko-KR")}건`} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-xl font-black">파일 출력 구성</h2>
            <div className="flex flex-wrap gap-2">
              {cleanSheetNames(state.exportPlan.sheets).map((sheet) => (
                <span key={sheet} className="rounded bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                  {sheet}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <ExportScopeCard label="일자 요약" value={`${state.dailySummary.length}개`} />
            <ExportScopeCard label="거래" value={`${state.orders.length}개`} />
            <ExportScopeCard label="분쟁/신고" value={`${state.disputes.length}개`} />
            <ExportScopeCard label="입출금" value={`${state.walletRequests.length}개`} />
            <ExportScopeCard label="매물" value={`${state.listings.length}개`} />
            <ExportScopeCard label="유저" value={`${state.users.length}개`} />
            <ExportScopeCard label="관리자 이력" value={`${state.adminActivity.length}개`} />
          </div>
        </section>

        <ReportSection title="일자별 요약" show>
          <DataTable
            headers={["날짜", "거래", "거래액", "플랫폼 수수료", "분쟁/신고", "입출금", "매물", "신규 유저", "관리자 업무"]}
            rows={state.dailySummary.map((row) => [
              row.date,
              `${row.orders.toLocaleString("ko-KR")}건`,
              `${row.grossAmount} USDT`,
              `${row.platformFeeAmount} USDT`,
              `${row.disputes.toLocaleString("ko-KR")}건`,
              `${row.walletRequests.toLocaleString("ko-KR")}건`,
              `${row.listings.toLocaleString("ko-KR")}건`,
              `${row.users.toLocaleString("ko-KR")}명`,
              `${row.adminActivity.toLocaleString("ko-KR")}건`,
            ])}
            empty="현재 조건에 맞는 일자별 요약 데이터가 없습니다."
          />
        </ReportSection>

        <ReportSection title="거래 데이터" show={state.filters.kind === "ALL" || state.filters.kind === "ORDERS"}>
          <DataTable
            headers={["주문", "상태", "상품", "구매자/판매자", "게임/서버", "금액", "생성/완료"]}
            rows={state.orders.map((row) => [
              row.number,
              statusOptionLabel(row.rawStatus ?? row.status),
              row.title,
              `${row.buyer} / ${row.seller}`,
              `${row.game} / ${row.server}`,
              row.grossAmount,
              `${row.createdAt} / ${row.completedAt}`,
            ])}
            empty="조건에 맞는 거래 데이터가 없습니다."
          />
        </ReportSection>

        <ReportSection title="분쟁/신고 데이터" show={state.filters.kind === "ALL" || state.filters.kind === "DISPUTES"}>
          <DataTable
            headers={["분류", "상태", "심각도", "신고자/대상", "주문", "접수/종료"]}
            rows={state.disputes.map((row) => [
              reportCategoryLabel(row.category),
              statusOptionLabel(row.rawStatus ?? row.status),
              severityLabel(row.severity),
              `${row.reporter} / ${row.target}`,
              row.orderNumber,
              `${row.createdAt} / ${row.resolvedAt}`,
            ])}
            empty="조건에 맞는 분쟁/신고 데이터가 없습니다."
          />
        </ReportSection>

        <ReportSection title="입출금 데이터" show={state.filters.kind === "ALL" || state.filters.kind === "WALLET"}>
          <DataTable
            headers={["구분", "상태", "유저", "금액", "수단", "참조", "요청일"]}
            rows={walletRequests.map((row) => [
              walletKindLabel(row.kind),
              statusOptionLabel(row.rawStatus ?? row.status),
              row.user,
              row.amount,
              row.provider,
              row.reference,
              row.requestedAt,
            ])}
            empty="조건에 맞는 입출금 데이터가 없습니다."
          />
        </ReportSection>

        <ReportSection title="매물 데이터" show={state.filters.kind === "ALL" || state.filters.kind === "LISTINGS"}>
          <DataTable
            headers={["상태", "판매자", "제목", "게임/서버", "유형", "가격", "재고", "등록일"]}
            rows={state.listings.map((row) => [
              statusOptionLabel(row.rawStatus ?? row.status),
              row.seller,
              row.title,
              `${row.game} / ${row.server}`,
              row.category,
              row.price,
              row.quantity,
              row.createdAt,
            ])}
            empty="조건에 맞는 매물 데이터가 없습니다."
          />
        </ReportSection>

        <ReportSection title="유저 데이터" show={state.filters.kind === "ALL" || state.filters.kind === "USERS"}>
          <DataTable
            headers={["이름", "이메일", "권한/상태", "잔액", "거래", "신고/분쟁", "가입일"]}
            rows={state.users.map((row) => [
              row.name,
              row.email,
              `${roleLabel(row.role)} / ${statusOptionLabel(row.rawStatus ?? row.status)}`,
              row.balance,
              `${row.orders.toLocaleString("ko-KR")}건`,
              `${row.reports.toLocaleString("ko-KR")}건`,
              row.createdAt,
            ])}
            empty="조건에 맞는 유저 데이터가 없습니다."
          />
        </ReportSection>

        <ReportSection title="관리자 업무 이력" show={state.filters.kind === "ALL" || state.filters.kind === "AUDIT"}>
          <DataTable
            headers={["관리자", "권한", "작업", "대상", "사유", "민감도", "일시"]}
            rows={state.adminActivity.map((row) => [
              `${row.admin} / ${row.email}`,
              roleLabel(row.role),
              row.action,
              `${row.targetType} / ${row.targetId}`,
              row.reason,
              sensitivityLabel(row.sensitivity),
              row.createdAt,
            ])}
            empty="현재 조건에 맞는 관리자 업무 이력이 없습니다."
          />
        </ReportSection>
      </section>
    </main>
  );
}

function TopLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
      {label}
    </Link>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-700">
      {label}
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ExportButton({ href, label, disabled, primary = false }: { href: string; label: string; disabled: boolean; primary?: boolean }) {
  if (disabled) {
    return (
      <span
        title="현재 리포트는 SUPER 관리자만 다운로드할 수 있습니다."
        className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-black text-slate-400"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105"
          : "rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-[var(--gg-accent)] hover:text-slate-950"
      }
    >
      {label}
    </Link>
  );
}

function SecurityRule({ label, value }: { label: string; value: string }) {
  return (
    <span className="sr-only">
      {label}: {value}
    </span>
  );
}

function ReportWorkflow({ canDownloadCurrentView }: { canDownloadCurrentView: boolean }) {
  const steps = [
    {
      title: "범위 확인",
      body: "기간, 상태, 게임/서버 필터를 먼저 조합해서 필요한 운영 데이터를 조회합니다.",
      href: "/admin/reports",
    },
    {
      title: "민감 데이터",
      body: canDownloadCurrentView
        ? "현재 권한으로 이 범위의 다운로드가 가능합니다."
        : "유저 데이터가 포함된 다운로드는 SUPER 권한이 필요합니다.",
      href: "/admin/audit?action=REPORT_EXPORT_XLSX",
    },
    {
      title: "감사 추적",
      body: "다운로드 전후에는 감사 로그에서 관리자, 사유, 파일 형식을 확인합니다.",
      href: "/admin/audit?action=REPORT_EXPORT_XLSX",
    },
  ];

  void steps;
  return null;
}

function ExportScopeCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-600">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ReportSection({ title, show, children }: { title: string; show: boolean; children: ReactNode }) {
  if (!show) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-slate-200 px-3 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 font-bold text-slate-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getReportNextAction({
  canDownloadCurrentView,
  downloadRequiresSuper,
  kind,
  range,
  totalRows,
  xlsxExportHref,
}: {
  canDownloadCurrentView: boolean;
  downloadRequiresSuper: boolean;
  kind: string;
  range: string;
  totalRows: number;
  xlsxExportHref: string;
}) {
  if (!canDownloadCurrentView && downloadRequiresSuper) {
    return {
      title: "다운로드 권한을 먼저 확인하세요",
      actionLabel: "감사 로그 확인",
      href: "/admin/audit?action=REPORT_EXPORT_XLSX",
    };
  }

  if (totalRows === 0) {
    return {
      title: "현재 조건에는 데이터가 없습니다",
      actionLabel: "최근 30일 전체 보기",
      href: "/admin/reports?range=30d",
    };
  }

  if (range === "custom") {
    return {
      title: `${reportKindLabel(kind)} 데이터 ${totalRows}건 미리보기`,
      actionLabel: "XLSX 다운로드",
      href: xlsxExportHref,
    };
  }

  return {
    title: `${rangeLabel(range)} 기준 ${totalRows}건 조회 중`,
    actionLabel: "감사 로그 확인",
    href: "/admin/audit?action=REPORT_EXPORT_XLSX",
  };
}

function statusOptionLabel(status: string) {
  const labels: Record<string, string> = {
    ALL: "전체 상태",
    ACTIVE: "활성",
    COMPLETED: "완료",
    CANCELED: "취소",
    CANCELLED: "취소",
    DISPUTED: "분쟁",
    PENDING: "대기",
    REQUESTED: "요청",
    UNDER_REVIEW: "검토 중",
    CONFIRMED: "확인됨",
    REJECTED: "반려",
    SOLD_OUT: "판매 완료",
    SUSPENDED: "정지",
    OPEN: "접수",
    RESOLVED: "해결",
    DISMISSED: "기각",
    APPROVED: "승인",
    SENT: "전송됨",
    EXPIRED: "만료",
    PAUSED: "일시중지",
    HIDDEN: "숨김",
    REMOVED: "삭제",
    BANNED: "차단",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
  };

  return labels[status] ?? status;
}

function walletKindLabel(kind: string) {
  const labels: Record<string, string> = {
    DEPOSIT: "충전",
    WITHDRAWAL: "출금",
    "異⑹쟾": "충전",
    "異쒓툑": "출금",
  };
  return labels[kind] ?? kind;
}

function reportKindLabel(kind: string) {
  const labels: Record<string, string> = {
    ALL: "전체",
    ORDERS: "거래",
    DISPUTES: "분쟁/신고",
    WALLET: "입출금",
    LISTINGS: "매물",
    USERS: "유저",
    AUDIT: "관리자 이력",
  };

  return labels[kind] ?? kind;
}

function rangeLabel(range: string) {
  const labels: Record<string, string> = {
    today: "오늘",
    "7d": "최근 7일",
    "30d": "최근 30일",
    custom: "직접 선택",
  };

  return labels[range] ?? range;
}

function reportCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    LOW_RATING_REVIEW: "낮은 평점 리뷰",
    FAKE_REVIEW: "허위 리뷰",
    ABUSIVE_LANGUAGE: "욕설/비방",
    EXTERNAL_CONTACT: "외부 연락 유도",
    SPAM: "스팸/광고",
    PRIVACY: "개인정보 노출",
    FRAUD: "사기 의심",
    NO_DELIVERY: "미전달",
    WRONG_ITEM: "다른 물품",
    ABUSIVE_CHAT: "부적절한 채팅",
    OFF_PLATFORM_PAYMENT: "외부 결제 유도",
    PAYMENT_RISK: "결제 위험",
    TRADE_RISK: "거래 위험",
    OTHER: "기타",
  };

  return labels[category] ?? category.replaceAll("_", " ");
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    LOW: "낮음",
    MEDIUM: "보통",
    HIGH: "높음",
    CRITICAL: "긴급",
  };

  return labels[severity] ?? severity;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    CUSTOMER: "일반",
    USER: "일반",
    SELLER: "판매자",
    CS: "CS",
    MODERATOR: "모더레이터",
    FINANCE: "재무",
    ADMIN: "관리자",
    SUPER: "최고관리자",
  };

  return labels[role] ?? role;
}

function sensitivityLabel(value: string) {
  const labels: Record<string, string> = {
    "誘쇨컧": "민감",
    "?쇰컲": "일반",
    SENSITIVE: "민감",
    NORMAL: "일반",
  };

  return labels[value] ?? value;
}

function cleanSheetNames(sheets: string[]) {
  const fallback = ["요약", "일자별 요약", "거래", "분쟁 신고", "입출금", "매물", "유저", "관리자 이력"];
  return sheets.map((sheet, index) => (hasCorruptedText(sheet) ? fallback[index] ?? `시트 ${index + 1}` : sheet));
}

function hasCorruptedText(value: string) {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return char === "\uFFFD" || (code >= 0x4e00 && code <= 0x9fff);
  });
}

function buildExportHref(
  filters: {
    kind: string;
    range: string;
    from: string;
    to: string;
    query: string;
    status: string;
    gameId: string;
    serverId: string;
  },
  format: "xlsx" | "csv",
) {
  const params = new URLSearchParams({
    kind: filters.kind,
    range: filters.range,
    status: filters.status,
    format,
  });

  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.query) params.set("query", filters.query);
  if (filters.gameId) params.set("gameId", filters.gameId);
  if (filters.serverId) params.set("serverId", filters.serverId);

  return `/api/admin/reports/export?${params.toString()}`;
}

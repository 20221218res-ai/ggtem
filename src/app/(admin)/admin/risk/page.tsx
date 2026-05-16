import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminRiskState } from "@/lib/admin/risk";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import RiskActions from "./risk-actions";
import SellerRiskCandidateActions from "./seller-risk-candidate-actions";

type AdminRiskPageProps = {
  searchParams?: Promise<{
    status?: string;
    severity?: string;
    query?: string;
  }>;
};

type RiskState = Awaited<ReturnType<typeof getAdminRiskState>>;
type RiskReport = RiskState["reports"][number];
type SellerRiskCandidate = RiskState["sellerRiskCandidates"][number];
type Tone = "slate" | "cyan" | "blue" | "emerald" | "amber" | "red";

const statusFilters = ["ALL", "OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];
const severityFilters = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default async function AdminRiskPage({ searchParams }: AdminRiskPageProps) {
  await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS);
  const params = await searchParams;
  const state = await getAdminRiskState({
    status: params?.status,
    severity: params?.severity,
    query: params?.query,
  });
  const reviewSummary = getRiskReviewSummary(state);
  const nextAction = getNextAction(reviewSummary);

  return (
    <main className="bg-slate-100 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-[var(--color-primary)]">RISK DESK</p>
            <h1 className="mt-1 text-2xl font-black">신고·리스크 관리</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminLink href="/admin/users">유저</AdminLink>
            <AdminLink href="/admin/orders?status=DISPUTED">분쟁 주문</AdminLink>
            <AdminLink href="/admin/review-moderation">리뷰 검토</AdminLink>
            <AdminLink href="/admin/audit?targetType=TRUST_REPORT">감사 로그</AdminLink>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="전체 신고" value={state.summary.totalReports} tone="slate" />
          <Metric label="표시 중" value={state.summary.shownReports} tone="blue" />
          <Metric label="처리 대기" value={state.summary.openReports} tone="amber" />
          <Metric label="고위험" value={state.summary.highSeverityReports} tone="red" />
          <Metric label="판매 제한 후보" value={state.summary.sellerRiskCandidates} tone="cyan" />
        </section>

        <section className={`rounded-lg border p-5 shadow-sm ${toneClasses(nextAction.tone)}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black">다음 확인</p>
              <h2 className="mt-1 text-xl font-black">{nextAction.title}</h2>
            </div>
            <Link href={nextAction.href} className="rounded-md bg-white px-4 py-2 text-center text-sm font-black text-slate-950 shadow-sm hover:bg-slate-50">
              바로 보기
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            <QuickFilter href="/admin/risk" label="접수" active={state.filters.status === "OPEN"} />
            <QuickFilter href="/admin/risk?status=UNDER_REVIEW" label="검토 중" active={state.filters.status === "UNDER_REVIEW"} />
            <QuickFilter href="/admin/risk?severity=CRITICAL" label="긴급" active={state.filters.severity === "CRITICAL"} />
            <QuickFilter href="/admin/risk#seller-candidates" label="판매 제한 후보" active={false} />
          </div>
          <ReportFilterForm state={state} />
        </section>

        <SellerRiskCandidatesSection candidates={state.sellerRiskCandidates} />
        <RiskReportList reports={state.reports} />
      </section>
    </main>
  );
}

function SellerRiskCandidatesSection({ candidates }: { candidates: SellerRiskCandidate[] }) {
  return (
    <section id="seller-candidates" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[var(--color-primary)]">SELLER RISK</p>
          <h2 className="mt-1 text-xl font-black">판매 제한 후보</h2>
        </div>
        <AdminLink href="/admin/users?status=SELLING_RESTRICTED">제한 계정</AdminLink>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {candidates.map((candidate) => {
          const signal = getSellerCandidateReviewSignal(candidate);

          return (
            <article key={candidate.userId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={riskTone(candidate.riskLabel)}>{riskLabel(candidate.riskLabel)}</Badge>
                    <Badge tone={statusTone(candidate.status)}>{userStatusLabel(candidate.status)}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-950">{candidate.displayName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{candidate.email}</p>
                </div>
                <AdminLink href={`/admin/users/${candidate.userId}`}>유저 상세</AdminLink>
              </div>

              <RiskSignalBox title={signal.title} tone={signal.tone} />

              <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <SignalPill label="낮은 리뷰" value={`${candidate.lowReviewCount}건`} />
                <SignalPill label="낮은 평점 평균" value={`${candidate.averageLowRating}/5`} />
                <SignalPill label="처리 대기 신고" value={`${candidate.openReportCount}건`} />
                <SignalPill label="고위험 신고" value={`${candidate.highSeverityReportCount}건`} />
              </div>

              {candidate.offPlatformReportCount > 0 ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-black text-red-700">외부거래 반복 신호</p>
                  <p className="mt-1 text-lg font-black text-red-950">{candidate.offPlatformReportCount.toLocaleString("ko-KR")}건</p>
                </div>
              ) : null}

              <p className="mt-3 text-sm font-semibold text-slate-700">추천 조치: {recommendedActionLabel(candidate.recommendedAction)}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">마지막 신호 {candidate.lastSignalAt}</p>
              <SellerRiskCandidateActions
                userId={candidate.userId}
                currentStatus={candidate.status}
                defaultReason={`${candidate.displayName} 신고 및 낮은 리뷰 신호 검토`}
              />
            </article>
          );
        })}

        {candidates.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">현재 기준으로 판매 제한 후보가 없습니다.</p>
        ) : null}
      </div>
    </section>
  );
}

function RiskReportList({ reports }: { reports: RiskReport[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--color-primary)]">REPORT QUEUE</p>
          <h2 className="text-xl font-black">신고 목록</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-600">{reports.length}건</span>
      </div>

      <div className="divide-y divide-slate-100">
        {reports.map((report) => {
          const signal = getReportReviewSignal(report);
          const description = cleanText(report.description, "내용 없음");

          return (
            <article key={report.reportId} className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={severityTone(report.severity)}>{severityLabel(report.severity)}</Badge>
                    <Badge tone={statusTone(report.status)}>{reportStatusLabel(report.status)}</Badge>
                    <Badge tone={signal.tone}>{reportCategoryLabel(report.category)}</Badge>
                    <Badge tone="slate">{sourceTypeLabel(report.sourceType)}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {report.reporterName} 신고 → {report.targetName}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        신고자 {report.reporterEmail} / 대상 {report.targetEmail}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">{description}</p>
                      {isOffPlatformReport(report) ? <OffPlatformReportPanel report={report} /> : null}
                    </div>
                    <RiskSignalBox title={signal.title} tone={signal.tone} />
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                    <SignalPill label="대상 상태" value={userStatusLabel(report.targetStatus)} />
                    <SignalPill label="접수" value={report.createdAt} />
                    <SignalPill label="수정" value={report.updatedAt} />
                  </div>

                  {report.resolutionNote ? (
                    <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                      처리 메모: {report.resolutionNote}
                    </p>
                  ) : null}

                  <RiskTraceLinks report={report} />
                </div>
              </div>

              <RiskActions reportId={report.reportId} currentStatus={report.status} currentSeverity={report.severity} />
            </article>
          );
        })}

        {reports.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-slate-500">조건에 맞는 신고가 없습니다.</p> : null}
      </div>
    </section>
  );
}

function ReportFilterForm({ state }: { state: RiskState }) {
  return (
    <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto]">
      <select
        name="status"
        defaultValue={state.filters.status}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--color-primary)]"
      >
        {statusFilters.map((status) => (
          <option key={status} value={status}>
            {reportStatusLabel(status)}
          </option>
        ))}
      </select>
      <select
        name="severity"
        defaultValue={state.filters.severity}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--color-primary)]"
      >
        {severityFilters.map((severity) => (
          <option key={severity} value={severity}>
            {severityLabel(severity)}
          </option>
        ))}
      </select>
      <input
        name="query"
        defaultValue={state.filters.query}
        placeholder="신고 내용, 주문번호, 이메일 검색"
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--color-primary)]"
      />
      <button type="submit" className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-105">
        검색
      </button>
      <Link href="/admin/risk" className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-black text-slate-700 hover:bg-slate-50">
        초기화
      </Link>
    </form>
  );
}

function RiskTraceLinks({ report }: { report: RiskReport }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <AdminLink href={`/admin/users/${report.targetUserId}`}>대상 유저</AdminLink>
      {report.orderId ? <AdminLink href={`/admin/orders?orderId=${report.orderId}`}>주문 {report.orderNumber ?? ""}</AdminLink> : null}
      {report.listingTitle ? <Badge tone="slate">{report.listingTitle}</Badge> : null}
      <AdminLink href={`/admin/audit?targetType=TRUST_REPORT&query=${report.reportId}`}>감사 로그</AdminLink>
    </div>
  );
}

function OffPlatformReportPanel({ report }: { report: RiskReport }) {
  const detectionLabels = extractDetectionLabels(report.description);

  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">외부거래 자동 감지</span>
        {detectionLabels.length > 0 ? (
          detectionLabels.map((label) => (
            <Badge key={label} tone="red">
              {label}
            </Badge>
          ))
        ) : (
          <Badge tone="red">연락처/외부거래 시도</Badge>
        )}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <SignalPill label="연결 주문" value={report.orderNumber ?? report.orderId ?? "주문 없음"} />
        <SignalPill label="대상 계정" value={`${report.targetName} / ${userStatusLabel(report.targetStatus)}`} />
        <SignalPill label="권장 처리" value="검토 중" />
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${metricToneClass(tone)}`}>
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function QuickFilter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-2 text-sm font-black ${
        active ? "bg-[var(--color-primary)] text-slate-950" : "border border-slate-200 bg-white text-slate-600 hover:border-[var(--color-primary)]"
      }`}
    >
      {label}
    </Link>
  );
}

function AdminLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm hover:border-[var(--color-primary)] hover:text-slate-950"
    >
      {children}
    </Link>
  );
}

function Badge({ tone, children }: { tone: Tone | string; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeToneClass(tone)}`}>{children}</span>;
}

function SignalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function RiskSignalBox({ title, tone }: { title: string; tone: Tone }) {
  return (
    <div className={`mt-3 rounded-lg border p-3 ${toneClasses(tone)}`}>
      <p className="text-sm font-black">{title}</p>
    </div>
  );
}

function getRiskReviewSummary(state: RiskState) {
  return {
    urgentReports: state.reports.filter(
      (report) => ["HIGH", "CRITICAL"].includes(report.severity) || report.category === "OFF_PLATFORM_PAYMENT" || report.category === "FRAUD",
    ).length,
    restrictionCandidates: state.sellerRiskCandidates.filter((candidate) => candidate.recommendedAction.includes("SELLING_RESTRICTED")).length,
    needsResolutionNote: state.reports.filter((report) => ["OPEN", "UNDER_REVIEW"].includes(report.status) && !report.resolutionNote).length,
  };
}

function getNextAction(summary: ReturnType<typeof getRiskReviewSummary>) {
  if (summary.urgentReports > 0) {
    return {
      title: `긴급 신고 ${summary.urgentReports}건을 먼저 확인하세요`,
      href: "/admin/risk?severity=CRITICAL",
      tone: "red" as const,
    };
  }
  if (summary.restrictionCandidates > 0) {
    return {
      title: `판매 제한 후보 ${summary.restrictionCandidates}명을 확인하세요`,
      href: "/admin/risk#seller-candidates",
      tone: "amber" as const,
    };
  }
  return {
    title: `메모가 필요한 신고 ${summary.needsResolutionNote}건을 처리하세요`,
    href: "/admin/risk?status=OPEN",
    tone: "cyan" as const,
  };
}

function getSellerCandidateReviewSignal(candidate: SellerRiskCandidate) {
  if (candidate.offPlatformReportCount >= 2) {
    return {
      title: "반복 외부거래 시도",
      tone: "red" as const,
    };
  }

  if (candidate.riskLabel === "HIGH") {
    return {
      title: "판매 제한 우선 검토",
      tone: "red" as const,
    };
  }

  if (candidate.highSeverityReportCount > 0) {
    return {
      title: "고위험 신고 보유",
      tone: "amber" as const,
    };
  }

  return {
    title: "모니터링 대상",
    tone: "slate" as const,
  };
}

function isOffPlatformReport(report: RiskReport) {
  return report.category === "OFF_PLATFORM_PAYMENT" || report.sourceType === "OFF_PLATFORM_CONTACT";
}

function extractDetectionLabels(description: string) {
  const marker = "감지 항목:";
  const markerIndex = description.indexOf(marker);

  if (markerIndex === -1) return [];

  return description
    .slice(markerIndex + marker.length)
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getReportReviewSignal(report: RiskReport) {
  if (isOffPlatformReport(report)) {
    return {
      label: "외부거래",
      title: "외부거래/연락처 교환 차단",
      tone: "red" as const,
    };
  }

  if (report.category === "FRAUD" || report.severity === "CRITICAL") {
    return {
      label: "긴급",
      title: "사기/긴급 신고",
      tone: "red" as const,
    };
  }

  if (report.status === "OPEN") {
    return {
      label: "접수",
      title: "초기 검토 필요",
      tone: "amber" as const,
    };
  }

  if (report.status === "UNDER_REVIEW") {
    return {
      label: "검토 중",
      title: "처리 메모 보강",
      tone: "blue" as const,
    };
  }

  if (report.status === "RESOLVED") {
    return {
      label: "완료",
      title: "처리 완료",
      tone: "emerald" as const,
    };
  }

  return {
    label: "기각",
    title: "기각된 신고",
    tone: "slate" as const,
  };
}

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ALL: "전체 상태",
    OPEN: "접수",
    UNDER_REVIEW: "검토 중",
    RESOLVED: "처리 완료",
    DISMISSED: "기각",
  };
  return labels[status] ?? status;
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    ALL: "전체 심각도",
    LOW: "낮음",
    MEDIUM: "중간",
    HIGH: "높음",
    CRITICAL: "긴급",
  };
  return labels[severity] ?? severity;
}

function reportCategoryLabel(category: string) {
  if (category === "OFF_PLATFORM_PAYMENT") return "외부거래/연락처";

  const labels: Record<string, string> = {
    LOW_RATING_REVIEW: "낮은 평점 리뷰",
    FAKE_REVIEW: "허위 리뷰",
    ABUSIVE_LANGUAGE: "욕설/비방",
    EXTERNAL_CONTACT: "외부 연락 시도",
    SPAM: "스팸/광고",
    PRIVACY: "개인정보 노출",
    FRAUD: "사기 의심",
    NO_DELIVERY: "미전달",
    WRONG_ITEM: "다른 물품",
    ABUSIVE_CHAT: "부적절한 채팅",
    PAYMENT_RISK: "결제 위험",
    TRADE_RISK: "거래 위험",
    OTHER: "기타",
  };
  return labels[category] ?? category.replaceAll("_", " ");
}

function sourceTypeLabel(sourceType?: string | null) {
  if (sourceType === "OFF_PLATFORM_CONTACT") return "자동 감지";

  if (!sourceType) return "유저 직접 신고";

  const labels: Record<string, string> = {
    ORDER_REVIEW: "낮은 리뷰 자동 생성",
    ADMIN: "관리자 생성",
  };
  return labels[sourceType] ?? sourceType;
}

function userStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "정상",
    SUSPENDED: "정지",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
    BANNED: "차단",
    PENDING_EMAIL_VERIFICATION: "이메일 확인 대기",
  };
  return labels[status] ?? status;
}

function riskLabel(risk: string) {
  const labels: Record<string, string> = {
    HIGH: "높은 위험",
    MEDIUM: "주의",
    LOW: "관찰",
  };
  return labels[risk] ?? risk;
}

function recommendedActionLabel(action: string) {
  if (action.includes("WITHDRAWAL_HOLD")) return "판매 제한 + 출금 보류 검토";
  if (action.includes("SELLING_RESTRICTED")) return "판매 제한 검토";
  return "신고 내용 모니터링";
}

function riskTone(risk: string): Tone {
  if (risk === "HIGH") return "red";
  if (risk === "MEDIUM") return "amber";
  return "slate";
}

function severityTone(severity: string): Tone {
  if (["HIGH", "CRITICAL"].includes(severity)) return "red";
  if (severity === "MEDIUM") return "amber";
  return "slate";
}

function statusTone(status: string): Tone {
  if (status === "RESOLVED" || status === "ACTIVE") return "emerald";
  if (status === "OPEN" || status === "UNDER_REVIEW") return "amber";
  if (["SUSPENDED", "BANNED", "SELLING_RESTRICTED"].includes(status)) return "red";
  return "slate";
}

function metricToneClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "border-slate-200 text-slate-950",
    cyan: "border-sky-200 text-sky-700",
    blue: "border-blue-200 text-blue-700",
    emerald: "border-emerald-200 text-emerald-700",
    amber: "border-amber-200 text-amber-700",
    red: "border-red-200 text-red-700",
  };
  return classes[tone];
}

function badgeToneClass(tone: Tone | string) {
  const classes: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    cyan: "bg-sky-100 text-sky-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return classes[tone] ?? classes.slate;
}

function toneClasses(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    cyan: "border-sky-200 bg-sky-50 text-sky-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return classes[tone];
}

function cleanText(value: string | null | undefined, fallback: string) {
  if (!value?.trim() || hasCorruptedText(value)) return fallback;
  return value;
}

function hasCorruptedText(value: string) {
  return value.includes("\uFFFD") || /[野껅ⓩ뤃?뷴뜝夷뚪뇦嚥→꽴?곤㎗]/.test(value);
}

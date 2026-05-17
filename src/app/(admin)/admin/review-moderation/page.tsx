import Link from "next/link";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { getAdminReviewModerationState } from "@/lib/admin/review-moderation";
import ReviewModerationReportActions from "./report-actions";
import ReviewModerationReviewActions from "./review-actions";

type ReviewModerationState = Awaited<ReturnType<typeof getAdminReviewModerationState>>;
type QueueItem = ReviewModerationState["queue"][number];

export default async function ReviewModerationPage() {
  await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const state = await getAdminReviewModerationState();
  const nextAction = getNextAction(state);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
                REVIEW DESK
              </p>
              <h1 className="mt-1 text-2xl font-black">리뷰 모더레이션</h1>
              <p className="mt-2 text-sm font-bold text-slate-500">{nextAction.title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminLink href="/admin/risk">신고·리스크</AdminLink>
              <AdminLink href="/admin/users">유저 관리</AdminLink>
              <AdminLink href="/admin/audit?targetType=TRUST_REPORT">감사 로그</AdminLink>
              <AdminLink href={nextAction.href}>바로 확인</AdminLink>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <MetricCard label="검토 대기" value={`${state.summary.queueCount}건`} tone="blue" />
            <MetricCard label="신고 대기" value={`${state.summary.openReports}건`} tone="red" />
            <MetricCard label="AI 자동 신고" value={`${state.summary.autoEscalatedReports}건`} tone="amber" />
            <MetricCard label="평균 평점" value={state.summary.averageRating} tone="green" />
            <MetricCard label="전체 리뷰" value={`${state.summary.totalReviews.toLocaleString()}건`} tone="slate" />
            <MetricCard label="낮은 리뷰" value={`${state.summary.lowReviews}건`} tone="amber" />
            <MetricCard label="숨김" value={`${state.summary.hiddenReviews}건`} tone="red" />
            <MetricCard label="검토 중" value={`${state.summary.underReviewReviews}건`} tone="blue" />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
                  WORK QUEUE
                </p>
                <h2 className="text-xl font-black">처리 대기</h2>
              </div>
              <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-600">
                {state.queue.length}건
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {state.queue.length ? (
                state.queue.map((item) => <QueueCard key={`${item.kind}-${item.id}`} item={item} />)
              ) : (
                <div className="p-10 text-center">
                  <p className="text-2xl font-black">검토 대기 항목 없음</p>
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-lg font-black text-slate-950">분포 / 감지 유형</summary>
              <div className="mt-4 space-y-5">
                <section>
                  <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">RATING</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {state.ratingDistribution.map((item) => (
                      <div key={item.rating} className="grid grid-cols-[44px_1fr_56px] items-center gap-3">
                        <span className="text-sm font-black">{item.rating}점</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[var(--gg-accent)]" style={{ width: `${item.width}%` }} />
                        </div>
                        <span className="text-right text-xs font-black text-slate-500">{item.percentLabel}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">DETECTION</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {state.detectionTypes.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                        <span className="text-sm font-black">{item.label}</span>
                        <span className="text-sm font-black text-[var(--gg-accent)]">{item.count}건</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </details>

          </aside>
        </div>
      </div>
    </main>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  return (
    <article className="p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.kind === "REPORT" ? "red" : "blue"}>
              {item.kind === "REPORT" ? "신고" : "리뷰"}
            </Badge>
            <Badge tone={item.tone}>{item.typeLabel}</Badge>
            <Badge tone="slate">{item.statusLabel}</Badge>
            <Badge tone="amber">{item.confidenceLabel}</Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-black text-slate-500">{item.usersLabel}</p>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-base font-bold leading-7 text-slate-950">
                {item.body}
              </p>
              {item.note ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                  {item.note}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 text-left md:min-w-[180px] md:text-right">
              <span className="text-sm font-black text-slate-500">{item.createdAtLabel}</span>
              <span className="text-sm font-black text-slate-950">{item.ratingLabel}</span>
              <span className="text-xs font-bold text-slate-500">{item.traceLabel}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.targetUserHref ? <AdminLink href={item.targetUserHref}>대상 유저</AdminLink> : null}
            {item.orderHref ? <AdminLink href={item.orderHref}>주문</AdminLink> : null}
            {item.riskHref ? <AdminLink href={item.riskHref}>리스크</AdminLink> : null}
            {item.auditHref ? <AdminLink href={item.auditHref}>감사</AdminLink> : null}
          </div>
        </div>
      </div>

      {item.kind === "REPORT" && item.reportStatus ? (
        <ReviewModerationReportActions reportId={item.id} currentStatus={item.reportStatus} />
      ) : null}

      {item.kind === "REVIEW" && item.reviewModerationStatus ? (
        <ReviewModerationReviewActions reviewId={item.id} currentStatus={item.reviewModerationStatus} />
      ) : null}
    </article>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber" | "red" | "slate";
}) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${metricToneClass(tone)}`}>
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
    >
      {children}
    </Link>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeToneClass(tone)}`}>{children}</span>;
}

function getNextAction(state: ReviewModerationState) {
  if (state.summary.openReports > 0) {
    return {
      title: `신고 대기 ${state.summary.openReports}건`,
      href: "/admin/review-moderation",
    };
  }

  if (state.summary.autoEscalatedReports > 0) {
    return {
      title: `AI 자동 신고 ${state.summary.autoEscalatedReports}건`,
      href: "/admin/review-moderation",
    };
  }

  return {
    title: "처리 항목 없음",
    href: "/admin/audit?targetType=REVIEW",
  };
}

function metricToneClass(tone: "blue" | "green" | "amber" | "red" | "slate") {
  const classes = {
    blue: "border-sky-200 text-sky-700",
    green: "border-emerald-200 text-emerald-700",
    amber: "border-amber-200 text-amber-700",
    red: "border-red-200 text-red-700",
    slate: "border-slate-200 text-slate-950",
  };

  return classes[tone];
}

function badgeToneClass(tone: string) {
  const classes: Record<string, string> = {
    blue: "bg-sky-100 text-sky-700",
    cyan: "bg-sky-100 text-sky-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return classes[tone] ?? classes.slate;
}

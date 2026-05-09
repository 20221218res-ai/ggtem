import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { getAdminUserDetail } from "@/lib/admin/users";
import UserAccessActions from "../user-access-actions";
import UserNoteForm from "./user-note-form";

type AdminUserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

type UserDetail = NonNullable<Awaited<ReturnType<typeof getAdminUserDetail>>>;

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS);
  const { userId } = await params;
  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    notFound();
  }

  const reportSignalCount =
    detail.metrics.reportsMade + detail.metrics.reportsReceived;
  const walletHasLocks = detail.wallet
    ? detail.wallet.escrowLockedBalance !== "0" ||
      detail.wallet.withdrawalLocked !== "0"
    : false;
  const totalTradeSignals =
    detail.metrics.buyerOrders + detail.metrics.sellerOrders + detail.metrics.listings;
  const latestRestriction = detail.restrictionTimeline[0] ?? null;
  const latestAdminNote = detail.adminNotes[0] ?? null;
  const nextAction = getUserDetailNextAction({
    status: detail.user.status,
    walletHasLocks,
    reportSignalCount,
    restrictionCount: detail.restrictionTimeline.length,
    adminNoteCount: detail.metrics.adminNotes,
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-600">
              관리자 / 유저 상세
            </p>
            <h1 className="mt-1 text-2xl font-black">
              {detail.user.displayName}
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {detail.user.email} / {roleLabel(detail.user.role)} /{" "}
              {statusLabel(detail.user.status)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/admin/users" label="유저 목록" tone="dark" />
            <LinkButton
              href={`/admin/risk?query=${encodeURIComponent(detail.user.email)}`}
              label="신고/위험"
              tone="amber"
            />
            <LinkButton
              href={`/admin/audit?query=${encodeURIComponent(detail.user.email)}`}
              label="감사 로그"
            />
            <LinkButton
              href={`/admin/finance/ledger?q=${encodeURIComponent(
                detail.user.userId,
              )}`}
              label="지갑 원장"
              tone="blue"
            />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="계정 상태"
            value={statusLabel(detail.user.status)}
            body={accountStatusHint(detail.user.status)}
            tone={detail.user.status === "ACTIVE" ? "emerald" : "amber"}
          />
          <SummaryCard
            label="거래 신호"
            value={`${totalTradeSignals.toLocaleString("ko-KR")}건`}
            body="구매 주문, 판매 주문, 등록 매물을 합산한 활동 신호입니다."
            tone="cyan"
          />
          <SummaryCard
            label="신고/리뷰 신호"
            value={`${reportSignalCount.toLocaleString("ko-KR")}건`}
            body="작성한 신고와 받은 신고를 함께 보고 반복 패턴을 확인하세요."
            tone={reportSignalCount > 0 ? "amber" : "slate"}
          />
          <SummaryCard
            label="지갑 주의"
            value={walletHasLocks ? "잠금 있음" : "정상"}
            body={walletStatusHint(walletHasLocks, detail.wallet !== null)}
            tone={walletHasLocks ? "red" : "blue"}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <OperationalSignalCard
            title="최근 계정 조치"
            value={
              latestRestriction
                ? `${statusLabel(latestRestriction.previousStatus ?? "N/A")} -> ${statusLabel(
                    latestRestriction.nextStatus ?? "N/A",
                  )}`
                : "조치 이력 없음"
            }
            body={
              latestRestriction
                ? `${latestRestriction.createdAt} / ${
                    latestRestriction.adminName ?? "System"
                  } / ${latestRestriction.reason ?? "사유 없음"}`
                : "아직 제한 또는 복구 이력이 없습니다."
            }
            href="#restriction-timeline"
            tone={latestRestriction ? "amber" : "slate"}
          />
          <OperationalSignalCard
            title="최근 운영 메모"
            value={latestAdminNote ? latestAdminNote.adminName : "메모 없음"}
            body={
              latestAdminNote
                ? `${latestAdminNote.createdAt} / ${latestAdminNote.body}`
                : "운영 판단 근거가 있다면 메모를 남겨 주세요."
            }
            href="#admin-notes"
            tone={latestAdminNote ? "cyan" : "slate"}
          />
          <OperationalSignalCard
            title="다음 확인 항목"
            value={nextAction.title}
            body={nextAction.body}
            href={nextAction.href}
            tone={nextAction.tone}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="구매 주문" value={detail.metrics.buyerOrders} />
          <Metric label="판매 주문" value={detail.metrics.sellerOrders} />
          <Metric label="매물" value={detail.metrics.listings} />
          <Metric label="작성 신고" value={detail.metrics.reportsMade} />
          <Metric label="받은 신고" value={detail.metrics.reportsReceived} />
          <Metric label="작성 리뷰" value={detail.metrics.reviewsGiven} />
          <Metric label="받은 리뷰" value={detail.metrics.reviewsReceived} />
          <Metric label="감사 로그" value={detail.metrics.auditLogs} />
          <Metric label="운영 메모" value={detail.metrics.adminNotes} />
        </section>

        {detail.user.isOperator ? (
          <section className="rounded-lg border border-[color-mix(in_srgb,var(--gg-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,transparent)] p-5 text-sm font-semibold leading-6 text-[var(--gg-accent)]">
            <p className="font-black">운영 계정 상세 확인</p>
            <p className="mt-2">
              이 유저는 관리자 페이지 접근 권한이 있는 운영 계정입니다. 권한 변경, 상태 제한, 감사 로그 확인은 일반 유저보다 더 보수적으로 처리하세요.
            </p>
          </section>
        ) : null}

        <LinkedAccountSignalsSection detail={detail} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={detail.user.isOperator ? "cyan" : "emerald"}>
                  {roleLabel(detail.user.role)}
                </Badge>
                <Badge tone={statusTone(detail.user.status)}>
                  {statusLabel(detail.user.status)}
                </Badge>
                {detail.user.isOperator ? (
                  <Badge tone="blue">운영 계정</Badge>
                ) : (
                  <Badge>일반 유저</Badge>
                )}
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-600">
                생성 {detail.user.createdAt} / 수정 {detail.user.updatedAt}
              </p>
            </div>

            <div className="grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-2 xl:min-w-[520px]">
              {detail.wallet ? (
                <>
                  <WalletLine
                    label="사용 가능"
                    value={`${detail.wallet.availableBalance} ${detail.wallet.currency}`}
                  />
                  <WalletLine
                    label="에스크로 잠금"
                    value={`${detail.wallet.escrowLockedBalance} ${detail.wallet.currency}`}
                  />
                  <WalletLine
                    label="출금 가능"
                    value={`${detail.wallet.withdrawableBalance} ${detail.wallet.currency}`}
                  />
                  <WalletLine
                    label="출금 처리 잠금"
                    value={`${detail.wallet.withdrawalLocked} ${detail.wallet.currency}`}
                  />
                </>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  아직 지갑이 없습니다.
                </p>
              )}
            </div>
          </div>

          <UserAccessActions
            userId={detail.user.userId}
            currentRole={detail.user.role}
            currentStatus={detail.user.status}
          />
        </section>

        <WalletLedgerSection detail={detail} />

        <div id="admin-notes" className="scroll-mt-32 grid gap-5 xl:grid-cols-2">
          <UserNoteForm userId={detail.user.userId} />
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">최근 운영 메모</h2>
            <div className="mt-5 space-y-3">
              {detail.adminNotes.map((note) => (
                <div
                  key={note.noteId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm leading-6 text-slate-700">{note.body}</p>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {note.adminName} / {note.adminEmail} / {note.createdAt}
                  </p>
                </div>
              ))}
              {detail.adminNotes.length === 0 ? (
                <EmptyState label="아직 운영 메모가 없습니다." />
              ) : null}
            </div>
          </section>
        </div>

        <div id="orders" className="scroll-mt-32 grid gap-5 xl:grid-cols-2">
          <ListSection
            title="최근 구매 주문"
            emptyLabel="구매 주문이 없습니다."
            items={detail.recentBuyerOrders.map((order) => ({
              key: order.orderId,
              title: order.orderNumber,
              subtitle: `${order.listingTitle} / ${statusLabel(order.status)}`,
              meta: `${order.amount} ${order.currency} / ${order.createdAt}`,
              href: `/admin/orders?orderId=${order.orderId}`,
            }))}
          />
          <ListSection
            title="최근 판매 주문"
            emptyLabel="판매 주문이 없습니다."
            items={detail.recentSellerOrders.map((order) => ({
              key: order.orderId,
              title: order.orderNumber,
              subtitle: `${order.listingTitle} / ${statusLabel(order.status)}`,
              meta: `${order.amount} ${order.currency} / ${order.createdAt}`,
              href: `/admin/orders?orderId=${order.orderId}`,
            }))}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <ListSection
            title="최근 매물"
            emptyLabel="매물이 없습니다."
            items={detail.listings.map((listing) => ({
              key: listing.listingId,
              title: listing.title,
              subtitle: statusLabel(listing.status),
              meta: `${listing.unitPrice} ${listing.currency} / ${listing.createdAt}`,
              href: `/listings/${listing.listingId}`,
            }))}
          />
          <ListSection
            title="관리자 감사 기록"
            emptyLabel="감사 로그가 없습니다."
            items={detail.auditLogs.map((log) => ({
              key: log.logId,
              title: auditActionLabel(log.action),
              subtitle: `${log.targetType} / ${log.targetId ?? "N/A"}`,
              meta: `${log.reason ?? "사유 없음"} / ${log.createdAt}`,
              href: `/admin/audit?query=${encodeURIComponent(log.action)}`,
            }))}
          />
        </div>

        <section
          id="restriction-timeline"
          className="scroll-mt-32 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-black text-slate-950">
            계정 조치 타임라인          </h2>
          <div className="mt-5 space-y-3">
            {detail.restrictionTimeline.map((log) => (
              <div
                key={log.logId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">
                    {statusLabel(log.previousStatus ?? "N/A")} -{" "}
                    {statusLabel(log.nextStatus ?? "N/A")}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">
                    {log.createdAt}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {log.reason ?? "사유 없음"}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  처리자 {log.adminName ?? "System"}
                </p>
              </div>
            ))}
            {detail.restrictionTimeline.length === 0 ? (
              <EmptyState label="계정 조치 이력이 없습니다." />
            ) : null}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <ReviewSection
            title="받은 리뷰"
            emptyLabel="받은 리뷰가 없습니다."
            reviews={detail.reviewsReceived.map((review) => ({
              key: review.reviewId,
              title: `${review.rating}/5 / 작성자 ${review.buyerName}`,
              subtitle: `주문 ${review.orderNumber}`,
              body: review.comment ?? "구매자가 별점만 남겼습니다.",
              meta: review.createdAt,
            }))}
          />
          <ReviewSection
            title="작성한 리뷰"
            emptyLabel="작성한 리뷰가 없습니다."
            reviews={detail.reviewsGiven.map((review) => ({
              key: review.reviewId,
              title: `${review.rating}/5 / 판매자 ${review.sellerName}`,
              subtitle: `주문 ${review.orderNumber}`,
              body: review.comment ?? "구매자가 별점만 남겼습니다.",
              meta: review.createdAt,
            }))}
          />
        </div>

        <div id="reports" className="scroll-mt-32 grid gap-5 xl:grid-cols-2">
          <ReportSection
            title="받은 신고"
            emptyLabel="받은 신고가 없습니다."
            reports={detail.reportsReceived.map((report) => ({
              key: report.reportId,
              title: `${reportCategoryLabel(report.category)} / ${severityLabel(
                report.severity,
              )}`,
              subtitle: `신고자 ${report.reporterName} / ${statusLabel(
                report.status,
              )}`,
              body: report.description,
              meta: `${report.orderNumber ?? "주문 없음"} / ${report.createdAt}`,
            }))}
          />
          <ReportSection
            title="작성한 신고"
            emptyLabel="작성한 신고가 없습니다."
            reports={detail.reportsMade.map((report) => ({
              key: report.reportId,
              title: `${reportCategoryLabel(report.category)} / ${severityLabel(
                report.severity,
              )}`,
              subtitle: `대상 ${report.targetName} / ${statusLabel(report.status)}`,
              body: report.description,
              meta: `${report.orderNumber ?? "주문 없음"} / ${report.createdAt}`,
            }))}
          />
        </div>
      </section>
    </main>
  );
}

function WalletLedgerSection({ detail }: { detail: UserDetail }) {
  return (
    <section
      id="wallet-ledger"
      className="scroll-mt-32 rounded-lg border border-blue-200 bg-blue-50 p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-blue-700">지갑 원장</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            최근 금액 이동
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
            충전, 출금, 에스크로, 환불, 정산 문의를 처리하기 전에 이 유저의 최근 원장 흐름을 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton
            href={`/admin/finance/ledger?q=${encodeURIComponent(detail.user.userId)}`}
            label="전체 원장"
            tone="blue"
          />
          <LinkButton
            href={`/admin/audit?query=${encodeURIComponent(detail.user.userId)}`}
            label="감사 로그"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {detail.walletLedgerEntries.map((entry) => (
          <div key={entry.entryId} className="rounded-lg border border-blue-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={entry.direction === "CREDIT" ? "emerald" : "red"}>
                    {directionLabel(entry.direction)}
                  </Badge>
                  <Badge>{bucketLabel(entry.bucket)}</Badge>
                </div>
                <p className="mt-3 text-sm font-black text-slate-950">
                  {ledgerTypeLabel(entry.type)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {entry.memo ?? "원장 메모 없음"}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-lg font-black text-blue-700">
                  {entry.amount} {entry.currency}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {entry.createdAt}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
              <span>
                참조 {referenceLabel(entry.referenceType)} / {entry.referenceId ?? "N/A"}
              </span>
              {entry.referenceHref ? (
                <Link
                  href={entry.referenceHref}
                  className="font-bold text-blue-700 hover:text-blue-900"
                >
                  추적 열기
                </Link>
              ) : null}
            </div>
          </div>
        ))}
        {detail.walletLedgerEntries.length === 0 ? (
          <EmptyState label="아직 지갑 원장 기록이 없습니다." />
        ) : null}
      </div>
    </section>
  );
}

function LinkedAccountSignalsSection({ detail }: { detail: UserDetail }) {
  const highSignalCount = detail.linkedAccountSignals.filter(
    (signal) => signal.riskLevel === "HIGH",
  ).length;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-amber-700">중복 계정 신호</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            1인 1계정 원칙 점검
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
            같은 출금 주소, 출금 IP, 기기키, 로그인 IP를 공유하는 계정이 있는지 확인합니다.
            이 신호만으로 제재하지 말고 주문/출금/상담 기록과 함께 판단하세요.
          </p>
        </div>
        <Badge tone={highSignalCount > 0 ? "red" : detail.linkedAccountSignals.length > 0 ? "amber" : "emerald"}>
          {detail.linkedAccountSignals.length > 0
            ? `${detail.linkedAccountSignals.length}개 신호`
            : "신호 없음"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {detail.linkedAccountSignals.map((signal) => (
          <article key={`${signal.signalType}:${signal.value}`} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={linkedRiskTone(signal.riskLevel)}>
                    {linkedRiskLabel(signal.riskLevel)}
                  </Badge>
                  <Badge tone="amber">{signal.label}</Badge>
                </div>
                <p className="mt-3 break-all text-sm font-black text-slate-950">
                  {signal.value}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  관련 계정 {signal.relatedUserCount}개 / 마지막 신호 {signal.lastSeenAt}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {signal.relatedUsers.map((user) => (
                <Link
                  key={`${signal.signalType}:${user.userId}`}
                  href={`/admin/users/${user.userId}`}
                  className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-amber-300 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="block text-sm font-black text-slate-950">
                      {user.displayName}
                    </span>
                    <span className="block text-xs font-semibold text-slate-500">
                      {user.email}
                    </span>
                  </span>
                  <span className="mt-2 text-xs font-bold text-slate-500 sm:mt-0">
                    {statusLabel(user.status)} / {user.lastSeenAt}
                  </span>
                </Link>
              ))}
            </div>
          </article>
        ))}
        {detail.linkedAccountSignals.length === 0 ? (
          <EmptyState label="현재 동일 출금주소, IP, 기기키로 연결된 다른 계정이 없습니다." />
        ) : null}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  body,
  tone = "slate",
}: {
  label: string;
  value: string;
  body: string;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${toneClasses(tone)}`}>
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-3 text-xs font-semibold leading-5 opacity-80">{body}</p>
    </div>
  );
}

function OperationalSignalCard({
  title,
  value,
  body,
  href,
  tone,
}: {
  title: string;
  value: string;
  body: string;
  href: string;
  tone: Tone;
}) {
  return (
    <a
      href={href}
      className={`rounded-lg border p-5 shadow-sm hover:opacity-90 ${toneClasses(tone)}`}
    >
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-2 line-clamp-2 text-xl font-black tracking-tight">{value}</p>
      <p className="mt-3 line-clamp-3 text-xs font-semibold leading-5 opacity-80">
        {body}
      </p>
      <p className="mt-3 text-xs font-black underline underline-offset-4">
        바로 확인
      </p>
    </a>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-emerald-700">
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function WalletLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="block text-xs text-slate-500">{label}</span>
      <span className="mt-1 block break-all font-black text-slate-950">{value}</span>
    </p>
  );
}

function ListSection({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ key: string; title: string; subtitle: string; meta: string; href: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="block rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-emerald-300 hover:bg-emerald-50"
          >
            <p className="text-sm font-black text-slate-950">{item.title}</p>
            <p className="mt-2 text-sm text-slate-700">{item.subtitle}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">{item.meta}</p>
          </Link>
        ))}
        {items.length === 0 ? <EmptyState label={emptyLabel} /> : null}
      </div>
    </section>
  );
}

function ReviewSection({
  title,
  emptyLabel,
  reviews,
}: {
  title: string;
  emptyLabel: string;
  reviews: Array<{ key: string; title: string; subtitle: string; body: string; meta: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-5 space-y-3">
        {reviews.map((review) => (
          <div key={review.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">{review.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{review.subtitle}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{review.body}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">{review.meta}</p>
          </div>
        ))}
        {reviews.length === 0 ? <EmptyState label={emptyLabel} /> : null}
      </div>
    </section>
  );
}

function ReportSection({
  title,
  emptyLabel,
  reports,
}: {
  title: string;
  emptyLabel: string;
  reports: Array<{ key: string; title: string; subtitle: string; body: string; meta: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-5 space-y-3">
        {reports.map((report) => (
          <div key={report.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">{report.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{report.subtitle}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{report.body}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">{report.meta}</p>
          </div>
        ))}
        {reports.length === 0 ? <EmptyState label={emptyLabel} /> : null}
      </div>
    </section>
  );
}

type Tone = "slate" | "cyan" | "blue" | "emerald" | "amber" | "red";

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${toneClasses(tone)}`}>
      {children}
    </span>
  );
}

function LinkButton({
  href,
  label,
  tone = "slate",
}: {
  href: string;
  label: string;
  tone?: "slate" | "blue" | "amber" | "dark";
}) {
  if (tone === "dark") {
    return (
      <Link
        href={href}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-slate-950 hover:brightness-105"
      >
        {label}
      </Link>
    );
  }

  const className =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <Link href={href} className={`rounded-md border px-4 py-2 text-sm font-bold ${className}`}>
      {label}
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
      {label}
    </div>
  );
}

function toneClasses(tone: Tone) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    cyan: "border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return classes[tone];
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    CUSTOMER: "일반 유저",
    CS: "고객지원",
    MODERATOR: "모더레이터",
    FINANCE: "재무 운영",
    ADMIN: "관리자",
    SUPER: "최고 관리자",
  };
  return labels[role] ?? role;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "정상",
    SUSPENDED: "정지",
    SELLING_RESTRICTED: "판매 제한",
    WITHDRAWAL_HOLD: "출금 보류",
    BANNED: "차단",
    REQUESTED: "주문 요청",
    ESCROW_LOCKED: "에스크로 잠금",
    SELLER_RESPONSE_PENDING: "판매자 응답 대기",
    DELIVERY_IN_PROGRESS: "전달 진행",
    DELIVERY_COMPLETED: "전달 완료",
    BUYER_CONFIRM_PENDING: "인수확정 대기",
    COMPLETED: "완료",
    CANCELED: "취소",
    CANCELLED: "취소",
    DISPUTED: "분쟁 중",
    REFUNDED: "환불 완료",
    OPEN: "접수",
    UNDER_REVIEW: "검토 중",
    RESOLVED: "처리 완료",
    DISMISSED: "기각",
    ACTIVE_LISTING: "판매 중",
    INACTIVE: "비활성",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): Tone {
  if (status === "ACTIVE") return "emerald";
  if (status === "SELLING_RESTRICTED" || status === "WITHDRAWAL_HOLD") {
    return "amber";
  }
  if (status === "SUSPENDED" || status === "BANNED") return "red";
  return "slate";
}

function linkedRiskTone(riskLevel: string): Tone {
  if (riskLevel === "HIGH") return "red";
  if (riskLevel === "MEDIUM") return "amber";
  return "blue";
}

function linkedRiskLabel(riskLevel: string) {
  if (riskLevel === "HIGH") return "높은 위험";
  if (riskLevel === "MEDIUM") return "주의";
  return "참고";
}

function accountStatusHint(status: string) {
  const hints: Record<string, string> = {
    ACTIVE: "로그인, 거래, 판매, 출금 흐름을 정상적으로 이용할 수 있습니다.",
    SELLING_RESTRICTED: "판매 등록과 판매 진행이 제한됩니다.",
    WITHDRAWAL_HOLD: "위험 신호가 있어 출금 요청 또는 처리가 보류됩니다.",
    SUSPENDED: "계정 이용이 정지된 상태입니다. 복구 전 근거 확인이 필요합니다.",
    BANNED: "차단 상태입니다. 계정 접근 해제 전 근거를 함께 확인하세요.",
  };
  return hints[status] ?? "계정 상태별 이용 가능 범위를 확인하세요.";
}

function walletStatusHint(hasLocks: boolean, hasWallet: boolean) {
  if (!hasWallet) return "아직 지갑이 생성되지 않은 유저입니다.";
  if (hasLocks) {
    return "에스크로 또는 출금 처리 잠금이 있어 거래/출금 흐름 확인이 필요합니다.";
  }
  return "잠금 금액 없이 일반적인 지갑 상태입니다.";
}

function getUserDetailNextAction({
  status,
  walletHasLocks,
  reportSignalCount,
  restrictionCount,
  adminNoteCount,
}: {
  status: string;
  walletHasLocks: boolean;
  reportSignalCount: number;
  restrictionCount: number;
  adminNoteCount: number;
}) {
  if (walletHasLocks) {
    return {
      title: "지갑 원장 확인",
      body: "잠금 금액이 있으면 출금, 에스크로, 환불 흐름을 먼저 확인하는 것이 안전합니다.",
      href: "#wallet-ledger",
      tone: "red" as const,
    };
  }
  if (reportSignalCount > 0) {
    return {
      title: "신고 패턴 확인",
      body: "작성/받은 신고가 있으면 반복 패턴, 주문 번호, 상대 유저를 먼저 비교하세요.",
      href: "#reports",
      tone: "amber" as const,
    };
  }
  if (status !== "ACTIVE" || restrictionCount > 0) {
    return {
      title: "제한 이력 확인",
      body: "현재 제한 상태이거나 이전 조치가 있으면 제한/복구 타임라인을 먼저 확인하세요.",
      href: "#restriction-timeline",
      tone: "cyan" as const,
    };
  }
  if (adminNoteCount === 0) {
    return {
      title: "운영 메모 작성",
      body: "아직 운영 메모가 없습니다. 상담이나 조치가 있었다면 간단한 근거를 남겨 주세요.",
      href: "#admin-notes",
      tone: "blue" as const,
    };
  }
  return {
    title: "최근 주문 확인",
    body: "위험 신호가 없으면 최근 구매/판매 주문 흐름부터 확인하세요.",
    href: "#orders",
    tone: "emerald" as const,
  };
}

function directionLabel(direction: string) {
  if (direction === "CREDIT") return "증가";
  if (direction === "DEBIT") return "차감";
  return direction;
}

function bucketLabel(bucket: string) {
  const labels: Record<string, string> = {
    AVAILABLE: "사용 가능",
    ESCROW_LOCKED: "에스크로",
    WITHDRAWABLE: "출금 가능",
    PENDING_SETTLEMENT: "정산 대기",
    WITHDRAWAL_LOCKED: "출금 잠금",
    BUY_REQUEST_LOCKED: "구매요청 예치",
    PLATFORM_REVENUE: "플랫폼 수익",
  };
  return labels[bucket] ?? bucket.replaceAll("_", " ");
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    DEPOSIT: "충전",
    WITHDRAWAL: "출금",
    ESCROW_LOCK: "에스크로 잠금",
    ESCROW_RELEASE: "에스크로 지급",
    ESCROW_REFUND: "에스크로 환불",
    SETTLEMENT: "정산",
    DISPUTE_REFUND: "분쟁 환불",
    DISPUTE_RELEASE: "분쟁 정산",
    ADMIN_ADJUSTMENT: "관리자 조정",
    BUY_REQUEST_LOCK: "구매요청 잠금",
    BUY_REQUEST_RELEASE: "구매요청 해제",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function referenceLabel(referenceType: string | null) {
  if (!referenceType) return "참조 없음";
  const labels: Record<string, string> = {
    ORDER: "주문",
    DEPOSIT_REQUEST: "충전 요청",
    WITHDRAWAL_REQUEST: "출금 요청",
    BUY_REQUEST: "구매 요청",
  };
  return labels[referenceType] ?? referenceType;
}

function reportCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    FRAUD: "사기",
    ABUSE: "욕설/비방",
    DELIVERY: "전달 문제",
    PAYMENT: "결제 문제",
    OTHER: "기타",
  };
  return labels[category] ?? category.replaceAll("_", " ");
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    LOW: "낮음",
    MEDIUM: "중간",
    HIGH: "높음",
    CRITICAL: "긴급",
  };
  return labels[severity] ?? severity;
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    USER_ACCESS_UPDATED: "계정 접근 권한 변경",
    USER_NOTE_CREATED: "운영 메모 추가",
    DISPUTE_REFUNDED_TO_BUYER: "분쟁 구매자 환불",
    DISPUTE_RELEASED_TO_SELLER: "분쟁 판매자 정산",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}

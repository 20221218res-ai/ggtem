import { getPrismaClient } from "@/lib/prisma";
import { formatFixedAmount, parseFixedAmount } from "@/lib/wallet/manual-deposit";
import {
  AUDIT_FOLLOWUP_RESOLVED_ACTION,
  SENSITIVE_AUDIT_ACTIONS,
} from "@/lib/admin/audit";

const SELLER_RISK_WINDOW_DAYS = 30;

type OperationsQueueItem = {
  key: string;
  label: string;
  count: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  priorityScore: number;
  oldestWaitingLabel: string;
  previewLabel: string;
  slaLabel: string;
  slaBreached: boolean;
  href: string;
  quickLinkLabel: string;
  actionHint: string;
  tone: string;
  description: string;
};

export type AdminDashboardState = {
  metrics: {
    openDisputes: number;
    activeOrders: number;
    activeListings: number;
    lockedQuantity: string;
    buyerEscrow: string;
    sellerAvailable: string;
  };
  auditFollowup: {
    unresolvedMissingReasons: number;
    href: string;
    previewLabel: string | null;
    oldestCreatedAt: string | null;
  };
  operationsQueue: OperationsQueueItem[];
  orderStatusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  recentOrderTrend: Array<{
    dateLabel: string;
    count: number;
  }>;
  disputeStatusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  recentDisputeTrend: Array<{
    dateLabel: string;
    count: number;
  }>;
  recentOrders: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    listingTitle: string;
    buyerName: string;
    sellerName: string;
    grossAmount: string;
    currency: string;
    createdAt: string;
  }>;
  recentDisputes: Array<{
    orderId: string;
    orderNumber: string;
    listingTitle: string;
    buyerName: string;
    sellerName: string;
    latestNote: string | null;
    createdAt: string;
  }>;
  slaIncidents: Array<{
    incidentId: string;
    queueKey: string;
    label: string;
    status: string;
    priority: string;
    priorityScore: number;
    slaLabel: string;
    previewLabel: string;
    href: string;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    firstDetectedAt: string;
    lastDetectedAt: string;
    resolvedAt: string | null;
  }>;
  offPlatformChatAlerts: Array<{
    reportId: string;
    orderId: string | null;
    orderNumber: string | null;
    listingTitle: string | null;
    severity: string;
    status: string;
    description: string;
    reporterName: string;
    targetName: string;
    targetEmail: string;
    createdAt: string;
  }>;
};

export async function getAdminDashboardState(): Promise<AdminDashboardState> {
  const prisma = getPrismaClient();
  const trendStart = startOfDayOffset(6);
  const auditFollowup = await getUnresolvedAuditFollowupSummary();

  const [
    openDisputes,
    activeOrders,
    activeListings,
    lockedInventoryAggregate,
    wallets,
    orderStatusGroups,
    trendOrders,
    disputeStatusGroups,
    trendDisputes,
    recentOrders,
    recentDisputes,
    pendingDeposits,
    pendingWithdrawals,
    openTrustReports,
    highTrustReports,
    offPlatformChatAlerts,
    sellerRiskCandidates,
    recentAutoNotes,
    oldestDispute,
    oldestDeposit,
    oldestWithdrawal,
    oldestTrustReport,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        status: "DISPUTED",
      },
    }),
    prisma.order.count({
      where: {
        status: {
          in: [
            "ESCROW_LOCKED",
            "SELLER_RESPONSE_PENDING",
            "DELIVERY_IN_PROGRESS",
            "DELIVERY_COMPLETED",
            "BUYER_CONFIRM_PENDING",
          ],
        },
      },
    }),
    prisma.listing.count({
      where: {
        status: "ACTIVE",
      },
    }),
    prisma.listingInventory.aggregate({
      _sum: {
        lockedQuantity: true,
      },
    }),
    prisma.wallet.findMany({
      select: {
        availableBalance: true,
        escrowLockedBalance: true,
        user: {
          select: {
            role: true,
          },
        },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: trendStart,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: {
        status: {
          in: ["DISPUTED", "REFUNDED", "COMPLETED"],
        },
        events: {
          some: {
            OR: [
              {
                status: "DISPUTED",
              },
              {
                message: {
                  contains: "DISPUTE_",
                },
              },
            ],
          },
        },
      },
      _count: {
        status: true,
      },
    }),
    prisma.order.findMany({
      where: {
        updatedAt: {
          gte: trendStart,
        },
        events: {
          some: {
            status: "DISPUTED",
          },
        },
      },
      select: {
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
    }),
    prisma.order.findMany({
      include: {
        buyer: true,
        seller: true,
        listing: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
    prisma.order.findMany({
      where: {
        status: "DISPUTED",
      },
      include: {
        buyer: true,
        seller: true,
        listing: true,
        events: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    }),
    prisma.depositRequest.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.withdrawalRequest.count({
      where: {
        status: {
          in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"],
        },
      },
    }),
    prisma.trustReport.count({
      where: {
        status: {
          in: ["OPEN", "UNDER_REVIEW"],
        },
      },
    }),
    prisma.trustReport.count({
      where: {
        status: {
          in: ["OPEN", "UNDER_REVIEW"],
        },
        severity: {
          in: ["HIGH", "CRITICAL"],
        },
      },
    }),
    prisma.trustReport.findMany({
      where: {
        status: {
          in: ["OPEN", "UNDER_REVIEW"],
        },
        OR: [
          {
            category: "OFF_PLATFORM_PAYMENT",
          },
          {
            sourceType: "OFF_PLATFORM_CONTACT",
          },
        ],
      },
      include: {
        reporter: true,
        targetUser: true,
        order: {
          include: {
            listing: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
    countSellerRiskCandidates(prisma),
    prisma.adminUserNote.count({
      where: {
        body: {
          startsWith: "[AUTO] Selling",
        },
      },
    }),
    prisma.order.findFirst({
      where: {
        status: "DISPUTED",
      },
      select: {
        orderNumber: true,
        updatedAt: true,
        listing: {
          select: {
            title: true,
          },
        },
        buyer: {
          select: {
            displayName: true,
          },
        },
        seller: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
    }),
    prisma.depositRequest.findFirst({
      where: {
        status: "PENDING",
      },
      select: {
        amount: true,
        currency: true,
        requestedAt: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        requestedAt: "asc",
      },
    }),
    prisma.withdrawalRequest.findFirst({
      where: {
        status: {
          in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "SENT"],
        },
      },
      select: {
        amount: true,
        currency: true,
        requestedAt: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        requestedAt: "asc",
      },
    }),
    prisma.trustReport.findFirst({
      where: {
        status: {
          in: ["OPEN", "UNDER_REVIEW"],
        },
      },
      select: {
        category: true,
        severity: true,
        createdAt: true,
        targetUser: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  let buyerEscrow = 0n;
  let sellerAvailable = 0n;

  for (const wallet of wallets) {
    const available = parseFixedAmount(wallet.availableBalance.toString());
    const escrow = parseFixedAmount(wallet.escrowLockedBalance.toString());

    sellerAvailable += available;
    buyerEscrow += escrow;
  }

  const operationsQueue = buildOperationsQueueV2({
    openDisputes,
    openTrustReports,
    highTrustReports,
    sellerRiskCandidates,
    pendingDeposits,
    pendingWithdrawals,
    recentAutoNotes,
    unresolvedAuditFollowups: auditFollowup.unresolvedMissingReasons,
    oldestDisputeAt: oldestDispute?.updatedAt ?? null,
    oldestDepositAt: oldestDeposit?.requestedAt ?? null,
    oldestWithdrawalAt: oldestWithdrawal?.requestedAt ?? null,
    oldestTrustReportAt: oldestTrustReport?.createdAt ?? null,
    oldestAuditFollowupAt: auditFollowup.oldestCreatedAt
      ? new Date(auditFollowup.oldestCreatedAt)
      : null,
    oldestDisputePreview: oldestDispute
      ? `${oldestDispute.orderNumber} / ${oldestDispute.listing.title} / ${oldestDispute.buyer.displayName} vs ${oldestDispute.seller.displayName}`
      : null,
    oldestDepositPreview: oldestDeposit
      ? `${oldestDeposit.user.displayName} / ${oldestDeposit.amount.toString()} ${oldestDeposit.currency}`
      : null,
    oldestWithdrawalPreview: oldestWithdrawal
      ? `${oldestWithdrawal.user.displayName} / ${oldestWithdrawal.amount.toString()} ${oldestWithdrawal.currency}`
      : null,
    oldestTrustReportPreview: oldestTrustReport
      ? `${oldestTrustReport.severity} ${oldestTrustReport.category} / ${oldestTrustReport.targetUser.displayName}`
      : null,
    oldestAuditFollowupPreview: auditFollowup.previewLabel,
  });

  await recordSlaIncidents(prisma, operationsQueue);
  const slaIncidents = await prisma.adminSlaIncident.findMany({
    orderBy: [
      {
        status: "asc",
      },
      {
        lastDetectedAt: "desc",
      },
    ],
    take: 8,
  });

  return {
    metrics: {
      openDisputes,
      activeOrders,
      activeListings,
      lockedQuantity: lockedInventoryAggregate._sum.lockedQuantity?.toString() ?? "0",
      buyerEscrow: formatFixedAmount(buyerEscrow),
      sellerAvailable: formatFixedAmount(sellerAvailable),
    },
    auditFollowup,
    operationsQueue,
    orderStatusBreakdown: orderStatusGroups
      .map((group) => ({
        status: group.status,
        count: group._count.status,
      }))
      .sort((left, right) => right.count - left.count),
    recentOrderTrend: buildRecentOrderTrend(trendOrders.map((order) => order.createdAt)),
    disputeStatusBreakdown: disputeStatusGroups
      .map((group) => ({
        status:
          group.status === "COMPLETED" ? "RELEASED" : group.status,
        count: group._count.status,
      }))
      .sort((left, right) => right.count - left.count),
    recentDisputeTrend: buildRecentOrderTrend(
      trendDisputes.map((order) => order.updatedAt),
    ),
    recentOrders: recentOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      listingTitle: order.listing.title,
      buyerName: order.buyer.displayName,
      sellerName: order.seller.displayName,
      grossAmount: order.grossAmount.toString(),
      currency: order.currency,
      createdAt: formatKoreanDate(order.createdAt),
    })),
    recentDisputes: recentDisputes.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      listingTitle: order.listing.title,
      buyerName: order.buyer.displayName,
      sellerName: order.seller.displayName,
      latestNote: extractLatestDisputeNote(order.events),
      createdAt: formatKoreanDate(order.updatedAt),
    })),
    slaIncidents: slaIncidents.map((incident) => ({
      incidentId: incident.id,
      queueKey: incident.queueKey,
      label: incident.label,
      status: incident.status,
      priority: incident.priority,
      priorityScore: incident.priorityScore,
      slaLabel: incident.slaLabel,
      previewLabel: incident.previewLabel,
      href: incident.href,
      acknowledgedAt: incident.acknowledgedAt
        ? formatKoreanDate(incident.acknowledgedAt)
        : null,
      acknowledgedBy: incident.acknowledgedBy,
      firstDetectedAt: formatKoreanDate(incident.firstDetectedAt),
      lastDetectedAt: formatKoreanDate(incident.lastDetectedAt),
      resolvedAt: incident.resolvedAt
        ? formatKoreanDate(incident.resolvedAt)
        : null,
    })),
    offPlatformChatAlerts: offPlatformChatAlerts.map((report) => ({
      reportId: report.id,
      orderId: report.orderId,
      orderNumber: report.order?.orderNumber ?? null,
      listingTitle: report.order?.listing.title ?? null,
      severity: report.severity,
      status: report.status,
      description: report.description,
      reporterName: report.reporter.displayName,
      targetName: report.targetUser.displayName,
      targetEmail: report.targetUser.email,
      createdAt: formatKoreanDate(report.createdAt),
    })),
  };
}

function buildRecentOrderTrend(dates: Date[]) {
  const counts = new Map<string, number>();
  const labels: Array<{ key: string; dateLabel: string }> = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = startOfDayOffset(offset);
    const key = date.toISOString().slice(0, 10);
    counts.set(key, 0);
    labels.push({
      key,
      dateLabel: new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
        timeZone: "Asia/Seoul",
      }).format(date),
    });
  }

  for (const date of dates) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(date)
      .replaceAll("-", "-");

    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return labels.map((label) => ({
    dateLabel: label.dateLabel,
    count: counts.get(label.key) ?? 0,
  }));
}

function extractLatestDisputeNote(
  events: Array<{
    message: string;
    status: string;
  }>,
) {
  const matchingEvent = events.find(
    (event) =>
      event.status === "DISPUTED" ||
      event.message.toLowerCase().includes("problem") ||
      event.message.toLowerCase().includes("note:"),
  );

  if (!matchingEvent) {
    return null;
  }

  const noteMatch = matchingEvent.message.match(/Note:\s*(.+)$/i);
  return noteMatch ? noteMatch[1].trim() : matchingEvent.message;
}

function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function startOfDayOffset(daysAgo: number) {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

async function countSellerRiskCandidates(
  prisma: ReturnType<typeof getPrismaClient>,
) {
  const since = new Date(
    Date.now() - SELLER_RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const [lowReviewGroups, openReportGroups, highSeverityReportGroups] =
    await Promise.all([
      prisma.orderReview.groupBy({
        by: ["sellerId"],
        where: {
          rating: {
            lte: 2,
          },
          createdAt: {
            gte: since,
          },
        },
        _count: {
          rating: true,
        },
      }),
      prisma.trustReport.groupBy({
        by: ["targetUserId"],
        where: {
          status: {
            in: ["OPEN", "UNDER_REVIEW"],
          },
          createdAt: {
            gte: since,
          },
        },
        _count: {
          id: true,
        },
      }),
      prisma.trustReport.groupBy({
        by: ["targetUserId"],
        where: {
          status: {
            in: ["OPEN", "UNDER_REVIEW"],
          },
          severity: {
            in: ["HIGH", "CRITICAL"],
          },
          createdAt: {
            gte: since,
          },
        },
        _count: {
          id: true,
        },
      }),
    ]);

  return new Set([
    ...lowReviewGroups
      .filter((group) => group._count.rating >= 2)
      .map((group) => group.sellerId),
    ...openReportGroups
      .filter((group) => group._count.id >= 2)
      .map((group) => group.targetUserId),
    ...highSeverityReportGroups.map((group) => group.targetUserId),
  ]).size;
}

export async function getUnresolvedAuditFollowupSummary() {
  const prisma = getPrismaClient();
  const sensitiveWhere = {
    OR: SENSITIVE_AUDIT_ACTIONS.map((action) => ({
      action: {
        contains: action,
        mode: "insensitive" as const,
      },
    })),
  };

  const resolvedFollowups = await prisma.adminAuditLog.findMany({
    where: {
      action: AUDIT_FOLLOWUP_RESOLVED_ACTION,
      targetType: "ADMIN_AUDIT_LOG",
      targetId: {
        not: null,
      },
    },
    select: {
      targetId: true,
    },
  });
  const resolvedTargetIds = resolvedFollowups
    .map((followup) => followup.targetId)
    .filter((targetId): targetId is string => Boolean(targetId));
  const unresolvedWhere = {
    ...sensitiveWhere,
    OR: [
      ...sensitiveWhere.OR,
    ],
    AND: [
      {
        OR: [
          {
            reason: null,
          },
          {
            reason: "",
          },
        ],
      },
    ],
    ...(resolvedTargetIds.length > 0
      ? {
          id: {
            notIn: resolvedTargetIds,
          },
        }
      : {}),
  };

  const [count, oldest] = await Promise.all([
    prisma.adminAuditLog.count({
      where: unresolvedWhere,
    }),
    prisma.adminAuditLog.findFirst({
      where: unresolvedWhere,
      orderBy: {
        createdAt: "asc",
      },
      select: {
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    unresolvedMissingReasons: count,
    href: "/admin/audit?reason=missing&followupStatus=unresolved",
    previewLabel: oldest
      ? `${oldest.action} / ${oldest.targetType}${oldest.targetId ? `:${oldest.targetId}` : ""} / ${oldest.admin?.displayName || oldest.admin?.email || "관리자"}`
      : null,
    oldestCreatedAt: oldest ? oldest.createdAt.toISOString() : null,
  };
}

function buildOperationsQueueV2(input: {
  openDisputes: number;
  openTrustReports: number;
  highTrustReports: number;
  sellerRiskCandidates: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  recentAutoNotes: number;
  unresolvedAuditFollowups: number;
  oldestDisputeAt: Date | null;
  oldestDepositAt: Date | null;
  oldestWithdrawalAt: Date | null;
  oldestTrustReportAt: Date | null;
  oldestAuditFollowupAt: Date | null;
  oldestDisputePreview: string | null;
  oldestDepositPreview: string | null;
  oldestWithdrawalPreview: string | null;
  oldestTrustReportPreview: string | null;
  oldestAuditFollowupPreview: string | null;
}) {
  const queue = [
    createQueueItemV2({
      key: "openDisputes",
      label: "미해결 분쟁",
      count: input.openDisputes,
      href: "/admin/disputes",
      quickLinkLabel: "분쟁 주문 열기",
      actionHint: "증거와 채팅 내역을 확인한 뒤 환불, 정산, 추가 자료 요청 중 하나로 처리합니다.",
      tone: "border-red-400/30 bg-red-400/10 text-red-100",
      description: "운영자 판단을 기다리는 구매자/판매자 분쟁입니다.",
      oldestAt: input.oldestDisputeAt,
      previewLabel: input.oldestDisputePreview,
      slaHours: 48,
      baseWeight: 5,
    }),
    createQueueItemV2({
      key: "trustReports",
      label: "신고/리스크",
      count: input.openTrustReports,
      href: "/admin/risk",
      slaHref: "/admin/risk?status=ALL&severity=HIGH",
      quickLinkLabel: "신고 큐 열기",
      actionHint: "신고 심각도, 대상 유저 상태, 운영 메모를 함께 확인합니다.",
      tone: "border-orange-400/30 bg-orange-400/10 text-orange-100",
      description: `고위험 신고 ${input.highTrustReports}건을 우선 확인해야 합니다.`,
      oldestAt: input.oldestTrustReportAt,
      previewLabel: input.oldestTrustReportPreview,
      slaHours: 24,
      baseWeight: input.highTrustReports > 0 ? 6 : 3,
    }),
    createQueueItemV2({
      key: "sellerRiskCandidates",
      label: "판매자 리스크 후보",
      count: input.sellerRiskCandidates,
      href: "/admin/risk",
      quickLinkLabel: "판매자 후보 열기",
      actionHint: "낮은 평점, 반복 신고, 제한 이력을 확인한 뒤 제한 또는 복구를 처리합니다.",
      tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
      description: "최근 낮은 평점이나 미해결 신고로 감지된 판매자입니다.",
      oldestAt: null,
      previewLabel:
        input.sellerRiskCandidates > 0
          ? `판매자 ${input.sellerRiskCandidates}명 검토 필요`
          : null,
      slaHours: null,
      baseWeight: 4,
    }),
    createQueueItemV2({
      key: "pendingWithdrawals",
      label: "출금 대기",
      count: input.pendingWithdrawals,
      href: "/admin/withdrawals",
      slaHref: "/admin/withdrawals",
      quickLinkLabel: "출금 큐 열기",
      actionHint: "출금 주소, 네트워크, 지급 TXID 증빙을 확인한 뒤 처리 상태를 갱신합니다.",
      tone: "border-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
      description: "재무 담당자의 확인이 필요한 출금 요청입니다.",
      oldestAt: input.oldestWithdrawalAt,
      previewLabel: input.oldestWithdrawalPreview,
      slaHours: 24,
      baseWeight: 4,
    }),
    createQueueItemV2({
      key: "pendingDeposits",
      label: "충전 대기",
      count: input.pendingDeposits,
      href: "/admin/deposits",
      slaHref: "/admin/deposits",
      quickLinkLabel: "충전 큐 열기",
      actionHint: "체인, 금액, 입금 주소, TXID를 대조한 뒤 승인 또는 반려합니다.",
      tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
      description: "재무 확인을 기다리는 수동 USDT 충전 요청입니다.",
      oldestAt: input.oldestDepositAt,
      previewLabel: input.oldestDepositPreview,
      slaHours: 12,
      baseWeight: 2,
    }),
    createQueueItemV2({
      key: "unresolvedAuditFollowups",
      label: "감사 사유 미처리",
      count: input.unresolvedAuditFollowups,
      href: "/admin/audit?reason=missing&followupStatus=unresolved",
      quickLinkLabel: "미처리 감사 로그 열기",
      actionHint: "민감 작업에 운영 사유가 비어 있는지 확인하고 후속 확인 사유를 남깁니다.",
      tone: "border-rose-400/30 bg-rose-400/10 text-rose-100",
      description: "후속 확인이 필요한 민감 감사 로그입니다.",
      oldestAt: input.oldestAuditFollowupAt,
      previewLabel: cleanAdminQueuePreview(input.oldestAuditFollowupPreview),
      slaHours: 24,
      baseWeight: 5,
    }),
    createQueueItemV2({
      key: "autoOperatorNotes",
      label: "자동 운영 메모",
      count: input.recentAutoNotes,
      href: "/admin/users",
      quickLinkLabel: "유저 콘솔 열기",
      actionHint: "자동 생성된 메모와 유저 상태 타임라인을 확인합니다.",
      tone: "border-white/10 bg-white/5 text-slate-100",
      description: "제한 또는 복구 액션에서 자동 생성된 운영 메모입니다.",
      oldestAt: null,
      previewLabel:
        input.recentAutoNotes > 0
          ? `자동 메모 ${input.recentAutoNotes}건 확인 가능`
          : null,
      slaHours: null,
      baseWeight: 1,
    }),
  ];

  return queue.sort((left, right) => right.priorityScore - left.priorityScore);
}

function createQueueItemV2(input: {
  key: string;
  label: string;
  count: number;
  href: string;
  slaHref?: string;
  quickLinkLabel: string;
  actionHint: string;
  tone: string;
  description: string;
  oldestAt: Date | null;
  previewLabel: string | null;
  slaHours: number | null;
  baseWeight: number;
}): OperationsQueueItem {
  const waitingHours = input.oldestAt
    ? Math.max(Math.floor((Date.now() - input.oldestAt.getTime()) / 3_600_000), 0)
    : 0;
  const slaBreached =
    input.count > 0 && input.slaHours !== null && waitingHours >= input.slaHours;
  const priorityScore =
    input.count === 0
      ? 0
      : input.count * input.baseWeight +
        Math.floor(waitingHours / 6) +
        (slaBreached ? 6 : 0);

  return {
    key: input.key,
    label: input.label,
    count: input.count,
    priority: getPriorityLabel(priorityScore),
    priorityScore,
    oldestWaitingLabel:
      input.count === 0
        ? "대기 없음"
        : waitingHours > 0
          ? `최장 대기 ${waitingHours}시간`
          : "최장 대기 1시간 미만",
    previewLabel: input.previewLabel ?? "미리보기 없음",
    slaLabel:
      input.count === 0
        ? "SLA 정상"
        : input.slaHours === null
          ? "SLA 없음"
          : slaBreached
            ? `SLA 초과 ${waitingHours}/${input.slaHours}시간`
            : `SLA ${waitingHours}/${input.slaHours}시간`,
    slaBreached,
    href: slaBreached && input.slaHref ? input.slaHref : input.href,
    quickLinkLabel:
      slaBreached && input.slaHref ? "SLA 큐 열기" : input.quickLinkLabel,
    actionHint: input.actionHint,
    tone: input.tone,
    description: input.description,
  };
}

function cleanAdminQueuePreview(value: string | null) {
  if (!value || /[\uF900-\uFAFF]|[\uFFFD]|[?]{2,}/.test(value)) {
    return null;
  }

  return value;
}

function buildOperationsQueue(input: {
  openDisputes: number;
  openTrustReports: number;
  highTrustReports: number;
  sellerRiskCandidates: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  recentAutoNotes: number;
  unresolvedAuditFollowups: number;
  oldestDisputeAt: Date | null;
  oldestDepositAt: Date | null;
  oldestWithdrawalAt: Date | null;
  oldestTrustReportAt: Date | null;
  oldestAuditFollowupAt: Date | null;
  oldestDisputePreview: string | null;
  oldestDepositPreview: string | null;
  oldestWithdrawalPreview: string | null;
  oldestTrustReportPreview: string | null;
  oldestAuditFollowupPreview: string | null;
}) {
  const queue = [
    createQueueItem({
      key: "openDisputes",
      label: "미해결 분쟁",
      count: input.openDisputes,
      href: "/admin/disputes",
      quickLinkLabel: "분쟁 주문 열기",
      actionHint: "증거를 확인한 뒤 구매자 환불 또는 판매자 정산으로 처리합니다.",
      tone: "border-red-400/30 bg-red-400/10 text-red-100",
      description: "운영자의 판단을 기다리는 구매자/판매자 분쟁입니다.",
      oldestAt: input.oldestDisputeAt,
      previewLabel: input.oldestDisputePreview,
      slaHours: 48,
      baseWeight: 5,
    }),
    createQueueItem({
      key: "trustReports",
      label: "신뢰 신고",
      count: input.openTrustReports,
      href: "/admin/risk",
      slaHref: "/admin/risk?status=ALL&severity=HIGH",
      quickLinkLabel: "고위험 신고 열기",
      actionHint: "신고 심각도, 대상 상태, 운영 메모를 함께 확인합니다.",
      tone: "border-orange-400/30 bg-orange-400/10 text-orange-100",
      description: `고위험 신고 ${input.highTrustReports}건을 우선 확인해야 합니다.`,
      oldestAt: input.oldestTrustReportAt,
      previewLabel: input.oldestTrustReportPreview,
      slaHours: 24,
      baseWeight: input.highTrustReports > 0 ? 6 : 3,
    }),
    createQueueItem({
      key: "sellerRiskCandidates",
      label: "판매자 리스크 후보",
      count: input.sellerRiskCandidates,
      href: "/admin/risk",
      quickLinkLabel: "판매자 후보 열기",
      actionHint: "신호를 확인한 뒤 판매 제한 또는 접근 복구를 처리합니다.",
      tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
      description: "최근 낮은 평점이나 미해결 신고로 감지된 판매자입니다.",
      oldestAt: null,
      previewLabel:
        input.sellerRiskCandidates > 0
          ? `판매자 ${input.sellerRiskCandidates}명 검토 필요`
          : null,
      slaHours: null,
      baseWeight: 4,
    }),
    createQueueItem({
      key: "pendingWithdrawals",
      label: "출금 대기",
      count: input.pendingWithdrawals,
      href: "/admin/withdrawals",
      slaHref: "/admin/withdrawals",
      quickLinkLabel: "출금 큐 열기",
      actionHint: "출금 주소와 지급 증빙을 확인한 뒤 처리 완료로 변경합니다.",
      tone: "border-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)]",
      description: "재무 담당자의 확인이 필요한 출금 신청입니다.",
      oldestAt: input.oldestWithdrawalAt,
      previewLabel: input.oldestWithdrawalPreview,
      slaHours: 24,
      baseWeight: 4,
    }),
    createQueueItem({
      key: "pendingDeposits",
      label: "충전 대기",
      count: input.pendingDeposits,
      href: "/admin/deposits",
      slaHref: "/admin/deposits",
      quickLinkLabel: "충전 큐 열기",
      actionHint: "코인, 네트워크, 주소, 트랜잭션 해시를 대조한 뒤 충전합니다.",
      tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
      description: "재무 확인을 기다리는 수동 코인 충전 신청입니다.",
      oldestAt: input.oldestDepositAt,
      previewLabel: input.oldestDepositPreview,
      slaHours: 12,
      baseWeight: 2,
    }),
    createQueueItem({
      key: "unresolvedAuditFollowups",
      label: "감사 사유 미처리",
      count: input.unresolvedAuditFollowups,
      href: "/admin/audit?reason=missing&followupStatus=unresolved",
      quickLinkLabel: "미처리 감사 로그 열기",
      actionHint: "민감 작업의 운영 사유가 비어 있는지 확인하고 후속 확인 사유를 남깁니다.",
      tone: "border-rose-400/30 bg-rose-400/10 text-rose-100",
      description: "후속 확인이 필요한 민감 감사 로그입니다.",
      oldestAt: input.oldestAuditFollowupAt,
      previewLabel: input.oldestAuditFollowupPreview,
      slaHours: 24,
      baseWeight: 5,
    }),
    createQueueItem({
      key: "autoOperatorNotes",
      label: "자동 운영 메모",
      count: input.recentAutoNotes,
      href: "/admin/users",
      quickLinkLabel: "유저 콘솔 열기",
      actionHint: "자동 생성된 메모와 유저 상태 타임라인을 확인합니다.",
      tone: "border-white/10 bg-white/5 text-slate-100",
      description: "제한 또는 복구 액션에서 자동 생성된 운영 메모입니다.",
      oldestAt: null,
      previewLabel:
        input.recentAutoNotes > 0
          ? `자동 메모 ${input.recentAutoNotes}건 확인 가능`
          : null,
      slaHours: null,
      baseWeight: 1,
    }),
  ];

  return queue.sort((left, right) => right.priorityScore - left.priorityScore);
}

function createQueueItem(input: {
  key: string;
  label: string;
  count: number;
  href: string;
  slaHref?: string;
  quickLinkLabel: string;
  actionHint: string;
  tone: string;
  description: string;
  oldestAt: Date | null;
  previewLabel: string | null;
  slaHours: number | null;
  baseWeight: number;
}) {
  const waitingHours = input.oldestAt
    ? Math.max(Math.floor((Date.now() - input.oldestAt.getTime()) / 3_600_000), 0)
    : 0;
  const slaBreached =
    input.count > 0 && input.slaHours !== null && waitingHours >= input.slaHours;
  const priorityScore =
    input.count === 0
      ? 0
      : input.count * input.baseWeight +
        Math.floor(waitingHours / 6) +
        (slaBreached ? 6 : 0);

  return {
    key: input.key,
    label: input.label,
    count: input.count,
    priority: getPriorityLabel(priorityScore),
    priorityScore,
    oldestWaitingLabel:
      input.count === 0
        ? "대기 없음"
        : waitingHours > 0
          ? `최장 대기 ${waitingHours}시간`
          : "최장 대기 1시간 미만",
    previewLabel: input.previewLabel ?? "미리보기 없음",
    slaLabel:
      input.count === 0
        ? "SLA 정상"
        : input.slaHours === null
          ? "SLA 없음"
          : slaBreached
            ? `SLA 초과 ${waitingHours}/${input.slaHours}시간`
            : `SLA ${waitingHours}/${input.slaHours}시간`,
    slaBreached,
    href: slaBreached && input.slaHref ? input.slaHref : input.href,
    quickLinkLabel:
      slaBreached && input.slaHref ? "SLA 큐 열기" : input.quickLinkLabel,
    actionHint: input.actionHint,
    tone: input.tone,
    description: input.description,
  };
}

function getPriorityLabel(priorityScore: number): "HIGH" | "MEDIUM" | "LOW" {
  if (priorityScore >= 12) {
    return "HIGH";
  }

  if (priorityScore >= 4) {
    return "MEDIUM";
  }

  return "LOW";
}

async function recordSlaIncidents(
  prisma: ReturnType<typeof getPrismaClient>,
  queue: OperationsQueueItem[],
) {
  await Promise.all(
    queue.map((item) => {
      if (!item.slaBreached) {
        return prisma.adminSlaIncident.updateMany({
          where: {
            activeKey: item.key,
            status: "OPEN",
          },
          data: {
            activeKey: null,
            status: "RESOLVED",
            resolvedAt: new Date(),
          },
        });
      }

      return prisma.adminSlaIncident.upsert({
        where: {
          activeKey: item.key,
        },
        create: {
          queueKey: item.key,
          activeKey: item.key,
          label: item.label,
          status: "OPEN",
          priority: item.priority,
          priorityScore: item.priorityScore,
          slaLabel: item.slaLabel,
          previewLabel: item.previewLabel,
          href: item.href,
        },
        update: {
          label: item.label,
          status: "OPEN",
          priority: item.priority,
          priorityScore: item.priorityScore,
          slaLabel: item.slaLabel,
          previewLabel: item.previewLabel,
          href: item.href,
        },
      });
    }),
  );
}

import { getPrismaClient } from "@/lib/prisma";

type QueueTone = "red" | "amber" | "green" | "blue" | "cyan" | "slate";

export type AdminReviewModerationState = {
  summary: {
    totalReviews: number;
    lowReviews: number;
    openReports: number;
    autoEscalatedReports: number;
    hiddenReviews: number;
    underReviewReviews: number;
    averageRating: string;
    queueCount: number;
  };
  queue: Array<{
    id: string;
    kind: "REVIEW" | "REPORT";
    tone: QueueTone;
    typeLabel: string;
    statusLabel: string;
    confidenceLabel: string;
    reportStatus: string | null;
    reportSeverity: string | null;
    reviewModerationStatus: string | null;
    reviewModerationReason: string | null;
    usersLabel: string;
    ratingLabel: string;
    body: string;
    note: string;
    traceLabel: string;
    createdAtLabel: string;
    targetUserHref: string;
    orderHref: string | null;
    riskHref: string | null;
    auditHref: string;
  }>;
  ratingDistribution: Array<{
    rating: number;
    count: number;
    percentLabel: string;
    width: number;
  }>;
  detectionTypes: Array<{
    label: string;
    count: number;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export async function getAdminReviewModerationState(): Promise<AdminReviewModerationState> {
  const prisma = getPrismaClient();

  const [
    recentReviews,
    recentReports,
    totalReviews,
    lowReviews,
    reviewAverage,
    ratingGroups,
    openReports,
    autoEscalatedReports,
    hiddenReviews,
    underReviewReviews,
    reportCategoryGroups,
  ] = await Promise.all([
    prisma.orderReview.findMany({
      select: {
        id: true,
        orderId: true,
        buyerId: true,
        sellerId: true,
        rating: true,
        comment: true,
        createdAt: true,
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
        order: {
          select: {
            orderNumber: true,
            listing: {
              select: {
                title: true,
              },
            },
          },
        },
        moderation: {
          select: {
            status: true,
            reason: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 40,
    }),
    prisma.trustReport.findMany({
      select: {
        id: true,
        category: true,
        status: true,
        severity: true,
        description: true,
        resolutionNote: true,
        createdAt: true,
        targetUserId: true,
        orderId: true,
        reporter: {
          select: {
            displayName: true,
          },
        },
        targetUser: {
          select: {
            displayName: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
            listing: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 40,
    }),
    prisma.orderReview.count(),
    prisma.orderReview.count({
      where: {
        rating: {
          lte: 2,
        },
      },
    }),
    prisma.orderReview.aggregate({
      _avg: {
        rating: true,
      },
    }),
    prisma.orderReview.groupBy({
      by: ["rating"],
      _count: {
        rating: true,
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
        sourceType: "ORDER_REVIEW",
      },
    }),
    prisma.orderReviewModeration.count({
      where: {
        status: "HIDDEN",
      },
    }),
    prisma.orderReviewModeration.count({
      where: {
        status: "UNDER_REVIEW",
      },
    }),
    prisma.trustReport.groupBy({
      by: ["category"],
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: "desc",
        },
      },
      take: 6,
    }),
  ]);

  const reviewItems = recentReviews.map((review) => {
    const tone: QueueTone = review.rating <= 2 ? "red" : review.rating === 3 ? "amber" : "green";
    const orderLabel = `${review.order.orderNumber} / ${review.order.listing.title}`;

    return {
      id: review.id,
      kind: "REVIEW" as const,
      tone,
      typeLabel: review.rating <= 2 ? "낮은 평점 리뷰" : "일반 리뷰",
      statusLabel: review.rating <= 2 ? "검토 필요" : "읽기 우선",
      confidenceLabel: `평점 ${review.rating}/5`,
      reportStatus: null,
      reportSeverity: null,
      reviewModerationStatus: review.moderation?.status ?? "VISIBLE",
      reviewModerationReason: review.moderation?.reason ?? null,
      usersLabel: `${review.buyer.displayName} -> ${review.seller.displayName}`,
      ratingLabel: toStars(review.rating),
      body: review.comment?.trim() || "작성된 리뷰 내용이 없습니다.",
      note: orderLabel,
      traceLabel: `작성자 ${review.buyer.displayName} / 대상 판매자 ${review.seller.displayName}`,
      createdAt: review.createdAt,
      createdAtLabel: dateFormatter.format(review.createdAt),
      targetUserHref: `/admin/users/${review.sellerId}`,
      orderHref: `/admin/orders?orderId=${review.orderId}`,
      riskHref: review.rating <= 2 ? `/admin/risk?query=${review.id}` : null,
      auditHref: `/admin/audit?targetType=ORDER_REVIEW&query=${review.id}`,
    };
  });

  const reportItems = recentReports.map((report) => {
    const tone = reportTone(report.severity, report.status);
    const orderLabel = report.order
      ? `${report.order.orderNumber} / ${report.order.listing.title}`
      : "연결된 주문 없음";

    return {
      id: report.id,
      kind: "REPORT" as const,
      tone,
      typeLabel: reportCategoryLabel(report.category),
      statusLabel: reportStatusLabel(report.status),
      confidenceLabel: severityLabel(report.severity),
      reportStatus: report.status,
      reportSeverity: report.severity,
      reviewModerationStatus: null,
      reviewModerationReason: null,
      usersLabel: `${report.reporter.displayName} -> ${report.targetUser.displayName}`,
      ratingLabel: "신고",
      body: report.description,
      note: report.resolutionNote?.trim()
        ? `${orderLabel} / 처리 메모: ${report.resolutionNote}`
        : orderLabel,
      traceLabel: `신고자 ${report.reporter.displayName} / 대상 유저 ${report.targetUser.displayName}`,
      createdAt: report.createdAt,
      createdAtLabel: dateFormatter.format(report.createdAt),
      targetUserHref: `/admin/users/${report.targetUserId}`,
      orderHref: report.orderId ? `/admin/orders?orderId=${report.orderId}` : null,
      riskHref: `/admin/risk?query=${report.id}`,
      auditHref: `/admin/audit?targetType=TRUST_REPORT&query=${report.id}`,
    };
  });

  const queue = [...reportItems, ...reviewItems]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 30)
    .map(({ createdAt: _createdAt, ...item }) => item);

  return {
    summary: {
      totalReviews,
      lowReviews,
      openReports,
      autoEscalatedReports,
      hiddenReviews,
      underReviewReviews,
      averageRating: (reviewAverage._avg.rating ?? 0).toFixed(2),
      queueCount: queue.length,
    },
    queue,
    ratingDistribution: buildRatingDistribution(ratingGroups),
    detectionTypes: reportCategoryGroups.map((group) => ({
      label: reportCategoryLabel(group.category),
      count: group._count.category,
    })),
  };
}

export async function updateReviewModerationReportStatus(input: {
  actorId: string;
  reportId: string;
  status: string;
  resolutionNote: string;
}) {
  const prisma = getPrismaClient();
  const nextStatus = normalizeModerationStatus(input.status);
  const resolutionNote = input.resolutionNote.trim();

  if (!nextStatus) {
    throw new Error("지원하지 않는 신고 상태입니다.");
  }

  if (resolutionNote.length < 10) {
    throw new Error("신고 처리에는 10자 이상의 운영 메모가 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const report = await tx.trustReport.findUnique({
      where: {
        id: input.reportId,
      },
      include: {
        reporter: true,
      },
    });

    if (!report) {
      throw new Error("신고를 찾을 수 없습니다.");
    }

    const isFinalStatus = ["RESOLVED", "DISMISSED"].includes(nextStatus);
    const updatedReport = await tx.trustReport.update({
      where: {
        id: report.id,
      },
      data: {
        status: nextStatus,
        resolutionNote,
        resolvedById: isFinalStatus ? input.actorId : report.resolvedById,
        resolvedAt: isFinalStatus ? new Date() : null,
      },
    });

    if (isFinalStatus) {
      await tx.notification.create({
        data: {
          userId: report.reporterId,
          type: "SYSTEM",
          title: "신고 처리 결과 안내",
          body:
            nextStatus === "RESOLVED"
              ? "접수하신 신고가 처리 완료되었습니다."
              : "접수하신 신고가 검토 후 기각되었습니다.",
          href: report.orderId ? `/my/orders/${report.orderId}` : "/my",
          metadata: {
            reportId: report.id,
            status: nextStatus,
          },
        },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "TRUST_REPORT_REVIEWED",
        targetType: "TRUST_REPORT",
        targetId: report.id,
        reason: resolutionNote,
        before: {
          status: report.status,
          resolutionNote: report.resolutionNote,
          resolvedById: report.resolvedById,
          resolvedAt: report.resolvedAt,
          source: "review-moderation",
        },
        after: {
          status: updatedReport.status,
          resolutionNote: updatedReport.resolutionNote,
          resolvedById: updatedReport.resolvedById,
          resolvedAt: updatedReport.resolvedAt,
          source: "review-moderation",
        },
      },
    });

    return {
      reportId: updatedReport.id,
      status: updatedReport.status,
      message: "신고 상태가 저장되었습니다.",
    };
  });
}

export async function updateReviewModerationReviewStatus(input: {
  actorId: string;
  reviewId: string;
  status: string;
  reason: string;
}) {
  const prisma = getPrismaClient();
  const nextStatus = normalizeReviewModerationStatus(input.status);
  const reason = input.reason.trim();

  if (!nextStatus) {
    throw new Error("지원하지 않는 리뷰 상태입니다.");
  }

  if (reason.length < 10) {
    throw new Error("리뷰 상태 변경에는 10자 이상의 운영 메모가 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const review = await tx.orderReview.findUnique({
      where: {
        id: input.reviewId,
      },
      include: {
        moderation: true,
        buyer: true,
        seller: true,
        order: true,
      },
    });

    if (!review) {
      throw new Error("리뷰를 찾을 수 없습니다.");
    }

    const previousStatus = review.moderation?.status ?? "VISIBLE";
    const updatedModeration = await tx.orderReviewModeration.upsert({
      where: {
        reviewId: review.id,
      },
      create: {
        reviewId: review.id,
        status: nextStatus,
        reason,
        moderatedById: input.actorId,
        moderatedAt: new Date(),
      },
      update: {
        status: nextStatus,
        reason,
        moderatedById: input.actorId,
        moderatedAt: new Date(),
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: reviewModerationAuditAction(nextStatus),
        targetType: "ORDER_REVIEW",
        targetId: review.id,
        reason,
        before: {
          status: previousStatus,
          reason: review.moderation?.reason ?? null,
          source: "review-moderation",
        },
        after: {
          status: updatedModeration.status,
          reason: updatedModeration.reason,
          source: "review-moderation",
        },
      },
    });

    if (["HIDDEN", "RESTORED"].includes(nextStatus)) {
      const isHidden = nextStatus === "HIDDEN";
      const notificationTitle = isHidden ? "리뷰 공개 상태 변경 안내" : "리뷰 복구 안내";
      const writerBody = isHidden
        ? "작성하신 리뷰가 운영 검토로 인해 공개 화면에서 숨김 처리되었습니다."
        : "작성하신 리뷰가 운영 검토 후 다시 공개되었습니다.";
      const sellerBody = isHidden
        ? "판매자 프로필의 리뷰 1건이 운영 검토로 인해 숨김 처리되었습니다."
        : "판매자 프로필의 리뷰 1건이 운영 검토 후 다시 공개되었습니다.";

      await tx.notification.createMany({
        data: [
          {
            userId: review.buyerId,
            type: "SYSTEM",
            title: notificationTitle,
            body: writerBody,
            href: `/my/orders/${review.orderId}`,
            metadata: {
              reviewId: review.id,
              status: nextStatus,
            },
          },
          {
            userId: review.sellerId,
            type: "SYSTEM",
            title: notificationTitle,
            body: sellerBody,
            href: `/my/listings/orders/${review.orderId}`,
            metadata: {
              reviewId: review.id,
              status: nextStatus,
            },
          },
        ],
      });
    }

    return {
      reviewId: review.id,
      status: updatedModeration.status,
      message: "리뷰 상태가 저장되었습니다.",
    };
  });
}

function buildRatingDistribution(
  groups: Array<{ rating: number; _count: { rating: number } }>,
): AdminReviewModerationState["ratingDistribution"] {
  const total = groups.reduce((sum, group) => sum + group._count.rating, 0);
  const counts = new Map(groups.map((group) => [group.rating, group._count.rating]));

  return [5, 4, 3, 2, 1].map((rating) => {
    const count = counts.get(rating) ?? 0;
    const percent = total > 0 ? (count / total) * 100 : 0;

    return {
      rating,
      count,
      percentLabel: `${percent.toFixed(1)}%`,
      width: Math.max(2, Math.round(percent)),
    };
  });
}

function toStars(rating: number) {
  const safeRating = Math.max(1, Math.min(5, rating));
  return `${"★".repeat(safeRating)}${"☆".repeat(5 - safeRating)}`;
}

function reportTone(severity: string, status: string): QueueTone {
  if (status === "RESOLVED" || status === "DISMISSED") return "green";
  if (severity === "CRITICAL" || severity === "HIGH") return "red";
  if (severity === "MEDIUM") return "amber";
  return "blue";
}

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "접수",
    UNDER_REVIEW: "검토 중",
    RESOLVED: "처리 완료",
    DISMISSED: "기각",
  };

  return labels[status] ?? status;
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

function normalizeModerationStatus(status: string) {
  const normalizedStatus = status.trim().toUpperCase();
  const allowedStatuses = ["UNDER_REVIEW", "RESOLVED", "DISMISSED"];

  return allowedStatuses.includes(normalizedStatus) ? normalizedStatus : null;
}

function normalizeReviewModerationStatus(status: string) {
  const normalizedStatus = status.trim().toUpperCase();
  const allowedStatuses = ["UNDER_REVIEW", "HIDDEN", "RESTORED"];

  return allowedStatuses.includes(normalizedStatus) ? normalizedStatus : null;
}

function reviewModerationAuditAction(status: string) {
  const actions: Record<string, string> = {
    UNDER_REVIEW: "REVIEW_UNDER_REVIEW",
    HIDDEN: "REVIEW_HIDDEN",
    RESTORED: "REVIEW_RESTORED",
  };

  return actions[status] ?? "REVIEW_MODERATION_UPDATED";
}

function reportCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    LOW_RATING_REVIEW: "낮은 평점 리뷰",
    FAKE_REVIEW: "허위 리뷰",
    ABUSIVE_LANGUAGE: "욕설/비방",
    EXTERNAL_CONTACT: "외부 연락 유도",
    SPAM: "스팸/광고",
    PRIVACY: "개인정보 노출",
    PAYMENT_RISK: "결제 위험",
    TRADE_RISK: "거래 위험",
    FRAUD: "사기 의심",
    NO_DELIVERY: "미전달",
    WRONG_ITEM: "다른 물품",
    ABUSIVE_CHAT: "부적절한 채팅",
    OFF_PLATFORM_PAYMENT: "외부 결제 유도",
    OTHER: "기타",
  };

  return labels[category] ?? category.replaceAll("_", " ");
}

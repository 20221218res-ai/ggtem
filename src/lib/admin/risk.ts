import { UserStatus } from "@/generated/prisma/enums";
import { getPrismaClient } from "@/lib/prisma";

const reportStatuses = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"];
const reportSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const SELLER_RISK_WINDOW_DAYS = 30;

export type AdminRiskState = {
  summary: {
    totalReports: number;
    openReports: number;
    highSeverityReports: number;
    shownReports: number;
    sellerRiskCandidates: number;
  };
  filters: {
    status: string;
    severity: string;
    query: string;
  };
  reports: Array<{
    reportId: string;
    category: string;
    status: string;
    severity: string;
    sourceType: string | null;
    sourceId: string | null;
    description: string;
    resolutionNote: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    reporterName: string;
    reporterEmail: string;
    targetUserId: string;
    targetName: string;
    targetEmail: string;
    targetStatus: string;
    orderId: string | null;
    orderNumber: string | null;
    listingTitle: string | null;
  }>;
  sellerRiskCandidates: Array<{
    userId: string;
    displayName: string;
    email: string;
    status: string;
    openReportCount: number;
    highSeverityReportCount: number;
    lowReviewCount: number;
    averageLowRating: string;
    lastSignalAt: string;
    riskLabel: string;
    recommendedAction: string;
  }>;
};

export type AdminRiskActionResult = {
  reportId: string;
  status: string;
  message: string;
};

export type AdminSellerRestrictionResult = {
  userId: string;
  status: string;
  message: string;
};

export async function getAdminRiskState(filters?: {
  status?: string | null;
  severity?: string | null;
  query?: string | null;
}): Promise<AdminRiskState> {
  const prisma = getPrismaClient();
  const normalizedStatus = normalizeReportStatus(filters?.status) ?? "OPEN";
  const normalizedSeverity = normalizeReportSeverity(filters?.severity);
  const normalizedQuery = filters?.query?.trim() ?? "";
  const where = {
    ...(normalizedStatus !== "ALL" ? { status: normalizedStatus } : {}),
    ...(normalizedSeverity ? { severity: normalizedSeverity } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            {
              category: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              reporter: {
                is: {
                  email: {
                    contains: normalizedQuery,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              targetUser: {
                is: {
                  email: {
                    contains: normalizedQuery,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              order: {
                is: {
                  orderNumber: {
                    contains: normalizedQuery,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [reports, totalReports, openReports, highSeverityReports, sellerRiskCandidates] =
    await Promise.all([
      prisma.trustReport.findMany({
        where,
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
        take: 100,
      }),
      prisma.trustReport.count({ where }),
      prisma.trustReport.count({
        where: {
          status: {
            in: ["OPEN", "UNDER_REVIEW"],
          },
        },
      }),
      prisma.trustReport.count({
        where: {
          severity: {
            in: ["HIGH", "CRITICAL"],
          },
          status: {
            in: ["OPEN", "UNDER_REVIEW"],
          },
        },
      }),
      getSellerRiskCandidates(prisma),
    ]);

  return {
    summary: {
      totalReports,
      openReports,
      highSeverityReports,
      shownReports: reports.length,
      sellerRiskCandidates: sellerRiskCandidates.length,
    },
    filters: {
      status: normalizedStatus,
      severity: normalizedSeverity ?? "ALL",
      query: normalizedQuery,
    },
    reports: reports.map((report) => ({
      reportId: report.id,
      category: report.category,
      status: report.status,
      severity: report.severity,
      sourceType: report.sourceType,
      sourceId: report.sourceId,
      description: report.description,
      resolutionNote: report.resolutionNote,
      createdAt: formatKoreanDate(report.createdAt),
      updatedAt: formatKoreanDate(report.updatedAt),
      resolvedAt: report.resolvedAt ? formatKoreanDate(report.resolvedAt) : null,
      reporterName: report.reporter.displayName,
      reporterEmail: report.reporter.email,
      targetUserId: report.targetUser.id,
      targetName: report.targetUser.displayName,
      targetEmail: report.targetUser.email,
      targetStatus: report.targetUser.status,
      orderId: report.orderId,
      orderNumber: report.order?.orderNumber ?? null,
      listingTitle: report.order?.listing.title ?? null,
    })),
    sellerRiskCandidates,
  };
}

export async function resolveAdminRiskReport(input: {
  actorId: string;
  reportId: string;
  status: string;
  severity?: string;
  targetStatus?: string;
  resolutionNote?: string;
}): Promise<AdminRiskActionResult> {
  const prisma = getPrismaClient();
  const nextStatus = normalizeReportStatus(input.status);
  const nextSeverity = normalizeReportSeverity(input.severity);
  const nextTargetStatus = normalizeUserStatus(input.targetStatus);
  const resolutionNote = input.resolutionNote?.trim() || null;

  if (!nextStatus || nextStatus === "ALL") {
    throw new Error("올바른 신고 상태가 필요합니다.");
  }

  const isFinalStatus = ["RESOLVED", "DISMISSED"].includes(nextStatus);
  const changesTargetStatus = Boolean(nextTargetStatus);

  if ((isFinalStatus || changesTargetStatus) && (!resolutionNote || resolutionNote.length < 10)) {
    throw new Error("위험 신고 조치에는 10자 이상의 검토 메모가 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const report = await tx.trustReport.findUnique({
      where: {
        id: input.reportId,
      },
      include: {
        targetUser: true,
        reporter: true,
        order: true,
      },
    });

    if (!report) {
      throw new Error("신고를 찾을 수 없습니다.");
    }

    const updatedReport = await tx.trustReport.update({
      where: {
        id: report.id,
      },
      data: {
        status: nextStatus,
        severity: nextSeverity ?? report.severity,
        resolutionNote,
        resolvedById: isFinalStatus ? input.actorId : report.resolvedById,
        resolvedAt: isFinalStatus ? new Date() : null,
      },
    });

    let updatedTargetStatus = report.targetUser.status;
    if (nextTargetStatus && nextTargetStatus !== report.targetUser.status) {
      const updatedTarget = await tx.user.update({
        where: {
          id: report.targetUserId,
        },
        data: {
          status: nextTargetStatus,
        },
      });
      updatedTargetStatus = updatedTarget.status;

      await tx.notification.create({
        data: {
          userId: report.targetUserId,
          type: "SYSTEM",
          title: "신고 검토로 계정 상태가 변경되었습니다.",
          body: `현재 계정 상태는 ${userStatusLabel(updatedTarget.status)}입니다.`,
          href: "/",
          metadata: {
            reportId: report.id,
            status: updatedTarget.status,
          },
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: "SYSTEM",
        title: "접수된 신고 상태가 변경되었습니다.",
        body: `신고 상태가 ${reportStatusLabel(updatedReport.status)} 상태로 변경되었습니다.`,
        href: report.orderId ? `/my/orders/${report.orderId}` : "/",
        metadata: {
          reportId: report.id,
          status: updatedReport.status,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "TRUST_REPORT_REVIEWED",
        targetType: "TRUST_REPORT",
        targetId: report.id,
        reason: resolutionNote ?? "신고 검토",
        before: {
          reportStatus: report.status,
          severity: report.severity,
          targetStatus: report.targetUser.status,
        },
        after: {
          reportStatus: updatedReport.status,
          severity: updatedReport.severity,
          targetStatus: updatedTargetStatus,
        },
      },
    });

    return {
      reportId: updatedReport.id,
      status: updatedReport.status,
      message: "신고 검토 결과가 저장되었습니다.",
    };
  });
}

export async function applySellerRiskRestriction(input: {
  actorId: string;
  userId: string;
  reason?: string;
}): Promise<AdminSellerRestrictionResult> {
  const prisma = getPrismaClient();
  const reason = input.reason?.trim() ?? "";

  if (reason.length < 10) {
    throw new Error("판매 제한에는 10자 이상의 운영 사유가 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      include: {
        _count: {
          select: {
            reportsReceived: {
              where: {
                status: {
                  in: ["OPEN", "UNDER_REVIEW"],
                },
              },
            },
            reviewsReceived: {
              where: {
                rating: {
                  lte: 2,
                },
                createdAt: {
                  gte: new Date(
                    Date.now() -
                      SELLER_RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
                  ),
                },
              },
            },
          },
        },
      },
    });

    if (!targetUser) {
      throw new Error("판매자 후보를 찾을 수 없습니다.");
    }

    if (["SUSPENDED", "BANNED"].includes(targetUser.status)) {
      throw new Error("이미 정지 또는 차단된 계정입니다.");
    }

    if (targetUser.status === "SELLING_RESTRICTED") {
      return {
        userId: targetUser.id,
        status: targetUser.status,
        message: "이미 판매 제한 상태입니다.",
      };
    }

    const updatedUser = await tx.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        status: "SELLING_RESTRICTED",
      },
    });

    await tx.notification.create({
      data: {
        userId: targetUser.id,
        type: "SYSTEM",
        title: "판매 접근이 제한되었습니다.",
        body: "신고와 리뷰 검토 결과에 따라 판매 접근이 제한되었습니다.",
        href: "/my/listings",
        metadata: {
          reason,
          previousStatus: targetUser.status,
          nextStatus: updatedUser.status,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "SELLER_RISK_RESTRICTION_APPLIED",
        targetType: "USER",
        targetId: targetUser.id,
        reason,
        before: {
          status: targetUser.status,
          openReports: targetUser._count.reportsReceived,
          lowRecentReviews: targetUser._count.reviewsReceived,
        },
        after: {
          status: updatedUser.status,
        },
      },
    });

    await tx.adminUserNote.create({
      data: {
        userId: targetUser.id,
        adminId: input.actorId,
        body: [
          "[AUTO] 판매자 위험 검토로 판매 제한을 적용했습니다.",
          `사유: ${reason}`,
          `신호: 처리 대기 신고 ${targetUser._count.reportsReceived}건, 최근 낮은 리뷰 ${targetUser._count.reviewsReceived}건`,
          `상태: ${userStatusLabel(targetUser.status)} -> ${userStatusLabel(updatedUser.status)}`,
        ].join("\n"),
      },
    });

    return {
      userId: updatedUser.id,
      status: updatedUser.status,
      message: "판매 제한을 적용했습니다.",
    };
  });
}

export async function restoreSellerSellingAccess(input: {
  actorId: string;
  userId: string;
  reason?: string;
}): Promise<AdminSellerRestrictionResult> {
  const prisma = getPrismaClient();
  const reason = input.reason?.trim() ?? "";

  if (reason.length < 10) {
    throw new Error("판매 접근 복구에는 10자 이상의 운영 사유가 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
    });

    if (!targetUser) {
      throw new Error("판매자 후보를 찾을 수 없습니다.");
    }

    if (targetUser.status !== "SELLING_RESTRICTED") {
      throw new Error("판매 제한 상태인 계정만 여기에서 복구할 수 있습니다.");
    }

    const updatedUser = await tx.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        status: "ACTIVE",
      },
    });

    await tx.notification.create({
      data: {
        userId: targetUser.id,
        type: "SYSTEM",
        title: "판매 접근이 복구되었습니다.",
        body: "운영자 검토 후 판매 접근이 복구되었습니다.",
        href: "/my/listings",
        metadata: {
          reason,
          previousStatus: targetUser.status,
          nextStatus: updatedUser.status,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "SELLER_RISK_RESTRICTION_RESTORED",
        targetType: "USER",
        targetId: targetUser.id,
        reason,
        before: {
          status: targetUser.status,
        },
        after: {
          status: updatedUser.status,
        },
      },
    });

    await tx.adminUserNote.create({
      data: {
        userId: targetUser.id,
        adminId: input.actorId,
        body: [
          "[AUTO] 운영자 검토 후 판매 접근을 복구했습니다.",
          `사유: ${reason}`,
          `상태: ${userStatusLabel(targetUser.status)} -> ${userStatusLabel(updatedUser.status)}`,
        ].join("\n"),
      },
    });

    return {
      userId: updatedUser.id,
      status: updatedUser.status,
      message: "판매 접근을 복구했습니다.",
    };
  });
}

function normalizeReportStatus(status?: string | null) {
  if (!status) return null;

  const value = status.trim().toUpperCase();
  return value === "ALL" || reportStatuses.includes(value) ? value : null;
}

function normalizeReportSeverity(severity?: string | null) {
  if (!severity || severity === "ALL") return null;

  const value = severity.trim().toUpperCase();
  return reportSeverities.includes(value) ? value : null;
}

function normalizeUserStatus(status?: string | null) {
  if (!status || status === "UNCHANGED") return null;

  const value = status.trim().toUpperCase();
  return Object.values(UserStatus).includes(value as UserStatus)
    ? (value as UserStatus)
    : null;
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

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

async function getSellerRiskCandidates(prisma: ReturnType<typeof getPrismaClient>) {
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
        _avg: {
          rating: true,
        },
        _count: {
          rating: true,
        },
        _max: {
          createdAt: true,
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
        _max: {
          createdAt: true,
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

  const candidateIds = Array.from(
    new Set([
      ...lowReviewGroups
        .filter((group) => group._count.rating >= 2)
        .map((group) => group.sellerId),
      ...openReportGroups
        .filter((group) => group._count.id >= 2)
        .map((group) => group.targetUserId),
      ...highSeverityReportGroups.map((group) => group.targetUserId),
    ]),
  );

  if (candidateIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: candidateIds,
      },
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      status: true,
    },
  });

  const lowReviewMap = new Map(
    lowReviewGroups.map((group) => [group.sellerId, group]),
  );
  const openReportMap = new Map(
    openReportGroups.map((group) => [group.targetUserId, group]),
  );
  const highSeverityReportMap = new Map(
    highSeverityReportGroups.map((group) => [group.targetUserId, group]),
  );

  return users
    .map((user) => {
      const lowReviewGroup = lowReviewMap.get(user.id);
      const openReportGroup = openReportMap.get(user.id);
      const highSeverityReportGroup = highSeverityReportMap.get(user.id);
      const lowReviewCount = lowReviewGroup?._count.rating ?? 0;
      const openReportCount = openReportGroup?._count.id ?? 0;
      const highSeverityReportCount = highSeverityReportGroup?._count.id ?? 0;
      const lastSignals = [
        lowReviewGroup?._max.createdAt,
        openReportGroup?._max.createdAt,
      ].filter((date): date is Date => Boolean(date));
      const lastSignalAt = lastSignals.length
        ? new Date(Math.max(...lastSignals.map((date) => date.getTime())))
        : new Date();
      const riskScore =
        lowReviewCount * 2 + openReportCount + highSeverityReportCount * 3;

      return {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        openReportCount,
        highSeverityReportCount,
        lowReviewCount,
        averageLowRating: (lowReviewGroup?._avg.rating ?? 0).toFixed(1),
        lastSignalAt: formatKoreanDate(lastSignalAt),
        riskLabel:
          riskScore >= 6 || highSeverityReportCount >= 2
            ? "HIGH"
            : riskScore >= 3
              ? "MEDIUM"
              : "LOW",
        recommendedAction:
          riskScore >= 6 || highSeverityReportCount >= 2
            ? "Review for SELLING_RESTRICTED"
            : "Monitor and review open reports",
        riskScore,
      };
    })
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 8)
    .map((candidate) => ({
      userId: candidate.userId,
      displayName: candidate.displayName,
      email: candidate.email,
      status: candidate.status,
      openReportCount: candidate.openReportCount,
      highSeverityReportCount: candidate.highSeverityReportCount,
      lowReviewCount: candidate.lowReviewCount,
      averageLowRating: candidate.averageLowRating,
      lastSignalAt: candidate.lastSignalAt,
      riskLabel: candidate.riskLabel,
      recommendedAction: candidate.recommendedAction,
    }));
}

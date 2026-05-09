import { UserRole, UserStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";

export const ADMIN_USER_ROLE_OPTIONS = Object.values(UserRole);
export const ADMIN_USER_STATUS_OPTIONS = Object.values(UserStatus);

export type AdminUsersState = {
  summary: {
    totalUsers: number;
    shownUsers: number;
    activeUsers: number;
    operatorUsers: number;
    restrictedUsers: number;
    withdrawalHoldUsers: number;
    suspendedUsers: number;
    bannedUsers: number;
  };
  filters: {
    role: string;
    status: string;
    query: string;
  };
  roleBreakdown: Array<{
    role: string;
    count: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  users: Array<{
    userId: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    walletBalance: string | null;
    orderCount: number;
    listingCount: number;
    isOperator: boolean;
  }>;
};

export type AdminUserUpdateResult = {
  userId: string;
  role: string;
  status: string;
  message: string;
};

export type AdminUserDetail = {
  user: {
    userId: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    isOperator: boolean;
  };
  wallet: {
    currency: string;
    availableBalance: string;
    escrowLockedBalance: string;
    withdrawableBalance: string;
    withdrawalLocked: string;
  } | null;
  walletLedgerEntries: Array<{
    entryId: string;
    type: string;
    direction: string;
    bucket: string;
    amount: string;
    currency: string;
    referenceType: string | null;
    referenceId: string | null;
    referenceHref: string | null;
    memo: string | null;
    createdAt: string;
  }>;
  metrics: {
    buyerOrders: number;
    sellerOrders: number;
    listings: number;
    reportsMade: number;
    reportsReceived: number;
    auditLogs: number;
    adminNotes: number;
    reviewsGiven: number;
    reviewsReceived: number;
  };
  recentBuyerOrders: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    listingTitle: string;
    amount: string;
    currency: string;
    createdAt: string;
  }>;
  recentSellerOrders: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    listingTitle: string;
    amount: string;
    currency: string;
    createdAt: string;
  }>;
  listings: Array<{
    listingId: string;
    title: string;
    status: string;
    unitPrice: string;
    currency: string;
    createdAt: string;
  }>;
  reportsReceived: Array<{
    reportId: string;
    category: string;
    status: string;
    severity: string;
    description: string;
    reporterName: string;
    orderNumber: string | null;
    createdAt: string;
  }>;
  reportsMade: Array<{
    reportId: string;
    category: string;
    status: string;
    severity: string;
    description: string;
    targetName: string;
    orderNumber: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    logId: string;
    action: string;
    targetType: string;
    targetId: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  restrictionTimeline: Array<{
    logId: string;
    action: string;
    reason: string | null;
    adminName: string | null;
    previousStatus: string | null;
    nextStatus: string | null;
    createdAt: string;
  }>;
  adminNotes: Array<{
    noteId: string;
    body: string;
    adminName: string;
    adminEmail: string;
    createdAt: string;
  }>;
  reviewsGiven: Array<{
    reviewId: string;
    rating: number;
    comment: string | null;
    sellerName: string;
    orderNumber: string;
    createdAt: string;
  }>;
  reviewsReceived: Array<{
    reviewId: string;
    rating: number;
    comment: string | null;
    buyerName: string;
    orderNumber: string;
    createdAt: string;
  }>;
};

export async function getAdminUsersState(filters?: {
  role?: string | null;
  status?: string | null;
  query?: string | null;
}): Promise<AdminUsersState> {
  const prisma = getPrismaClient();
  const normalizedRole = normalizeRole(filters?.role);
  const normalizedStatus = normalizeStatus(filters?.status);
  const normalizedQuery = filters?.query?.trim() ?? "";

  const where = {
    ...(normalizedRole ? { role: normalizedRole } : {}),
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            {
              email: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              displayName: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [
    users,
    totalUsers,
    activeUsers,
    restrictedUsers,
    withdrawalHoldUsers,
    suspendedUsers,
    bannedUsers,
    roleGroups,
    statusGroups,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        wallet: true,
        _count: {
          select: {
            buyerOrders: true,
            sellerOrders: true,
            listings: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    prisma.user.count({
      where,
    }),
    prisma.user.count({
      where: {
        ...where,
        status: "ACTIVE",
      },
    }),
    prisma.user.count({
      where: {
        ...where,
        status: "SELLING_RESTRICTED",
      },
    }),
    prisma.user.count({
      where: {
        ...where,
        status: "WITHDRAWAL_HOLD",
      },
    }),
    prisma.user.count({
      where: {
        ...where,
        status: "SUSPENDED",
      },
    }),
    prisma.user.count({
      where: {
        ...where,
        status: "BANNED",
      },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where,
      _count: {
        role: true,
      },
      orderBy: {
        _count: {
          role: "desc",
        },
      },
    }),
    prisma.user.groupBy({
      by: ["status"],
      where,
      _count: {
        status: true,
      },
      orderBy: {
        _count: {
          status: "desc",
        },
      },
    }),
  ]);

  return {
    summary: {
      totalUsers,
      shownUsers: users.length,
      activeUsers,
      operatorUsers: users.filter((user) => isOperatorRole(user.role)).length,
      restrictedUsers,
      withdrawalHoldUsers,
      suspendedUsers,
      bannedUsers,
    },
    filters: {
      role: normalizedRole ?? "ALL",
      status: normalizedStatus ?? "ALL",
      query: normalizedQuery,
    },
    roleBreakdown: roleGroups.map((group) => ({
      role: group.role,
      count: group._count.role,
    })),
    statusBreakdown: statusGroups.map((group) => ({
      status: group.status,
      count: group._count.status,
    })),
    users: users.map((user) => ({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      createdAt: formatKoreanDate(user.createdAt),
      updatedAt: formatKoreanDate(user.updatedAt),
      walletBalance: user.wallet
        ? `${user.wallet.availableBalance.toString()} ${user.wallet.currency}`
        : null,
      orderCount: user._count.buyerOrders + user._count.sellerOrders,
      listingCount: user._count.listings,
      isOperator: isOperatorRole(user.role),
    })),
  };
}

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      wallet: true,
      buyerOrders: {
        include: {
          listing: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      sellerOrders: {
        include: {
          listing: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      listings: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      reportsReceived: {
        include: {
          reporter: true,
          order: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      reportsMade: {
        include: {
          targetUser: true,
          order: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      adminAuditLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      adminNotesReceived: {
        include: {
          admin: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
      },
      reviewsGiven: {
        include: {
          seller: true,
          order: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      reviewsReceived: {
        include: {
          buyer: true,
          order: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      _count: {
        select: {
          buyerOrders: true,
          sellerOrders: true,
          listings: true,
          reportsMade: true,
          reportsReceived: true,
          adminAuditLogs: true,
          adminNotesReceived: true,
          reviewsGiven: true,
          reviewsReceived: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const [restrictionTimeline, walletLedgerEntries] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: {
        targetType: "USER",
        targetId: user.id,
        action: {
          in: [
            "SELLER_RISK_RESTRICTION_APPLIED",
            "SELLER_RISK_RESTRICTION_RESTORED",
            "USER_ACCESS_UPDATED",
          ],
        },
      },
      include: {
        admin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    }),
    prisma.walletLedgerEntry.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    }),
  ]);

  return {
    user: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      createdAt: formatKoreanDate(user.createdAt),
      updatedAt: formatKoreanDate(user.updatedAt),
      isOperator: isOperatorRole(user.role),
    },
    wallet: user.wallet
      ? {
          currency: user.wallet.currency,
          availableBalance: user.wallet.availableBalance.toString(),
          escrowLockedBalance: user.wallet.escrowLockedBalance.toString(),
          withdrawableBalance: user.wallet.withdrawableBalance.toString(),
          withdrawalLocked: user.wallet.withdrawalLocked.toString(),
        }
      : null,
    walletLedgerEntries: walletLedgerEntries.map((entry) => ({
      entryId: entry.id,
      type: entry.type,
      direction: entry.direction,
      bucket: entry.bucket,
      amount: entry.amount.toString(),
      currency: entry.currency,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      referenceHref: buildAdminLedgerReferenceHref(
        entry.referenceType,
        entry.referenceId,
      ),
      memo: entry.memo,
      createdAt: formatKoreanDate(entry.createdAt),
    })),
    metrics: {
      buyerOrders: user._count.buyerOrders,
      sellerOrders: user._count.sellerOrders,
      listings: user._count.listings,
      reportsMade: user._count.reportsMade,
      reportsReceived: user._count.reportsReceived,
      auditLogs: user._count.adminAuditLogs,
      adminNotes: user._count.adminNotesReceived,
      reviewsGiven: user._count.reviewsGiven,
      reviewsReceived: user._count.reviewsReceived,
    },
    recentBuyerOrders: user.buyerOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      listingTitle: order.listing.title,
      amount: order.grossAmount.toString(),
      currency: order.currency,
      createdAt: formatKoreanDate(order.createdAt),
    })),
    recentSellerOrders: user.sellerOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      listingTitle: order.listing.title,
      amount: order.grossAmount.toString(),
      currency: order.currency,
      createdAt: formatKoreanDate(order.createdAt),
    })),
    listings: user.listings.map((listing) => ({
      listingId: listing.id,
      title: listing.title,
      status: listing.status,
      unitPrice: listing.unitPrice.toString(),
      currency: listing.currency,
      createdAt: formatKoreanDate(listing.createdAt),
    })),
    reportsReceived: user.reportsReceived.map((report) => ({
      reportId: report.id,
      category: report.category,
      status: report.status,
      severity: report.severity,
      description: report.description,
      reporterName: report.reporter.displayName,
      orderNumber: report.order?.orderNumber ?? null,
      createdAt: formatKoreanDate(report.createdAt),
    })),
    reportsMade: user.reportsMade.map((report) => ({
      reportId: report.id,
      category: report.category,
      status: report.status,
      severity: report.severity,
      description: report.description,
      targetName: report.targetUser.displayName,
      orderNumber: report.order?.orderNumber ?? null,
      createdAt: formatKoreanDate(report.createdAt),
    })),
    auditLogs: user.adminAuditLogs.map((log) => ({
      logId: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      createdAt: formatKoreanDate(log.createdAt),
    })),
    restrictionTimeline: restrictionTimeline.map((log) => ({
      logId: log.id,
      action: log.action,
      reason: log.reason,
      adminName: log.admin?.displayName ?? null,
      previousStatus: getAuditStatus(log.before, "status"),
      nextStatus: getAuditStatus(log.after, "status"),
      createdAt: formatKoreanDate(log.createdAt),
    })),
    adminNotes: user.adminNotesReceived.map((note) => ({
      noteId: note.id,
      body: note.body,
      adminName: note.admin.displayName,
      adminEmail: note.admin.email,
      createdAt: formatKoreanDate(note.createdAt),
    })),
    reviewsGiven: user.reviewsGiven.map((review) => ({
      reviewId: review.id,
      rating: review.rating,
      comment: review.comment,
      sellerName: review.seller.displayName,
      orderNumber: review.order.orderNumber,
      createdAt: formatKoreanDate(review.createdAt),
    })),
    reviewsReceived: user.reviewsReceived.map((review) => ({
      reviewId: review.id,
      rating: review.rating,
      comment: review.comment,
      buyerName: review.buyer.displayName,
      orderNumber: review.order.orderNumber,
      createdAt: formatKoreanDate(review.createdAt),
    })),
  };
}

export async function createAdminUserNote(input: {
  actorId: string;
  userId: string;
  body: string;
}) {
  const prisma = getPrismaClient();
  const body = input.body.trim();

  if (body.length < 5) {
    throw new Error("운영 메모는 5자 이상 입력해야 합니다.");
  }

  if (body.length > 2000) {
    throw new Error("운영 메모는 2000자 이하로 입력해야 합니다.");
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  if (!targetUser) {
    throw new Error("유저를 찾을 수 없습니다.");
  }

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await tx.adminUserNote.create({
      data: {
        userId: targetUser.id,
        adminId: input.actorId,
        body,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "USER_NOTE_CREATED",
        targetType: "USER",
        targetId: targetUser.id,
        reason: body.length > 160 ? `${body.slice(0, 157)}...` : body,
        after: {
          noteId: createdNote.id,
          userEmail: targetUser.email,
        },
      },
    });

    return createdNote;
  });

  return {
    noteId: note.id,
    message: "운영 메모를 추가했습니다.",
  };
}

export async function updateAdminUserAccess(input: {
  actorId: string;
  actorRole: string;
  userId: string;
  role: string;
  status: string;
  reason?: string;
}): Promise<AdminUserUpdateResult> {
  const prisma = getPrismaClient();
  const nextRole = normalizeRole(input.role);
  const nextStatus = normalizeStatus(input.status);
  const reason = input.reason?.trim() ?? "";

  if (!nextRole || !nextStatus) {
    throw new Error("유효한 권한과 계정 상태가 필요합니다.");
  }

  if (input.actorId === input.userId) {
    throw new Error("본인의 권한 또는 계정 상태는 직접 변경할 수 없습니다.");
  }

  if (reason.length < 10) {
    throw new Error("계정 접근 권한 변경에는 10자 이상의 사유가 필요합니다.");
  }

  if (nextRole === "SUPER" && input.actorRole !== "SUPER") {
    throw new Error("최고 관리자만 SUPER 권한을 부여할 수 있습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
    });

    if (!user) {
      throw new Error("유저를 찾을 수 없습니다.");
    }

    if (user.role === "SUPER" && input.actorRole !== "SUPER") {
      throw new Error("최고 관리자만 SUPER 계정을 변경할 수 있습니다.");
    }

    if (user.role === nextRole && user.status === nextStatus) {
      throw new Error("이미 동일한 권한과 계정 상태로 설정되어 있습니다.");
    }

    const updatedUser = await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        role: nextRole,
        status: nextStatus,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "USER_ACCESS_UPDATED",
        targetType: "USER",
        targetId: user.id,
        reason,
        before: {
          role: user.role,
          status: user.status,
          email: user.email,
        },
        after: {
          role: updatedUser.role,
          status: updatedUser.status,
          email: updatedUser.email,
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: "계정 접근 권한이 변경되었습니다",
        body: `계정 권한/상태가 ${updatedUser.role}/${updatedUser.status}(으)로 변경되었습니다.`,
        href: "/",
        metadata: {
          role: updatedUser.role,
          status: updatedUser.status,
        },
      },
    });

    return {
      userId: updatedUser.id,
      role: updatedUser.role,
      status: updatedUser.status,
      message: "유저 계정 접근 권한을 변경했습니다.",
    };
  });
}

function normalizeRole(role?: string | null) {
  if (!role || role === "ALL") {
    return null;
  }

  return ADMIN_USER_ROLE_OPTIONS.includes(role as UserRole)
    ? (role as UserRole)
    : null;
}

function normalizeStatus(status?: string | null) {
  if (!status || status === "ALL") {
    return null;
  }

  return ADMIN_USER_STATUS_OPTIONS.includes(status as UserStatus)
    ? (status as UserStatus)
    : null;
}

function isOperatorRole(role: string) {
  return ["CS", "MODERATOR", "FINANCE", "ADMIN", "SUPER"].includes(role);
}

function getAuditStatus(payload: Prisma.JsonValue | null, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function buildAdminLedgerReferenceHref(
  referenceType: string | null,
  referenceId: string | null,
) {
  if (!referenceType || !referenceId) {
    return null;
  }

  if (referenceType === "ORDER") {
    return `/admin/orders?orderId=${referenceId}`;
  }

  if (
    referenceType === "DEPOSIT_REQUEST" ||
    referenceType === "WITHDRAWAL_REQUEST"
  ) {
    return `/admin/audit?query=${encodeURIComponent(referenceId)}`;
  }

  return `/admin/audit?query=${encodeURIComponent(referenceId)}`;
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

import { getPrismaClient } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type AdminAuditFilters = {
  action?: string | null;
  targetType?: string | null;
  query?: string | null;
  adminId?: string | null;
  sensitivity?: string | null;
  reason?: string | null;
  followupStatus?: string | null;
  from?: string | null;
  to?: string | null;
};

export type AdminAuditExportRow = {
  logId: string;
  adminName: string;
  adminEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  before: string | null;
  after: string | null;
};

export const SENSITIVE_AUDIT_ACTIONS = [
  "WITHDRAWAL_COMPLETED",
  "WITHDRAWAL_REJECTED",
  "DEPOSIT_CONFIRMED",
  "DEPOSIT_REJECTED",
  "DISPUTE_REFUNDED_TO_BUYER",
  "DISPUTE_RELEASED_TO_SELLER",
  "SELLER_RISK_RESTRICTION_APPLIED",
  "ADMIN_USER_UPDATED",
  "USER_ACCESS_UPDATED",
  "ADMIN_ACCOUNT_PREPARED",
  "ADMIN_ACCOUNT_ACCESS_UPDATED",
  "ADMIN_INVITE_CREATED",
  "ADMIN_INVITE_REVOKED",
  "ADMIN_INVITE_ACCEPTED",
  "REPORT_EXPORT_CSV",
  "REPORT_EXPORT_XLSX",
  "AUDIT_EXPORT_CSV",
  "AUDIT_EXPORT_XLSX",
  "FINANCE_LEDGER_EXPORT_CSV",
  "FINANCE_RECONCILIATION_EXPORT_CSV",
  "SLA_INCIDENT_RESOLVED",
];

export const AUDIT_FOLLOWUP_RESOLVED_ACTION = "AUDIT_FOLLOWUP_RESOLVED";

export type AdminAuditState = {
  summary: {
    totalLogs: number;
    shownLogs: number;
    uniqueActions: number;
    uniqueTargets: number;
  };
  filters: {
    action: string;
    targetType: string;
    query: string;
    adminId: string;
    sensitivity: string;
    reason: string;
    followupStatus: string;
    from: string;
    to: string;
  };
  adminOptions: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
  }>;
  actionBreakdown: Array<{
    action: string;
    count: number;
  }>;
  targetBreakdown: Array<{
    targetType: string;
    count: number;
  }>;
  riskTrend: Array<{
    date: string;
    label: string;
    totalCount: number;
    sensitiveCount: number;
  }>;
  logs: Array<{
    logId: string;
    adminName: string;
    adminEmail: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    reason: string | null;
    before: string | null;
    after: string | null;
    parsedBefore: Record<string, unknown> | null;
    parsedAfter: Record<string, unknown> | null;
    financeSummary: {
      kind: "DEPOSIT" | "WITHDRAWAL" | "OTHER";
      label: string;
      status: string | null;
      amount: string | null;
      currency: string | null;
      txId: string | null;
      evidenceMemo: string | null;
    };
    followup: {
      isResolved: boolean;
      reason: string | null;
      adminName: string | null;
      adminEmail: string | null;
      createdAt: string | null;
      logId: string | null;
    };
    ipAddress: string | null;
    createdAt: string;
  }>;
};

export async function getAdminAuditState(filters?: AdminAuditFilters): Promise<AdminAuditState> {
  const prisma = getPrismaClient();
  const {
    normalizedAction,
    normalizedTargetType,
    normalizedQuery,
    normalizedAdminId,
    normalizedSensitivity,
    normalizedReason,
    normalizedFollowupStatus,
    normalizedFrom,
    normalizedTo,
    where,
  } = buildAdminAuditQuery(filters);
  const followupWhere = await buildAuditFollowupWhere(normalizedFollowupStatus);
  const effectiveWhere = mergeAuditWhere(where, followupWhere);

  const [logs, totalLogs, actionGroups, targetGroups, adminOptions] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: effectiveWhere,
      include: {
        admin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    prisma.adminAuditLog.count({
      where: effectiveWhere,
    }),
    prisma.adminAuditLog.groupBy({
      by: ["action"],
      where: effectiveWhere,
      _count: {
        action: true,
      },
      orderBy: {
        _count: {
          action: "desc",
        },
      },
      take: 8,
    }),
    prisma.adminAuditLog.groupBy({
      by: ["targetType"],
      where: effectiveWhere,
      _count: {
        targetType: true,
      },
      orderBy: {
        _count: {
          targetType: "desc",
        },
      },
      take: 8,
    }),
    prisma.user.findMany({
      where: {
        role: {
          in: ["SUPER", "ADMIN", "FINANCE", "CS", "MODERATOR"],
        },
      },
      orderBy: [
        {
          role: "desc",
        },
        {
          displayName: "asc",
        },
      ],
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
      },
    }),
  ]);
  const followupLogs = await prisma.adminAuditLog.findMany({
    where: {
      action: AUDIT_FOLLOWUP_RESOLVED_ACTION,
      targetType: "ADMIN_AUDIT_LOG",
      targetId: {
        in: logs.map((log) => log.id),
      },
    },
    include: {
      admin: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const followupByTargetId = new Map(
    followupLogs
      .filter((log) => log.targetId)
      .map((log) => [log.targetId as string, log]),
  );
  const riskTrend = buildRiskTrend(logs);

  return {
    summary: {
      totalLogs,
      shownLogs: logs.length,
      uniqueActions: actionGroups.length,
      uniqueTargets: targetGroups.length,
    },
    filters: {
      action: normalizedAction,
      targetType: normalizedTargetType,
      query: normalizedQuery,
      adminId: normalizedAdminId,
      sensitivity: normalizedSensitivity,
      reason: normalizedReason,
      followupStatus: normalizedFollowupStatus,
      from: normalizedFrom,
      to: normalizedTo,
    },
    adminOptions: adminOptions.map((admin) => ({
      userId: admin.id,
      name: admin.displayName,
      email: admin.email,
      role: admin.role,
    })),
    actionBreakdown: actionGroups.map((group) => ({
      action: group.action,
      count: group._count.action,
    })),
    targetBreakdown: targetGroups.map((group) => ({
      targetType: group.targetType,
      count: group._count.targetType,
    })),
    riskTrend,
    logs: logs.map((log) => {
      const parsedBefore = toPlainObject(log.before);
      const parsedAfter = toPlainObject(log.after);
      const followup = followupByTargetId.get(log.id);

      return {
        logId: log.id,
        adminName: log.admin?.displayName ?? "Unknown admin",
        adminEmail: log.admin?.email ?? null,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        reason: log.reason,
        before: stringifyJson(log.before),
        after: stringifyJson(log.after),
        parsedBefore,
        parsedAfter,
        financeSummary: buildFinanceSummary({
          action: log.action,
          targetType: log.targetType,
          after: parsedAfter,
        }),
        followup: {
          isResolved: Boolean(followup),
          reason: followup?.reason ?? null,
          adminName: followup?.admin?.displayName ?? null,
          adminEmail: followup?.admin?.email ?? null,
          createdAt: followup ? formatKoreanDate(followup.createdAt) : null,
          logId: followup?.id ?? null,
        },
        ipAddress: log.ipAddress,
        createdAt: formatKoreanDate(log.createdAt),
      };
    }),
  };
}

export async function getAdminAuditExportRows(
  filters?: AdminAuditFilters & { limit?: number | null },
): Promise<AdminAuditExportRow[]> {
  const prisma = getPrismaClient();
  const { where } = buildAdminAuditQuery(filters);
  const followupWhere = await buildAuditFollowupWhere(normalizeFollowupStatus(filters?.followupStatus));
  const effectiveWhere = mergeAuditWhere(where, followupWhere);
  const logs = await prisma.adminAuditLog.findMany({
    where: effectiveWhere,
    include: {
      admin: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: normalizeExportLimit(filters?.limit),
  });

  return logs.map((log) => ({
    logId: log.id,
    adminName: log.admin?.displayName ?? "Unknown admin",
    adminEmail: log.admin?.email ?? null,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    reason: log.reason,
    ipAddress: log.ipAddress,
    createdAt: formatKoreanDate(log.createdAt),
    before: stringifyJson(log.before),
    after: stringifyJson(log.after),
  }));
}

function buildRiskTrend(
  logs: Array<{
    action: string;
    createdAt: Date;
  }>,
) {
  const today = getKoreanDateKey(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00+09:00`);
    date.setDate(date.getDate() - (6 - index));
    const dateKey = getKoreanDateKey(date);

    return {
      date: dateKey,
      label: dateKey.slice(5),
      totalCount: 0,
      sensitiveCount: 0,
    };
  });
  const dayMap = new Map(days.map((day) => [day.date, day]));

  for (const log of logs) {
    const dateKey = getKoreanDateKey(log.createdAt);
    const day = dayMap.get(dateKey);

    if (!day) {
      continue;
    }

    day.totalCount += 1;
    if (SENSITIVE_AUDIT_ACTIONS.some((action) => log.action.includes(action))) {
      day.sensitiveCount += 1;
    }
  }

  return days;
}

function buildAdminAuditQuery(filters?: AdminAuditFilters) {
  const normalizedAction = filters?.action?.trim() ?? "";
  const normalizedTargetType = filters?.targetType?.trim() ?? "";
  const normalizedQuery = filters?.query?.trim() ?? "";
  const normalizedAdminId = filters?.adminId?.trim() ?? "";
  const normalizedSensitivity = normalizeSensitivity(filters?.sensitivity);
  const normalizedReason = normalizeReason(filters?.reason);
  const normalizedFollowupStatus = normalizeFollowupStatus(filters?.followupStatus);
  const normalizedFrom = filters?.from?.trim() ?? "";
  const normalizedTo = filters?.to?.trim() ?? "";
  const fromDate = parseDateBoundary(normalizedFrom, "from");
  const toDate = parseDateBoundary(normalizedTo, "to");

  const andFilters: Prisma.AdminAuditLogWhereInput[] = [
    ...(normalizedSensitivity === "sensitive"
      ? [
          {
            OR: SENSITIVE_AUDIT_ACTIONS.map((action) => ({
              action: {
                contains: action,
                mode: "insensitive" as const,
              },
            })),
          },
        ]
      : []),
    ...(normalizedReason === "missing"
      ? [
          {
            AND: [
              {
                OR: SENSITIVE_AUDIT_ACTIONS.map((action) => ({
                  action: {
                    contains: action,
                    mode: "insensitive" as const,
                  },
                })),
              },
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
          },
        ]
      : []),
    ...(normalizedQuery
      ? [
          {
            OR: [
              {
                action: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                targetType: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                targetId: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                reason: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                admin: {
                  is: {
                    OR: [
                      {
                        displayName: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        email: {
                          contains: normalizedQuery,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ]
      : []),
  ];

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(normalizedAction ? { action: normalizedAction } : {}),
    ...(normalizedTargetType ? { targetType: normalizedTargetType } : {}),
    ...(normalizedAdminId ? { adminId: normalizedAdminId } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };

  return {
    normalizedAction,
    normalizedTargetType,
    normalizedQuery,
    normalizedAdminId,
    normalizedSensitivity,
    normalizedReason,
    normalizedFollowupStatus,
    normalizedFrom,
    normalizedTo,
    where,
  };
}

async function buildAuditFollowupWhere(status: string): Promise<Prisma.AdminAuditLogWhereInput | null> {
  if (!status) {
    return null;
  }

  const prisma = getPrismaClient();
  const followups = await prisma.adminAuditLog.findMany({
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
  const targetIds = followups
    .map((followup) => followup.targetId)
    .filter((targetId): targetId is string => Boolean(targetId));

  if (status === "resolved") {
    return {
      id: {
        in: targetIds.length > 0 ? targetIds : ["__no_resolved_audit_followups__"],
      },
    };
  }

  if (status === "unresolved") {
    return {
      id: {
        notIn: targetIds,
      },
    };
  }

  return null;
}

function mergeAuditWhere(
  where: Prisma.AdminAuditLogWhereInput,
  followupWhere: Prisma.AdminAuditLogWhereInput | null,
) {
  if (!followupWhere) {
    return where;
  }

  return {
    ...where,
    AND: [...toAuditAndFilters(where.AND), followupWhere],
  };
}

function toAuditAndFilters(value: Prisma.AdminAuditLogWhereInput["AND"]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeExportLimit(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 5000;
  }

  return Math.min(Math.max(Math.floor(value), 1), 5000);
}

function buildFinanceSummary(input: {
  action: string;
  targetType: string;
  after: Record<string, unknown> | null;
}) {
  const isDeposit =
    input.targetType === "DEPOSIT_REQUEST" || input.action.startsWith("DEPOSIT_");
  const isWithdrawal =
    input.targetType === "WITHDRAWAL_REQUEST" || input.action.startsWith("WITHDRAWAL_");
  const evidence = toPlainObject(input.after?.evidence);
  const txId = typeof evidence?.txId === "string" ? evidence.txId : null;
  const evidenceMemo = typeof evidence?.memo === "string" ? evidence.memo : null;
  const status = typeof input.after?.status === "string" ? input.after.status : null;
  const amount = typeof input.after?.amount === "string" ? input.after.amount : null;
  const currency = typeof input.after?.currency === "string" ? input.after.currency : null;

  if (isDeposit) {
    return {
      kind: "DEPOSIT" as const,
      label: "충전 처리",
      status,
      amount,
      currency,
      txId,
      evidenceMemo,
    };
  }

  if (isWithdrawal) {
    return {
      kind: "WITHDRAWAL" as const,
      label: "출금 처리",
      status,
      amount,
      currency,
      txId,
      evidenceMemo,
    };
  }

  return {
    kind: "OTHER" as const,
    label: "일반 감사",
    status,
    amount,
    currency,
    txId,
    evidenceMemo,
  };
}

function toPlainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function stringifyJson(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value, null, 2);
}

function normalizeSensitivity(value?: string | null) {
  return value === "sensitive" ? "sensitive" : "";
}

function normalizeReason(value?: string | null) {
  return value === "missing" ? "missing" : "";
}

function normalizeFollowupStatus(value?: string | null) {
  return value === "resolved" || value === "unresolved" ? value : "";
}

function parseDateBoundary(value: string, boundary: "from" | "to") {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${boundary === "from" ? "00:00:00" : "23:59:59"}+09:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getKoreanDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

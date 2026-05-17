import { createHash, randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import {
  ADMIN_ROLES,
  type AdminRole,
  roleDescription,
  roleScope,
  roleTitle,
  roleTone,
  toAdminRole,
} from "@/lib/admin/admin-role-policy";
import { getPrismaClient } from "@/lib/prisma";

const ADMIN_INVITE_TOKEN_HOURS = 24;
const PASSWORD_KEY_LENGTH = 64;
const scrypt = promisify(nodeScrypt);

function assertStrongAdminPassword(password: string) {
  if (password.length < 12) {
    throw new Error("관리자 초기 비밀번호는 12자 이상이어야 합니다.");
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    throw new Error("관리자 초기 비밀번호는 영문 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.");
  }
}

export type AdminAccountsState = {
  summary: {
    totalAdmins: number;
    activeAdmins: number;
    lockedAdmins: number;
    superAdmins: number;
  };
  roleSummaries: Array<{
    role: AdminRole;
    title: string;
    description: string;
    members: number;
    tone: "red" | "cyan" | "blue" | "green" | "amber";
  }>;
  adminAccounts: Array<{
    userId: string;
    name: string;
    email: string;
    role: AdminRole;
    status: string;
    scope: string;
    loginState: string;
    loginTone: "red" | "cyan" | "blue" | "green" | "amber";
    lastActive: string;
    auditCount: number;
    activeSessions: number;
    risk: string;
    tone: "red" | "cyan" | "blue" | "green" | "amber";
  }>;
  inviteRows: Array<{
    id: string;
    targetName: string;
    targetEmail: string;
    targetRole: string;
    createdBy: string;
    status: string;
    statusTone: "red" | "cyan" | "blue" | "green" | "amber";
    canRevoke: boolean;
    createdAt: string;
    expiresAt: string;
  }>;
  adminActivityCards: Array<{
    userId: string;
    name: string;
    email: string;
    role: AdminRole;
    status: string;
    totalLogs: number;
    sensitiveLogs: number;
    lastAction: string;
    lastActionAt: string;
    lastReason: string;
    latestActions: Array<{
      action: string;
      label: string;
      target: string;
      reason: string;
      createdAt: string;
      isSensitive: boolean;
    }>;
  }>;
  recentActivityRows: Array<[string, string, string, string, string]>;
};

export type AdminAccountMutationResult = {
  userId: string;
  message: string;
};

export type AdminInviteMutationResult = AdminAccountMutationResult & {
  inviteUrl: string;
  expiresAt: string;
};

export async function getAdminAccountsState(): Promise<AdminAccountsState> {
  const prisma = getPrismaClient();

  const [users, recentLogs, inviteTokens] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: {
          in: [...ADMIN_ROLES],
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        passwordHash: true,
        updatedAt: true,
        sessions: {
          where: {
            expiresAt: {
              gt: new Date(),
            },
          },
          select: {
            id: true,
            lastSeenAt: true,
          },
          orderBy: {
            lastSeenAt: "desc",
          },
          take: 3,
        },
        _count: {
          select: {
            adminAuditLogs: true,
            sessions: true,
          },
        },
      },
      orderBy: [
        {
          role: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    }),
    prisma.adminAuditLog.findMany({
      select: {
        id: true,
        adminId: true,
        action: true,
        targetType: true,
        targetId: true,
        reason: true,
        createdAt: true,
        admin: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 80,
    }),
    prisma.adminInviteToken.findMany({
      select: {
        id: true,
        usedAt: true,
        revokedAt: true,
        createdAt: true,
        expiresAt: true,
        userId: true,
        user: {
          select: {
            email: true,
            displayName: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
  ]);

  const roleCounts = new Map<AdminRole, number>();
  for (const role of ADMIN_ROLES) {
    roleCounts.set(role, 0);
  }

  for (const user of users) {
    const role = toAdminRole(user.role);
    if (role) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
  }

  const activeAdmins = users.filter((user) => user.status === "ACTIVE").length;
  const lockedAdmins = users.filter((user) =>
    ["SUSPENDED", "BANNED"].includes(user.status),
  ).length;

  return {
    summary: {
      totalAdmins: users.length,
      activeAdmins,
      lockedAdmins,
      superAdmins: roleCounts.get("SUPER") ?? 0,
    },
    roleSummaries: ADMIN_ROLES.map((role) => ({
      role,
      title: roleTitle(role),
      description: roleDescription(role),
      members: roleCounts.get(role) ?? 0,
      tone: roleTone(role),
    })),
    adminAccounts: users.map((user) => {
      const role = toAdminRole(user.role) ?? "ADMIN";
      const latestSession = user.sessions[0] ?? null;

      return {
        userId: user.id,
        name: user.displayName,
        email: user.email,
        role,
        status: user.status,
        scope: roleScope(role),
        loginState: loginStateLabel({
          hasPassword: Boolean(user.passwordHash),
          status: user.status,
        }),
        loginTone: loginStateTone({
          hasPassword: Boolean(user.passwordHash),
          status: user.status,
        }),
        lastActive: latestSession
          ? formatKoreanDate(latestSession.lastSeenAt)
          : formatKoreanDate(user.updatedAt),
        auditCount: user._count.adminAuditLogs,
        activeSessions: user.sessions.length,
        risk: accountRiskLabel({
          role,
          status: user.status,
          activeSessions: user.sessions.length,
        }),
        tone: roleTone(role),
      };
    }),
    inviteRows: inviteTokens.map((token) => {
      const inviteStatus = adminInviteStatus(token);

      return {
        id: token.id,
        targetName: token.user.displayName,
        targetEmail: token.user.email,
        targetRole: token.user.role,
        createdBy: token.createdBy?.displayName ?? "시스템",
        status: inviteStatus.label,
        statusTone: inviteStatus.tone,
        canRevoke: inviteStatus.canRevoke,
        createdAt: formatKoreanDate(token.createdAt),
        expiresAt: formatKoreanDate(token.expiresAt),
      };
    }),
    adminActivityCards: users.map((user) => {
      const role = toAdminRole(user.role) ?? "ADMIN";
      const logs = recentLogs.filter((log) => log.adminId === user.id);
      const latestLog = logs[0] ?? null;
      const latestActions = logs.slice(0, 4).map((log) => ({
        action: log.action,
        label: actionLabel(log.action),
        target: log.targetId ?? log.targetType,
        reason: log.reason ?? `${log.targetType} 작업 기록`,
        createdAt: formatKoreanDate(log.createdAt),
        isSensitive: isSensitiveAdminAction(log.action),
      }));

      return {
        userId: user.id,
        name: user.displayName,
        email: user.email,
        role,
        status: user.status,
        totalLogs: logs.length,
        sensitiveLogs: logs.filter((log) => isSensitiveAdminAction(log.action)).length,
        lastAction: latestLog ? actionLabel(latestLog.action) : "최근 작업 없음",
        lastActionAt: latestLog ? formatKoreanDate(latestLog.createdAt) : "-",
        lastReason: latestLog?.reason ?? "최근 기록 없음",
        latestActions,
      };
    }),
    recentActivityRows: recentLogs.map((log) => [
      log.admin?.displayName ?? "시스템",
      actionLabel(log.action),
      log.targetId ?? log.targetType,
      log.reason ?? `${log.targetType} 작업 기록`,
      formatKoreanDate(log.createdAt),
    ]),
  };
}

export async function createPreparedAdminAccount(input: {
  actorId: string;
  email: string;
  displayName: string;
  role: string;
  reason: string;
}): Promise<AdminAccountMutationResult> {
  const prisma = getPrismaClient();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const role = toAdminRole(input.role);
  const reason = input.reason.trim();

  if (!email.includes("@")) {
    throw new Error("올바른 이메일 주소를 입력해 주세요.");
  }

  if (displayName.length < 2) {
    throw new Error("관리자 이름은 2자 이상 입력해 주세요.");
  }

  if (!role) {
    throw new Error("유효한 관리자 역할을 선택해 주세요.");
  }

  if (reason.length < 10) {
    throw new Error("관리자 계정 생성 사유를 10자 이상 입력해 주세요.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new Error("이미 가입된 이메일입니다.");
    }

    const createdUser = await tx.user.create({
      data: {
        email,
        displayName,
        role,
        status: "SUSPENDED",
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "ADMIN_ACCOUNT_PREPARED",
        targetType: "ADMIN_ACCOUNT",
        targetId: createdUser.id,
        reason,
        after: {
          email,
          displayName,
          role,
          status: createdUser.status,
          loginEnabled: false,
        },
      },
    });

    return {
      userId: createdUser.id,
      message:
        "관리자 계정을 초대 준비 상태로 생성했습니다. 실제 로그인 활성화는 초대 링크 발급 후 진행하세요.",
    };
  });
}

export async function updateAdminAccountAccess(input: {
  actorId: string;
  targetUserId: string;
  role: string;
  status: string;
  reason: string;
}): Promise<AdminAccountMutationResult> {
  const prisma = getPrismaClient();
  const nextRole = toAdminRole(input.role);
  const nextStatus = normalizeAdminStatus(input.status);
  const reason = input.reason.trim();

  if (!nextRole || !nextStatus) {
    throw new Error("유효한 관리자 역할과 상태를 선택해 주세요.");
  }

  if (reason.length < 10) {
    throw new Error("권한 변경 사유를 10자 이상 입력해 주세요.");
  }

  if (input.actorId === input.targetUserId) {
    throw new Error("본인의 관리자 권한이나 상태는 직접 변경할 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: {
        id: input.targetUserId,
      },
    });

    if (!targetUser) {
      throw new Error("관리자 계정을 찾을 수 없습니다.");
    }

    const currentRole = toAdminRole(targetUser.role);
    if (!currentRole) {
      throw new Error("관리자 계정만 이 화면에서 변경할 수 있습니다.");
    }

    const activeSuperCount = await tx.user.count({
      where: {
        role: "SUPER",
        status: "ACTIVE",
      },
    });
    const removesLastActiveSuper =
      currentRole === "SUPER" &&
      targetUser.status === "ACTIVE" &&
      (nextRole !== "SUPER" || nextStatus !== "ACTIVE") &&
      activeSuperCount <= 1;

    if (removesLastActiveSuper) {
      throw new Error("마지막 활성 최고관리자는 강등하거나 잠글 수 없습니다.");
    }

    if (targetUser.role === nextRole && targetUser.status === nextStatus) {
      throw new Error("이미 동일한 역할과 상태입니다.");
    }

    const updatedUser = await tx.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        role: nextRole,
        status: nextStatus,
      },
    });

    const deletedSessions = await tx.session.deleteMany({
      where: {
        userId: targetUser.id,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "ADMIN_ACCOUNT_ACCESS_UPDATED",
        targetType: "ADMIN_ACCOUNT",
        targetId: targetUser.id,
        reason,
        before: {
          role: targetUser.role,
          status: targetUser.status,
          email: targetUser.email,
        },
        after: {
          role: updatedUser.role,
          status: updatedUser.status,
          email: updatedUser.email,
          expiredSessions: deletedSessions.count,
        },
      },
    });

    return {
      userId: updatedUser.id,
      message: "관리자 권한을 변경하고 기존 세션을 만료했습니다.",
    };
  });
}

export async function createAdminInvite(input: {
  actorId: string;
  targetUserId: string;
  reason: string;
}): Promise<AdminInviteMutationResult> {
  const prisma = getPrismaClient();
  const reason = input.reason.trim();

  if (reason.length < 10) {
    throw new Error("초대 활성화 사유를 10자 이상 입력해 주세요.");
  }

  if (input.actorId === input.targetUserId) {
    throw new Error("본인 계정에는 관리자 초대 링크를 직접 발급할 수 없습니다.");
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ADMIN_INVITE_TOKEN_HOURS * 60 * 60 * 1000);

  const targetUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: input.targetUserId,
      },
    });

    if (!user) {
      throw new Error("관리자 계정을 찾을 수 없습니다.");
    }

    const role = toAdminRole(user.role);
    if (!role) {
      throw new Error("관리자 계정에만 초대 링크를 발급할 수 있습니다.");
    }

    if (user.passwordHash) {
      throw new Error("이미 로그인 비밀번호가 설정된 관리자입니다.");
    }

    if (user.status === "BANNED") {
      throw new Error("차단된 관리자 계정에는 초대 링크를 발급할 수 없습니다.");
    }

    await tx.adminInviteToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await tx.adminInviteToken.create({
      data: {
        userId: user.id,
        createdById: input.actorId,
        tokenHash,
        expiresAt,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "ADMIN_INVITE_CREATED",
        targetType: "ADMIN_ACCOUNT",
        targetId: user.id,
        reason,
        after: {
          email: user.email,
          role: user.role,
          status: user.status,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return user;
  });

  return {
    userId: targetUser.id,
    inviteUrl: `/admin/invite/${token}`,
    expiresAt: expiresAt.toISOString(),
    message: "관리자 초대 링크를 생성했습니다. 링크는 24시간 동안 1회만 사용할 수 있습니다.",
  };
}

export async function revokeAdminInvite(input: {
  actorId: string;
  inviteId: string;
  reason: string;
}): Promise<AdminAccountMutationResult> {
  const prisma = getPrismaClient();
  const reason = input.reason.trim();

  if (reason.length < 10) {
    throw new Error("초대 취소 사유를 10자 이상 입력해 주세요.");
  }

  const revokedInvite = await prisma.$transaction(async (tx) => {
    const invite = await tx.adminInviteToken.findUnique({
      where: {
        id: input.inviteId,
      },
      include: {
        user: true,
      },
    });

    if (!invite) {
      throw new Error("관리자 초대 링크를 찾을 수 없습니다.");
    }

    if (invite.usedAt) {
      throw new Error("이미 사용 완료된 초대 링크는 취소할 수 없습니다.");
    }

    if (invite.revokedAt) {
      throw new Error("이미 취소된 초대 링크입니다.");
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new Error("이미 만료된 초대 링크는 취소할 수 없습니다.");
    }

    const updatedInvite = await tx.adminInviteToken.update({
      where: {
        id: invite.id,
      },
      data: {
        revokedAt: new Date(),
      },
      include: {
        user: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "ADMIN_INVITE_REVOKED",
        targetType: "ADMIN_ACCOUNT",
        targetId: invite.userId,
        reason,
        before: {
          email: invite.user.email,
          role: invite.user.role,
          expiresAt: invite.expiresAt.toISOString(),
        },
        after: {
          email: invite.user.email,
          role: invite.user.role,
          revokedAt: updatedInvite.revokedAt?.toISOString() ?? null,
        },
      },
    });

    return updatedInvite;
  });

  return {
    userId: revokedInvite.userId,
    message: "관리자 초대 링크를 취소했습니다. 해당 링크는 더 이상 사용할 수 없습니다.",
  };
}

export async function acceptAdminInviteWithToken(input: {
  token: string;
  password: string;
}) {
  const prisma = getPrismaClient();
  assertStrongAdminPassword(input.password);

  const tokenHash = hashToken(input.token);
  const inviteToken = await prisma.adminInviteToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (
    !inviteToken ||
    inviteToken.usedAt ||
    inviteToken.revokedAt ||
    inviteToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new Error("관리자 초대 링크가 유효하지 않거나 만료되었습니다.");
  }

  const role = toAdminRole(inviteToken.user.role);
  if (!role || inviteToken.user.status === "BANNED") {
    throw new Error("초대를 수락할 수 없는 관리자 계정입니다.");
  }

  if (inviteToken.user.passwordHash) {
    throw new Error("이미 비밀번호가 설정된 관리자 계정입니다.");
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: inviteToken.userId,
      },
      data: {
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: inviteToken.user.emailVerifiedAt ?? new Date(),
      },
    });
    await tx.adminInviteToken.update({
      where: {
        id: inviteToken.id,
      },
      data: {
        usedAt: new Date(),
      },
    });
    await tx.session.deleteMany({
      where: {
        userId: inviteToken.userId,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: inviteToken.createdById,
        action: "ADMIN_INVITE_ACCEPTED",
        targetType: "ADMIN_ACCOUNT",
        targetId: inviteToken.userId,
        reason: "관리자 초대 수락 및 초기 비밀번호 설정",
        after: {
          email: inviteToken.user.email,
          role: inviteToken.user.role,
          status: "ACTIVE",
        },
      },
    });
  });

  return {
    message: "관리자 계정이 활성화되었습니다. 관리자 로그인 화면에서 접속해 주세요.",
  };
}

function normalizeAdminStatus(status: string) {
  const allowed = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
  return allowed.includes(status as (typeof allowed)[number])
    ? (status as (typeof allowed)[number])
    : null;
}

function accountRiskLabel(input: {
  role: AdminRole;
  status: string;
  activeSessions: number;
}) {
  if (["SUSPENDED", "BANNED"].includes(input.status)) {
    return "잠금/차단 상태";
  }

  if (input.role === "SUPER") {
    return "권한 변경 가능";
  }

  if (input.role === "FINANCE") {
    return "금액/출금 검토 권한";
  }

  if (input.activeSessions === 0) {
    return "활성 세션 없음";
  }

  return "정상 운영 중";
}

function loginStateLabel(input: { hasPassword: boolean; status: string }) {
  if (!input.hasPassword) {
    return "초대 대기";
  }

  if (input.status !== "ACTIVE") {
    return "로그인 잠금";
  }

  return "로그인 가능";
}

function loginStateTone(input: { hasPassword: boolean; status: string }) {
  if (!input.hasPassword) {
    return "amber";
  }

  if (input.status !== "ACTIVE") {
    return "red";
  }

  return "green";
}

function adminInviteStatus(token: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}) {
  if (token.usedAt) {
    return {
      label: "사용 완료",
      tone: "green" as const,
      canRevoke: false,
    };
  }

  if (token.revokedAt) {
    return {
      label: "취소됨",
      tone: "red" as const,
      canRevoke: false,
    };
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    return {
      label: "만료",
      tone: "red" as const,
      canRevoke: false,
    };
  }

  return {
    label: "수락 대기",
    tone: "amber" as const,
    canRevoke: true,
  };
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    USER_ACCESS_UPDATED: "계정 접근 변경",
    ADMIN_ACCOUNT_PREPARED: "관리자 계정 준비",
    ADMIN_ACCOUNT_ACCESS_UPDATED: "관리자 권한 변경",
    ADMIN_INVITE_CREATED: "관리자 초대 생성",
    ADMIN_INVITE_REVOKED: "관리자 초대 취소",
    ADMIN_INVITE_ACCEPTED: "관리자 초대 수락",
    USER_NOTE_CREATED: "운영 메모",
    DEPOSIT_APPROVED: "충전 승인",
    DEPOSIT_REJECTED: "충전 반려",
    WITHDRAWAL_APPROVED: "출금 승인",
    WITHDRAWAL_REJECTED: "출금 반려",
    REPORT_EXPORT: "리포트 다운로드",
  };

  return labels[action] ?? action;
}

function isSensitiveAdminAction(action: string) {
  return [
    "ADMIN_ACCOUNT",
    "ADMIN_INVITE",
    "WITHDRAWAL",
    "DEPOSIT",
    "DISPUTE",
    "RESTRICTION",
    "REPORT_EXPORT",
    "GAME_",
    "SLA_INCIDENT_RESOLVED",
  ].some((keyword) => action.includes(keyword));
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

import { createHash } from "node:crypto";
import { verifySecret } from "@/lib/auth/secret-hash";
import { getPrismaClient } from "@/lib/prisma";

const ADMIN_PASSWORD_RECHECK_FAILURE_LIMIT = 5;
const ADMIN_PASSWORD_RECHECK_WINDOW_MINUTES = 15;
const ADMIN_PASSWORD_RECHECK_LOCK_MINUTES = 15;

export async function requireAdminPasswordRecheck(input: {
  adminId: string;
  adminPassword: unknown;
}) {
  const password =
    typeof input.adminPassword === "string" ? input.adminPassword.trim() : "";

  if (!password) {
    throw new Error("관리자 비밀번호를 다시 입력해 주세요.");
  }

  const prisma = getPrismaClient();
  const rateLimitKey = getAdminPasswordRecheckRateLimitKey(input.adminId);
  const existingAttempt = await prisma.loginAttempt.findUnique({
    where: {
      email_ipKey: rateLimitKey,
    },
  });
  const now = new Date();

  if (
    existingAttempt?.lockedUntil &&
    existingAttempt.lockedUntil.getTime() > now.getTime()
  ) {
    throw new Error("관리자 비밀번호 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  }

  const admin = await prisma.user.findUnique({
    where: { id: input.adminId },
    select: {
      passwordHash: true,
      status: true,
    },
  });

  if (!admin || ["SUSPENDED", "BANNED"].includes(admin.status)) {
    throw new Error("관리자 계정을 확인할 수 없습니다.");
  }

  if (!admin.passwordHash) {
    throw new Error("관리자 비밀번호가 설정되어 있지 않습니다.");
  }

  const isMatch = await verifySecret(password, admin.passwordHash);
  if (!isMatch) {
    await recordFailedAdminPasswordRecheck(input.adminId);
    throw new Error("관리자 비밀번호가 일치하지 않습니다.");
  }

  if (existingAttempt) {
    await prisma.loginAttempt.delete({
      where: {
        email_ipKey: rateLimitKey,
      },
    });
  }
}

async function recordFailedAdminPasswordRecheck(adminId: string) {
  const prisma = getPrismaClient();
  const now = new Date();
  const windowStartedAt = new Date(
    now.getTime() - ADMIN_PASSWORD_RECHECK_WINDOW_MINUTES * 60 * 1000,
  );
  const rateLimitKey = getAdminPasswordRecheckRateLimitKey(adminId);
  const existing = await prisma.loginAttempt.findUnique({
    where: {
      email_ipKey: rateLimitKey,
    },
  });
  const previousAttemptInWindow =
    existing?.lastFailedAt &&
    existing.lastFailedAt.getTime() >= windowStartedAt.getTime();
  const nextCount = previousAttemptInWindow ? existing.failedCount + 1 : 1;
  const lockedUntil =
    nextCount >= ADMIN_PASSWORD_RECHECK_FAILURE_LIMIT
      ? new Date(now.getTime() + ADMIN_PASSWORD_RECHECK_LOCK_MINUTES * 60 * 1000)
      : null;

  await prisma.loginAttempt.upsert({
    where: {
      email_ipKey: rateLimitKey,
    },
    update: {
      failedCount: nextCount,
      lockedUntil,
      lastFailedAt: now,
    },
    create: {
      ...rateLimitKey,
      failedCount: nextCount,
      lockedUntil,
      lastFailedAt: now,
    },
  });
}

function getAdminPasswordRecheckRateLimitKey(adminId: string) {
  return {
    email: `admin-step-up:${hashValue(adminId)}`,
    ipKey: "admin-password-recheck",
  };
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { ROLE_GROUPS, roleHasAccess } from "@/lib/auth/guards";
import { hashSecret, verifySecret } from "@/lib/auth/secret-hash";
import { sendAdminMfaCodeEmail } from "@/lib/email/transactional-email";
import { getPrismaClient } from "@/lib/prisma";

const ADMIN_MFA_CODE_DIGITS = 6;
const ADMIN_MFA_EXPIRES_MINUTES = 10;
const ADMIN_MFA_RESEND_COOLDOWN_SECONDS = 60;
const ADMIN_MFA_FAILURE_LIMIT = 5;
const ADMIN_MFA_LOCK_MINUTES = 15;

type AdminMfaChallengeRow = {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  failedCount: number;
  lockedUntil: Date | null;
  email: string;
  displayName: string;
  role: string;
  status: string;
};

export async function createAdminMfaChallenge(input: {
  userId: string;
  email: string;
  displayName: string;
  requestIpKey?: string | null;
}) {
  const prisma = getPrismaClient();
  const now = new Date();
  const cooldownStartedAt = new Date(
    now.getTime() - ADMIN_MFA_RESEND_COOLDOWN_SECONDS * 1000,
  );

  await prisma.$executeRaw`
    DELETE FROM "AdminMfaChallenge"
    WHERE "userId" = ${input.userId}
      AND ("consumedAt" IS NOT NULL OR "expiresAt" <= NOW())
  `;

  const recentRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "AdminMfaChallenge"
    WHERE "userId" = ${input.userId}
      AND "createdAt" >= ${cooldownStartedAt}
      AND "consumedAt" IS NULL
      AND "expiresAt" > NOW()
    LIMIT 1
  `;

  if (recentRows.length > 0) {
    throw new Error("관리자 인증번호를 이미 보냈습니다. 잠시 후 다시 시도해 주세요.");
  }

  const code = generateAdminMfaCode();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + ADMIN_MFA_EXPIRES_MINUTES * 60 * 1000);

  await prisma.$executeRaw`
    INSERT INTO "AdminMfaChallenge"
      ("id", "userId", "tokenHash", "codeHash", "expiresAt", "requestIpKey")
    VALUES
      (${randomUUID()}, ${input.userId}, ${tokenHash}, ${await hashSecret(code)}, ${expiresAt}, ${input.requestIpKey ?? null})
  `;

  await sendAdminMfaCodeEmail({
    to: input.email,
    displayName: input.displayName,
    code,
    expiresInMinutes: ADMIN_MFA_EXPIRES_MINUTES,
  });

  return {
    challengeToken: token,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyAdminMfaChallenge(input: {
  challengeToken: unknown;
  code: unknown;
}) {
  const challengeToken =
    typeof input.challengeToken === "string" ? input.challengeToken.trim() : "";
  const code = typeof input.code === "string" ? input.code.trim() : "";

  if (!challengeToken || !/^\d{6}$/.test(code)) {
    throw new Error("관리자 인증번호를 정확히 입력해 주세요.");
  }

  const prisma = getPrismaClient();
  const tokenHash = hashToken(challengeToken);
  const rows = await prisma.$queryRaw<AdminMfaChallengeRow[]>`
    SELECT
      c."id",
      c."userId",
      c."codeHash",
      c."expiresAt",
      c."consumedAt",
      c."failedCount",
      c."lockedUntil",
      u."email",
      u."displayName",
      u."role"::text AS "role",
      u."status"::text AS "status"
    FROM "AdminMfaChallenge" c
    INNER JOIN "User" u ON u."id" = c."userId"
    WHERE c."tokenHash" = ${tokenHash}
    LIMIT 1
  `;
  const challenge = rows[0];

  if (
    !challenge ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() <= Date.now()
  ) {
    throw new Error("관리자 인증번호가 만료되었거나 유효하지 않습니다.");
  }

  if (challenge.lockedUntil && challenge.lockedUntil.getTime() > Date.now()) {
    throw new Error(
      `관리자 인증번호 입력이 잠겼습니다. ${formatAdminMfaLockTime(
        challenge.lockedUntil,
      )} 이후 다시 로그인해 주세요.`,
    );
  }

  if (
    ["SUSPENDED", "BANNED"].includes(challenge.status) ||
    !roleHasAccess(challenge.role, ROLE_GROUPS.ADMIN_OPERATORS)
  ) {
    throw new Error("관리자 로그인을 허용할 수 없는 계정입니다.");
  }

  const isMatch = await verifySecret(code, challenge.codeHash);
  if (!isMatch) {
    await recordFailedMfaAttempt(challenge);
    throw new Error("관리자 인증번호가 일치하지 않습니다.");
  }

  await prisma.$executeRaw`
    UPDATE "AdminMfaChallenge"
    SET "consumedAt" = NOW()
    WHERE "id" = ${challenge.id}
      AND "consumedAt" IS NULL
  `;

  return {
    userId: challenge.userId,
    email: challenge.email,
    displayName: challenge.displayName,
    role: challenge.role,
  };
}

async function recordFailedMfaAttempt(challenge: AdminMfaChallengeRow) {
  const prisma = getPrismaClient();
  const nextFailedCount = challenge.failedCount + 1;
  const lockedUntil =
    nextFailedCount >= ADMIN_MFA_FAILURE_LIMIT
      ? new Date(Date.now() + ADMIN_MFA_LOCK_MINUTES * 60 * 1000)
      : null;

  await prisma.$executeRaw`
    UPDATE "AdminMfaChallenge"
    SET
      "failedCount" = ${nextFailedCount},
      "lockedUntil" = ${lockedUntil}
    WHERE "id" = ${challenge.id}
      AND "consumedAt" IS NULL
  `;

  if (lockedUntil) {
    throw new Error(
      `관리자 인증번호를 너무 많이 틀렸습니다. ${ADMIN_MFA_LOCK_MINUTES}분 후 다시 로그인해 주세요.`,
    );
  }
}

function generateAdminMfaCode() {
  const maximum = 10 ** ADMIN_MFA_CODE_DIGITS;
  return String(randomInt(0, maximum)).padStart(ADMIN_MFA_CODE_DIGITS, "0");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function formatAdminMfaLockTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import {
  assertTransactionalEmailReady,
  buildPublicUrl,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  shouldExposeAuthDebugLinks,
} from "@/lib/email/transactional-email";
import { getPrismaClient } from "@/lib/prisma";
import { ensureUserWallet } from "@/lib/market/wallets";
import { hashSecret, verifySecret } from "@/lib/auth/secret-hash";

const SESSION_COOKIE_NAME = "ggitem_session";
const SESSION_DURATION_DAYS = 7;
const SESSION_IDLE_TIMEOUT_HOURS = 24;
const SESSION_TOUCH_INTERVAL_MINUTES = 10;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_MINUTES = 15;
const UNKNOWN_IP_KEY = "unknown";
const PASSWORD_RESET_TOKEN_MINUTES = 30;
const EMAIL_VERIFICATION_TOKEN_HOURS = 24;
const PENDING_EMAIL_VERIFICATION_COOKIE_NAME = "ggitem_pending_email_verification";
const PENDING_EMAIL_VERIFICATION_TOKEN_HOURS = 24;

const DEMO_ACCOUNTS = [
  {
    email: "super-demo@ggitem.local",
    password: "demo1234",
    displayName: "super-demo",
    role: "SUPER" as const,
  },
  {
    email: "user-demo@ggitem.local",
    password: "demo1234",
    displayName: "user-demo",
    role: "CUSTOMER" as const,
  },
  {
    email: "admin-demo@ggitem.local",
    password: "demo1234",
    displayName: "admin-demo",
    role: "ADMIN" as const,
  },
  {
    email: "finance-demo@ggitem.local",
    password: "demo1234",
    displayName: "finance-demo",
    role: "FINANCE" as const,
  },
  {
    email: "cs-demo@ggitem.local",
    password: "demo1234",
    displayName: "cs-demo",
    role: "CS" as const,
  },
];

export type AppSessionUser = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
};

type PendingEmailVerificationLoginRow = {
  id: string;
  expiresAt: Date;
  usedAt: Date | null;
  userId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
};

export class EmailVerificationRequiredError extends Error {
  code = "EMAIL_VERIFICATION_REQUIRED" as const;
  email: string;
  verificationUrl: string | null;

  constructor(input: { email: string; verificationUrl: string | null }) {
    super("이메일 인증이 필요합니다. 인증 메일을 발송했습니다.");
    this.name = "EmailVerificationRequiredError";
    this.email = input.email;
    this.verificationUrl = input.verificationUrl;
  }
}

async function hashPassword(password: string) {
  return hashSecret(password);
}

async function verifyPassword(password: string, passwordHash: string) {
  return verifySecret(password, passwordHash);
}

export async function verifyCurrentUserPassword(input: {
  userId: string;
  password: string;
}) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      passwordHash: true,
    },
  });

  if (!user?.passwordHash) {
    return false;
  }

  return verifyPassword(input.password, user.passwordHash);
}

async function createSessionForUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  emailVerifiedAt?: Date | null;
}) {
  const prisma = getPrismaClient();
  const token = randomUUID();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      expiresAt: {
        lte: new Date(),
      },
    },
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      token: tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: expiresAt,
  });

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
  };
}

export async function ensureDemoAuthUsers() {
  if (!isDemoModeEnabled()) {
    return;
  }

  const prisma = getPrismaClient();

  for (const account of DEMO_ACCOUNTS) {
    const user = await ensureDemoAuthUser(account.email, prisma);
    if (user) {
      await ensureUserWallet(user.id);
    }
  }
}

async function ensureDemoAuthUser(email: string, prisma = getPrismaClient()) {
  if (!isDemoModeEnabled()) {
    return null;
  }

  const account = DEMO_ACCOUNTS.find((item) => item.email === email);
  if (!account) {
    return null;
  }

  const existing = await prisma.user.findUnique({
    where: {
      email: account.email,
    },
    select: {
      id: true,
      displayName: true,
      role: true,
      passwordHash: true,
    },
  });

  if (existing?.passwordHash) {
    if (
      existing.displayName === account.displayName &&
      existing.role === account.role
    ) {
      return existing;
    }

    return prisma.user.update({
      where: {
        id: existing.id,
      },
      data: {
        displayName: account.displayName,
        role: account.role,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  }

  const passwordHash = await hashPassword(account.password);
  if (existing) {
    return prisma.user.update({
      where: {
        id: existing.id,
      },
      data: {
        displayName: account.displayName,
        role: account.role,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    select: {
      id: true,
    },
  });
}

export async function registerUserAccount(input: {
  email: string;
  displayName: string;
  password: string;
}) {
  const prisma = getPrismaClient();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const password = input.password;

  if (!email || !displayName || !password) {
    throw new Error("\uC774\uB984, \uC774\uBA54\uC77C, \uBE44\uBC00\uBC88\uD638\uB97C \uBAA8\uB450 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  }

  if (!email.includes("@")) {
    throw new Error("\uC62C\uBC14\uB978 \uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  }

  if (displayName.length < 2) {
    throw new Error("\uC774\uB984\uC740 2\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  }

  if (password.length < 8) {
    throw new Error("\uBE44\uBC00\uBC88\uD638\uB294 8\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  }

  const existing = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new Error("\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4.");
  }

  assertTransactionalEmailReady();

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      role: "CUSTOMER",
    },
  });
  await ensureUserWallet(user.id);
  const verificationToken = await createEmailVerificationToken(user.id);
  const verificationUrl = `/verify-email/${verificationToken}`;
  const emailResult = await sendEmailVerificationEmail({
    to: user.email,
    displayName: user.displayName,
    verificationUrl: buildPublicUrl(verificationUrl),
  });
  await createPendingEmailVerificationLoginToken(user.id);

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    message: emailResult.delivered
      ? "가입이 완료되었습니다. 이메일 인증 링크를 발송했습니다."
      : "가입이 완료되었습니다. 개발 환경에서는 인증 링크를 직접 열 수 있습니다.",
    verificationUrl: shouldExposeAuthDebugLinks() ? verificationUrl : null,
    verificationPending: true,
  };
}

export async function signInWithCredentials(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  allowedRoles?: readonly string[];
  forbiddenMessage?: string;
  createSession?: boolean;
}) {
  const prisma = getPrismaClient();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const ipKey = normalizeLoginIpKey(input.ipAddress);

  if (!email || !password) {
    throw new Error("\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }

  if (isDemoModeEnabled()) {
    await ensureDemoAuthUser(email, prisma);
  }
  await assertLoginIsNotLocked(email, ipKey);

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || !user.passwordHash) {
    await recordFailedLoginAttempt(email, ipKey);
    throw new Error("\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }

  if (["SUSPENDED", "BANNED"].includes(user.status)) {
    throw new Error("\uD604\uC7AC \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uB294 \uACC4\uC815\uC785\uB2C8\uB2E4.");
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    await recordFailedLoginAttempt(email, ipKey);
    throw new Error("\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }

  if (input.allowedRoles && !input.allowedRoles.includes(user.role)) {
    throw new Error(input.forbiddenMessage ?? "\uC774 \uD654\uBA74\uC5D0\uC11C \uB85C\uADF8\uC778\uD560 \uC218 \uC5C6\uB294 \uACC4\uC815\uC785\uB2C8\uB2E4.");
  }

  if (!user.emailVerifiedAt && !isInternalRole(user.role)) {
    const verification = await requestEmailVerification({ email: user.email });
    await createPendingEmailVerificationLoginToken(user.id);
    throw new EmailVerificationRequiredError({
      email: user.email,
      verificationUrl: verification.verificationUrl,
    });
  }

  await recordSuccessfulLoginAttempt(email, ipKey);
  if (input.createSession === false) {
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  return createSessionForUser(user);
}

export async function createSessionForVerifiedUserId(userId: string) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || ["SUSPENDED", "BANNED"].includes(user.status)) {
    throw new Error("로그인할 수 없는 관리자 계정입니다.");
  }

  return createSessionForUser(user);
}
export async function signOutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const prisma = getPrismaClient();
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({
      where: {
        token: tokenHash,
      },
    });
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentSessionUser(input?: {
  touch?: boolean;
}): Promise<AppSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const prisma = getPrismaClient();
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: {
      token: tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({
      where: {
        token: tokenHash,
      },
    });

    return null;
  }

  if (
    session.lastSeenAt.getTime() <=
    Date.now() - SESSION_IDLE_TIMEOUT_HOURS * 60 * 60 * 1000
  ) {
    await prisma.session.deleteMany({
      where: {
        token: tokenHash,
      },
    });

    return null;
  }

  if (["SUSPENDED", "BANNED"].includes(session.user.status)) {
    await prisma.session.deleteMany({
      where: {
        token: tokenHash,
      },
    });

    return null;
  }

  const shouldTouchSession =
    input?.touch !== false &&
    session.lastSeenAt.getTime() <=
      Date.now() - SESSION_TOUCH_INTERVAL_MINUTES * 60 * 1000;

  if (shouldTouchSession) {
    const touchedSession = await prisma.session.updateMany({
      where: {
        token: tokenHash,
        userId: session.userId,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });

    if (touchedSession.count === 0) {
      return null;
    }
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
    status: session.user.status,
    emailVerifiedAt: session.user.emailVerifiedAt,
  };
}

export async function getCurrentUserEmailForRole(input: {
  allowedRoles: string[];
  fallbackEmail: string;
}) {
  const sessionUser = await getCurrentSessionUser();
  if (sessionUser && input.allowedRoles.includes(sessionUser.role)) {
    if (!sessionUser.emailVerifiedAt && !isInternalRole(sessionUser.role)) {
      throw new Error("이메일 인증이 필요합니다.");
    }

    return sessionUser.email;
  }

  if (isDemoModeEnabled()) {
    return input.fallbackEmail;
  }

  throw new Error("로그인이 필요합니다.");
}

export function getDemoAccountOptions() {
  if (!isDemoModeEnabled()) {
    return [];
  }

  return DEMO_ACCOUNTS.map((account) => ({
    email: account.email,
    password: account.password,
    displayName: account.displayName,
    role: account.role,
  }));
}

export async function requestPasswordReset(input: { email: string }) {
  const prisma = getPrismaClient();
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  if (!user) {
    return {
      message: "\uACC4\uC815\uC774 \uC874\uC7AC\uD558\uBA74 \uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815 \uB9C1\uD06C\uAC00 \uC900\uBE44\uB429\uB2C8\uB2E4.",
      resetUrl: null,
    };
  }

  assertTransactionalEmailReady();

  const token = await createPasswordResetToken(user.id);
  const resetUrl = `/password-reset/${token}`;
  const emailResult = await sendPasswordResetEmail({
    to: user.email,
    displayName: user.displayName,
    resetUrl: buildPublicUrl(resetUrl),
  });

  return {
    message: emailResult.delivered
      ? "비밀번호 재설정 메일을 발송했습니다."
      : "비밀번호 재설정 링크가 생성되었습니다. 개발 환경에서는 링크를 직접 열 수 있습니다.",
    resetUrl: shouldExposeAuthDebugLinks() ? resetUrl : null,
  };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}) {
  const prisma = getPrismaClient();
  const password = input.password;

  if (password.length < 8) {
    throw new Error("\uBE44\uBC00\uBC88\uD638\uB294 8\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  }

  const tokenHash = hashToken(input.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new Error("\uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815 \uB9C1\uD06C\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uAC70\uB098 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const consumedToken = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (consumedToken.count === 0) {
      throw new Error(
        "\uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815 \uB9C1\uD06C\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uAC70\uB098 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
      );
    }

    await tx.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        passwordHash,
      },
    });
    await tx.session.deleteMany({
      where: {
        userId: resetToken.userId,
      },
    });
  });

  return {
    message: "\uBE44\uBC00\uBC88\uD638\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.",
  };
}
export async function requestEmailVerification(input: { email: string }) {
  const prisma = getPrismaClient();
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerifiedAt: true,
    },
  });

  if (!user || user.emailVerifiedAt) {
    return {
      message: "\uC778\uC99D\uC774 \uD544\uC694\uD55C \uACC4\uC815\uC774\uBA74 \uC774\uBA54\uC77C \uC778\uC99D \uB9C1\uD06C\uAC00 \uC900\uBE44\uB429\uB2C8\uB2E4.",
      verificationUrl: null,
    };
  }

  assertTransactionalEmailReady();

  const token = await createEmailVerificationToken(user.id);
  const verificationUrl = `/verify-email/${token}`;
  const emailResult = await sendEmailVerificationEmail({
    to: user.email,
    displayName: user.displayName,
    verificationUrl: buildPublicUrl(verificationUrl),
  });

  return {
    message: emailResult.delivered
      ? "이메일 인증 메일을 발송했습니다."
      : "이메일 인증 링크가 생성되었습니다. 개발 환경에서는 링크를 직접 열 수 있습니다.",
    verificationUrl: shouldExposeAuthDebugLinks() ? verificationUrl : null,
  };
}

export async function getPendingEmailVerificationStatus() {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_EMAIL_VERIFICATION_COOKIE_NAME)?.value;

  if (!pendingToken) {
    return {
      status: "missing" as const,
    };
  }

  const prisma = getPrismaClient();
  const tokenHash = hashToken(pendingToken);
  const rows = await prisma.$queryRaw<PendingEmailVerificationLoginRow[]>`
    SELECT
      t."id",
      t."expiresAt",
      t."usedAt",
      u."id" AS "userId",
      u."email",
      u."displayName",
      u."role"::text AS "role",
      u."status"::text AS "status",
      u."emailVerifiedAt"
    FROM "EmailVerificationLoginToken" t
    INNER JOIN "User" u ON u."id" = t."userId"
    WHERE t."tokenHash" = ${tokenHash}
    LIMIT 1
  `;
  const pendingLogin = rows[0];

  if (
    !pendingLogin ||
    pendingLogin.usedAt ||
    pendingLogin.expiresAt.getTime() <= Date.now()
  ) {
    await clearPendingEmailVerificationCookie();
    return {
      status: "expired" as const,
    };
  }

  if (["SUSPENDED", "BANNED"].includes(pendingLogin.status)) {
    await clearPendingEmailVerificationCookie();
    return {
      status: "blocked" as const,
      message: "현재 사용할 수 없는 계정입니다.",
    };
  }

  if (!pendingLogin.emailVerifiedAt) {
    return {
      status: "pending" as const,
      email: pendingLogin.email,
    };
  }

  const consumedToken = await prisma.$executeRaw`
    UPDATE "EmailVerificationLoginToken"
    SET "usedAt" = NOW()
    WHERE "id" = ${pendingLogin.id}
      AND "usedAt" IS NULL
      AND "expiresAt" > NOW()
  `;

  if (consumedToken !== 1) {
    await clearPendingEmailVerificationCookie();
    return {
      status: "expired" as const,
    };
  }

  await createSessionForUser({
    id: pendingLogin.userId,
    email: pendingLogin.email,
    displayName: pendingLogin.displayName,
    role: pendingLogin.role,
    status: pendingLogin.status,
    emailVerifiedAt: pendingLogin.emailVerifiedAt,
  });
  await clearPendingEmailVerificationCookie();

  return {
    status: "verified" as const,
    redirectPath: "/my/payment-pin/setup",
  };
}

export async function verifyEmailWithToken(input: { token: string }) {
  const prisma = getPrismaClient();
  const tokenHash = hashToken(input.token);
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new Error("\uC774\uBA54\uC77C \uC778\uC99D \uB9C1\uD06C\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uAC70\uB098 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  }

  const verifiedUser = await prisma.$transaction(async (tx) => {
    const consumedToken = await tx.emailVerificationToken.updateMany({
      where: {
        id: verificationToken.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (consumedToken.count === 0) {
      throw new Error(
        "\uC774\uBA54\uC77C \uC778\uC99D \uB9C1\uD06C\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uAC70\uB098 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
      );
    }

    return tx.user.update({
      where: {
        id: verificationToken.userId,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
  });

  if (["SUSPENDED", "BANNED"].includes(verifiedUser.status)) {
    throw new Error("현재 사용할 수 없는 계정입니다.");
  }

  await createSessionForUser(verifiedUser);

  return {
    message: "\uC774\uBA54\uC77C \uC778\uC99D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
    redirectPath: "/my/payment-pin/setup",
  };
}
async function assertLoginIsNotLocked(email: string, ipKey: string) {
  const prisma = getPrismaClient();
  const attempt = await prisma.loginAttempt.findUnique({
    where: {
      email_ipKey: {
        email,
        ipKey,
      },
    },
  });

  if (!attempt?.lockedUntil) {
    return;
  }

  if (attempt.lockedUntil.getTime() <= Date.now()) {
    await prisma.loginAttempt.update({
      where: {
        email_ipKey: {
          email,
          ipKey,
        },
      },
      data: {
        failedCount: 0,
        lockedUntil: null,
      },
    });
    return;
  }

  throw new Error(
    `\uB85C\uADF8\uC778 \uC2E4\uD328\uAC00 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4. ${formatLoginLockTime(
      attempt.lockedUntil,
    )} \uC774\uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.`,
  );
}
async function recordFailedLoginAttempt(email: string, ipKey: string) {
  const prisma = getPrismaClient();
  const now = new Date();
  const existing = await prisma.loginAttempt.findUnique({
    where: {
      email_ipKey: {
        email,
        ipKey,
      },
    },
  });
  const nextFailedCount = (existing?.failedCount ?? 0) + 1;
  const lockedUntil =
    nextFailedCount >= LOGIN_FAILURE_LIMIT
      ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000)
      : null;

  await prisma.loginAttempt.upsert({
    where: {
      email_ipKey: {
        email,
        ipKey,
      },
    },
    update: {
      failedCount: nextFailedCount,
      lockedUntil,
      lastFailedAt: now,
    },
    create: {
      email,
      ipKey,
      failedCount: nextFailedCount,
      lockedUntil,
      lastFailedAt: now,
    },
  });
}

async function recordSuccessfulLoginAttempt(email: string, ipKey: string) {
  const prisma = getPrismaClient();

  await prisma.loginAttempt.upsert({
    where: {
      email_ipKey: {
        email,
        ipKey,
      },
    },
    update: {
      failedCount: 0,
      lockedUntil: null,
      lastSuccessAt: new Date(),
    },
    create: {
      email,
      ipKey,
      failedCount: 0,
      lastSuccessAt: new Date(),
    },
  });
}

async function createPasswordResetToken(userId: string) {
  const prisma = getPrismaClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000),
    },
  });

  return token;
}

async function createEmailVerificationToken(userId: string) {
  const prisma = getPrismaClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000,
      ),
    },
  });

  return token;
}

async function createPendingEmailVerificationLoginToken(userId: string) {
  const prisma = getPrismaClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + PENDING_EMAIL_VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000,
  );

  await prisma.$executeRaw`
    DELETE FROM "EmailVerificationLoginToken"
    WHERE "userId" = ${userId}
      AND ("usedAt" IS NOT NULL OR "expiresAt" <= NOW())
  `;
  await prisma.$executeRaw`
    INSERT INTO "EmailVerificationLoginToken" ("id", "userId", "tokenHash", "expiresAt")
    VALUES (${randomUUID()}, ${userId}, ${tokenHash}, ${expiresAt})
  `;

  const cookieStore = await cookies();
  cookieStore.set(PENDING_EMAIL_VERIFICATION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: expiresAt,
  });

  return token;
}

async function clearPendingEmailVerificationCookie() {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_EMAIL_VERIFICATION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    expires: new Date(0),
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeLoginIpKey(ipAddress: string | null | undefined) {
  return ipAddress?.split(",")[0]?.trim() || UNKNOWN_IP_KEY;
}

function shouldUseSecureSessionCookie() {
  const configuredValue = process.env.GGITEM_SECURE_SESSION_COOKIE?.trim()
    .toLowerCase();

  if (configuredValue) {
    return ["1", "true", "yes"].includes(configuredValue);
  }

  return process.env.NODE_ENV === "production";
}

function isInternalRole(role: string) {
  return ["CS", "MODERATOR", "FINANCE", "ADMIN", "SUPER"].includes(role);
}

function formatLoginLockTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { getPrismaClient } from "@/lib/prisma";
import { ensureUserWallet } from "@/lib/market/wallets";

const SESSION_COOKIE_NAME = "ggitem_session";
const SESSION_DURATION_DAYS = 7;
const SESSION_IDLE_TIMEOUT_HOURS = 24;
const PASSWORD_KEY_LENGTH = 64;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_MINUTES = 15;
const UNKNOWN_IP_KEY = "unknown";
const PASSWORD_RESET_TOKEN_MINUTES = 30;
const EMAIL_VERIFICATION_TOKEN_HOURS = 24;
const scrypt = promisify(nodeScrypt);

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
};

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, digest] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !salt || !digest) {
    return false;
  }

  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(digest, "hex");

  if (stored.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(stored, derived);
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
}) {
  const prisma = getPrismaClient();
  const token = randomUUID();
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
      token,
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
  };
}

export async function ensureDemoAuthUsers() {
  const prisma = getPrismaClient();

  for (const account of DEMO_ACCOUNTS) {
    const user = await ensureDemoAuthUser(account.email, prisma);
    if (user) {
      await ensureUserWallet(user.id);
    }
  }
}

async function ensureDemoAuthUser(email: string, prisma = getPrismaClient()) {
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
  const sessionUser = await createSessionForUser(user);

  return {
    ...sessionUser,
    verificationUrl: `/verify-email/${verificationToken}`,
  };
}

export async function signInWithCredentials(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  allowedRoles?: readonly string[];
  forbiddenMessage?: string;
}) {
  const prisma = getPrismaClient();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const ipKey = normalizeLoginIpKey(input.ipAddress);

  if (!email || !password) {
    throw new Error("\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }

  await ensureDemoAuthUser(email, prisma);
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

  await recordSuccessfulLoginAttempt(email, ipKey);
  return createSessionForUser(user);
}
export async function signOutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const prisma = getPrismaClient();
    await prisma.session.deleteMany({
      where: {
        token,
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

export async function getCurrentSessionUser(): Promise<AppSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const prisma = getPrismaClient();
  const session = await prisma.session.findUnique({
    where: {
      token,
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
        token,
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
        token,
      },
    });

    return null;
  }

  if (["SUSPENDED", "BANNED"].includes(session.user.status)) {
    await prisma.session.deleteMany({
      where: {
        token,
      },
    });

    return null;
  }

  const touchedSession = await prisma.session.updateMany({
    where: {
      token,
      userId: session.userId,
    },
    data: {
      lastSeenAt: new Date(),
    },
  });

  if (touchedSession.count === 0) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
    status: session.user.status,
  };
}

export async function getCurrentUserEmailForRole(input: {
  allowedRoles: string[];
  fallbackEmail: string;
}) {
  const sessionUser = await getCurrentSessionUser();
  if (sessionUser && input.allowedRoles.includes(sessionUser.role)) {
    return sessionUser.email;
  }

  return input.fallbackEmail;
}

export function getDemoAccountOptions() {
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
    },
  });

  if (!user) {
    return {
      message: "\uACC4\uC815\uC774 \uC874\uC7AC\uD558\uBA74 \uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815 \uB9C1\uD06C\uAC00 \uC900\uBE44\uB429\uB2C8\uB2E4.",
      resetUrl: null,
    };
  }

  const token = await createPasswordResetToken(user.id);

  return {
    message: "\uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815 \uB9C1\uD06C\uAC00 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC5F0\uB3D9\uC740 \uCD94\uD6C4 \uC5F0\uACB0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    resetUrl: `/password-reset/${token}`,
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
      emailVerifiedAt: true,
    },
  });

  if (!user || user.emailVerifiedAt) {
    return {
      message: "\uC778\uC99D\uC774 \uD544\uC694\uD55C \uACC4\uC815\uC774\uBA74 \uC774\uBA54\uC77C \uC778\uC99D \uB9C1\uD06C\uAC00 \uC900\uBE44\uB429\uB2C8\uB2E4.",
      verificationUrl: null,
    };
  }

  const token = await createEmailVerificationToken(user.id);

  return {
    message: "\uC774\uBA54\uC77C \uC778\uC99D \uB9C1\uD06C\uAC00 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uBA54\uC77C \uBC1C\uC1A1 \uC5F0\uB3D9\uC740 \uCD94\uD6C4 \uC5F0\uACB0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    verificationUrl: `/verify-email/${token}`,
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

  await prisma.$transaction(async (tx) => {
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

    await tx.user.update({
      where: {
        id: verificationToken.userId,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
    });
  });

  return {
    message: "\uC774\uBA54\uC77C \uC778\uC99D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
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

  return false;
}

function formatLoginLockTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

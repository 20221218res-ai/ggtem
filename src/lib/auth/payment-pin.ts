import { hashSecret, verifySecret } from "@/lib/auth/secret-hash";
import { getPrismaClient } from "@/lib/prisma";

const PAYMENT_PIN_PATTERN = /^\d{4,6}$/;
const PAYMENT_PIN_FAILURE_LIMIT = 5;
const PAYMENT_PIN_LOCK_MINUTES = 15;
const PAYMENT_PIN_ATTEMPT_IP_KEY = "payment-pin";

export type PaymentPinCheck =
  | { ok: true; missing: false }
  | {
      ok: false;
      missing: true;
      message: string;
      status: 409;
      code: "PAYMENT_PIN_REQUIRED";
    }
  | {
      ok: false;
      missing: false;
      message: string;
      status: 400 | 403 | 423;
      code: "PAYMENT_PIN_INVALID" | "PAYMENT_PIN_FORMAT_INVALID" | "PAYMENT_PIN_LOCKED";
    };

export function normalizePaymentPin(pin: unknown) {
  return typeof pin === "string" ? pin.trim() : "";
}

export function isValidPaymentPinFormat(pin: string) {
  return PAYMENT_PIN_PATTERN.test(pin);
}

export async function getPaymentPinStatus(userId: string) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { paymentPinHash: true, paymentPinSetAt: true },
  });

  return {
    hasPaymentPin: Boolean(user?.paymentPinHash),
    paymentPinSetAt: user?.paymentPinSetAt ?? null,
  };
}

export async function verifyCurrentUserPaymentPin(input: {
  userId: string;
  paymentPin: unknown;
}): Promise<PaymentPinCheck> {
  const paymentPin = normalizePaymentPin(input.paymentPin);
  const prisma = getPrismaClient();
  const lockCheck = await getPaymentPinLockCheck(input.userId);
  if (lockCheck) {
    return lockCheck;
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { paymentPinHash: true },
  });

  if (!user?.paymentPinHash) {
    return {
      ok: false,
      missing: true,
      status: 409,
      code: "PAYMENT_PIN_REQUIRED",
      message: "결제 PIN을 먼저 설정해 주세요.",
    };
  }

  if (!isValidPaymentPinFormat(paymentPin)) {
    return {
      ok: false,
      missing: false,
      status: 400,
      code: "PAYMENT_PIN_FORMAT_INVALID",
      message: "결제 PIN은 숫자 4~6자리로 입력해 주세요.",
    };
  }

  const isMatch = await verifySecret(paymentPin, user.paymentPinHash);
  if (!isMatch) {
    await recordFailedPaymentPinAttempt(input.userId);
    return {
      ok: false,
      missing: false,
      status: 403,
      code: "PAYMENT_PIN_INVALID",
      message: "결제 PIN이 일치하지 않습니다.",
    };
  }

  await recordSuccessfulPaymentPinAttempt(input.userId);
  return { ok: true, missing: false };
}

export async function setCurrentUserPaymentPin(input: {
  userId: string;
  paymentPin: unknown;
  currentPaymentPin?: unknown;
}) {
  const paymentPin = normalizePaymentPin(input.paymentPin);
  if (!isValidPaymentPinFormat(paymentPin)) {
    return {
      ok: false as const,
      status: 400,
      message: "결제 PIN은 숫자 4~6자리로 설정해 주세요.",
    };
  }

  const prisma = getPrismaClient();
  const existing = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { paymentPinHash: true },
  });

  if (existing?.paymentPinHash) {
    const currentCheck = await verifyCurrentUserPaymentPin({
      userId: input.userId,
      paymentPin: input.currentPaymentPin,
    });
    if (!currentCheck.ok) {
      return {
        ok: false as const,
        status: currentCheck.status,
        message: "현재 결제 PIN이 일치하지 않습니다.",
      };
    }
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      paymentPinHash: await hashSecret(paymentPin),
      paymentPinSetAt: existing?.paymentPinHash ? undefined : now,
      paymentPinUpdatedAt: now,
    },
  });

  return {
    ok: true as const,
    paymentPinSetAt: now.toISOString(),
    message: existing?.paymentPinHash
      ? "결제 PIN을 변경했습니다."
      : "결제 PIN을 설정했습니다.",
  };
}

export async function resetUserPaymentPin(userId: string) {
  const prisma = getPrismaClient();
  await prisma.user.update({
    where: { id: userId },
    data: {
      paymentPinHash: null,
      paymentPinSetAt: null,
      paymentPinUpdatedAt: null,
      paymentPinResetAt: new Date(),
    },
  });
  await clearPaymentPinAttempts(userId);
}

async function getPaymentPinLockCheck(userId: string): Promise<PaymentPinCheck | null> {
  const prisma = getPrismaClient();
  const attempt = await prisma.loginAttempt.findUnique({
    where: {
      email_ipKey: {
        email: getPaymentPinAttemptEmail(userId),
        ipKey: PAYMENT_PIN_ATTEMPT_IP_KEY,
      },
    },
  });

  if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      missing: false,
      status: 423,
      code: "PAYMENT_PIN_LOCKED",
      message: `결제 PIN 입력이 잠시 잠겼습니다. ${formatPaymentPinLockTime(
        attempt.lockedUntil,
      )} 이후 다시 시도해 주세요.`,
    };
  }

  return null;
}

async function recordFailedPaymentPinAttempt(userId: string) {
  const prisma = getPrismaClient();
  const now = new Date();
  const email = getPaymentPinAttemptEmail(userId);
  const existing = await prisma.loginAttempt.findUnique({
    where: {
      email_ipKey: {
        email,
        ipKey: PAYMENT_PIN_ATTEMPT_IP_KEY,
      },
    },
  });
  const nextFailedCount = (existing?.failedCount ?? 0) + 1;
  const lockedUntil =
    nextFailedCount >= PAYMENT_PIN_FAILURE_LIMIT
      ? new Date(now.getTime() + PAYMENT_PIN_LOCK_MINUTES * 60 * 1000)
      : null;

  await prisma.loginAttempt.upsert({
    where: {
      email_ipKey: {
        email,
        ipKey: PAYMENT_PIN_ATTEMPT_IP_KEY,
      },
    },
    update: {
      failedCount: nextFailedCount,
      lockedUntil,
      lastFailedAt: now,
    },
    create: {
      email,
      ipKey: PAYMENT_PIN_ATTEMPT_IP_KEY,
      failedCount: nextFailedCount,
      lockedUntil,
      lastFailedAt: now,
    },
  });
}

async function recordSuccessfulPaymentPinAttempt(userId: string) {
  const prisma = getPrismaClient();
  await prisma.loginAttempt.upsert({
    where: {
      email_ipKey: {
        email: getPaymentPinAttemptEmail(userId),
        ipKey: PAYMENT_PIN_ATTEMPT_IP_KEY,
      },
    },
    update: {
      failedCount: 0,
      lockedUntil: null,
      lastSuccessAt: new Date(),
    },
    create: {
      email: getPaymentPinAttemptEmail(userId),
      ipKey: PAYMENT_PIN_ATTEMPT_IP_KEY,
      failedCount: 0,
      lastSuccessAt: new Date(),
    },
  });
}

async function clearPaymentPinAttempts(userId: string) {
  const prisma = getPrismaClient();
  await prisma.loginAttempt.deleteMany({
    where: {
      email: getPaymentPinAttemptEmail(userId),
      ipKey: PAYMENT_PIN_ATTEMPT_IP_KEY,
    },
  });
}

function getPaymentPinAttemptEmail(userId: string) {
  return `payment-pin:${userId}`;
}

function formatPaymentPinLockTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

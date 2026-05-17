import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export class RateLimitError extends Error {
  status = 429 as const;
  code = "RATE_LIMITED" as const;

  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function assertAuthRateLimit(input: {
  scope: string;
  identifier: string;
  ipKey?: string | null;
  limit: number;
  windowMinutes: number;
  lockMinutes: number;
  message?: string;
}) {
  const identifier = input.identifier.trim().toLowerCase();
  if (!identifier) {
    return;
  }

  const now = new Date();
  const prisma = getPrismaClient();
  const email = `rate:${input.scope}:${hashValue(identifier)}`;
  const ipKey = input.ipKey ? `ip:${hashValue(input.ipKey)}` : "ip:unknown";
  const existing = await prisma.loginAttempt.findUnique({
    where: {
      email_ipKey: {
        email,
        ipKey,
      },
    },
  });

  if (existing?.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
    throw new RateLimitError(
      input.message ?? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const windowStartedAt = new Date(now.getTime() - input.windowMinutes * 60 * 1000);
  const previousAttemptInWindow =
    existing?.lastFailedAt && existing.lastFailedAt.getTime() >= windowStartedAt.getTime();
  const nextCount = previousAttemptInWindow ? existing.failedCount + 1 : 1;
  const lockedUntil =
    nextCount > input.limit
      ? new Date(now.getTime() + input.lockMinutes * 60 * 1000)
      : null;

  await prisma.loginAttempt.upsert({
    where: {
      email_ipKey: {
        email,
        ipKey,
      },
    },
    update: {
      failedCount: nextCount,
      lockedUntil,
      lastFailedAt: now,
    },
    create: {
      email,
      ipKey,
      failedCount: nextCount,
      lockedUntil,
      lastFailedAt: now,
    },
  });

  if (lockedUntil) {
    throw new RateLimitError(
      input.message ?? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

export function getRequestRateLimitKey(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function createAuthRateLimitResponse(error: RateLimitError) {
  return NextResponse.json(
    {
      code: error.code,
      message: error.message,
      messageKey: "auth.rateLimited",
    },
    { status: error.status },
  );
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

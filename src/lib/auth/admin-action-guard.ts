import { NextRequest, NextResponse } from "next/server";
import { requireAdminPasswordRecheck } from "@/lib/auth/admin-step-up";
import {
  assertAuthRateLimit,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";

type AdminActionGuardInput = {
  request: NextRequest;
  adminId: string;
  action: string;
  adminPassword?: unknown;
  requirePassword?: boolean;
  limit?: number;
  windowMinutes?: number;
  lockMinutes?: number;
};

export async function requireAdminActionGuard(input: AdminActionGuardInput) {
  const limit = input.limit ?? 5;
  const windowMinutes = input.windowMinutes ?? 15;
  const lockMinutes = input.lockMinutes ?? 15;
  const ipKey = getRequestRateLimitKey(input.request.headers);
  const action = normalizeAction(input.action);

  await assertAuthRateLimit({
    scope: "admin-action-ip",
    identifier: `${action}:${ipKey}`,
    ipKey,
    limit: Math.max(limit * 2, 10),
    windowMinutes,
    lockMinutes,
    message: "Too many administrator action attempts. Please try again later.",
  });

  await assertAuthRateLimit({
    scope: "admin-action-account",
    identifier: `${action}:${input.adminId}`,
    ipKey,
    limit,
    windowMinutes,
    lockMinutes,
    message: "Too many attempts for this administrator action. Please try again later.",
  });

  if (input.requirePassword ?? true) {
    await requireAdminPasswordRecheck({
      adminId: input.adminId,
      adminPassword: input.adminPassword,
    });
  }
}

export async function getAdminActionGuardResponse(input: AdminActionGuardInput) {
  try {
    await requireAdminActionGuard(input);
    return null;
  } catch (error) {
    const response = getAdminActionErrorResponse(error);
    if (response) {
      return response;
    }

    throw error;
  }
}

export function getAdminActionErrorResponse(error: unknown) {
  if (error instanceof RateLimitError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return null;
}

function normalizeAction(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-") || "unknown";
}

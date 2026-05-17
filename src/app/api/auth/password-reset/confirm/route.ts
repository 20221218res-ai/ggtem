import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthRateLimit,
  createAuthRateLimitResponse,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";
import { resetPasswordWithToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
    };

    if (!body.token || !body.password) {
      return NextResponse.json(
        { code: "AUTH_PASSWORD_RESET_FIELDS_REQUIRED", message: "토큰과 새 비밀번호가 필요합니다." },
        { status: 400 },
      );
    }

    const ipKey = getRequestRateLimitKey(request.headers);
    await assertAuthRateLimit({
      scope: "password-reset-confirm-ip",
      identifier: ipKey,
      ipKey,
      limit: 20,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "Too many password reset attempts. Please try again later.",
    });
    await assertAuthRateLimit({
      scope: "password-reset-confirm-token",
      identifier: body.token,
      ipKey,
      limit: 5,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "Too many password reset attempts for this link. Please request a new link.",
    });

    const result = await resetPasswordWithToken({
      token: body.token,
      password: body.password,
    });

    return NextResponse.json({
      code: "AUTH_PASSWORD_CHANGED",
      ...result,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createAuthRateLimitResponse(error);
    }

    return NextResponse.json(
      {
        code: "AUTH_PASSWORD_RESET_CONFIRM_FAILED",
        message: error instanceof Error ? error.message : "비밀번호를 재설정하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

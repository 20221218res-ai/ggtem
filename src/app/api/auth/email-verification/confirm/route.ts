import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthRateLimit,
  createAuthRateLimitResponse,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";
import { verifyEmailWithToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
    };

    if (!body.token) {
      return NextResponse.json(
        { code: "AUTH_VERIFICATION_TOKEN_REQUIRED", message: "인증 토큰이 필요합니다." },
        { status: 400 },
      );
    }

    const ipKey = getRequestRateLimitKey(request.headers);
    await assertAuthRateLimit({
      scope: "email-verification-confirm-ip",
      identifier: ipKey,
      ipKey,
      limit: 30,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "Too many email verification attempts. Please try again later.",
    });
    await assertAuthRateLimit({
      scope: "email-verification-confirm-token",
      identifier: body.token,
      ipKey,
      limit: 5,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "Too many email verification attempts for this link. Please request a new link.",
    });

    const result = await verifyEmailWithToken({ token: body.token });

    return NextResponse.json({
      code: "AUTH_EMAIL_VERIFICATION_COMPLETED",
      ...result,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createAuthRateLimitResponse(error);
    }

    return NextResponse.json(
      {
        code: "AUTH_EMAIL_VERIFICATION_FAILED",
        message: error instanceof Error ? error.message : "이메일 인증에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

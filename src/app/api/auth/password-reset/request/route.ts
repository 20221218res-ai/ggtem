import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthRateLimit,
  createAuthRateLimitResponse,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";
import { requestPasswordReset } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
    };

    if (!body.email) {
      return NextResponse.json(
        { code: "AUTH_EMAIL_REQUIRED", message: "이메일을 입력해 주세요." },
        { status: 400 },
      );
    }

    const ipKey = getRequestRateLimitKey(request.headers);
    await assertAuthRateLimit({
      scope: "password-reset-ip",
      identifier: ipKey,
      ipKey,
      limit: 10,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "비밀번호 재설정 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
    await assertAuthRateLimit({
      scope: "password-reset-email",
      identifier: body.email,
      ipKey,
      limit: 3,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "이 이메일로 비밀번호 재설정 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });

    const result = await requestPasswordReset({ email: body.email });

    return NextResponse.json({
      code: "AUTH_PASSWORD_RESET_REQUEST_PREPARED",
      ...result,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createAuthRateLimitResponse(error);
    }

    return NextResponse.json(
      {
        code: "AUTH_PASSWORD_RESET_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "비밀번호 재설정 링크를 생성하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

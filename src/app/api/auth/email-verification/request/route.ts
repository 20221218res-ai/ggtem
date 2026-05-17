import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthRateLimit,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";
import { requestEmailVerification } from "@/lib/auth/session";

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
      scope: "email-verification-ip",
      identifier: ipKey,
      ipKey,
      limit: 20,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "이메일 인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
    await assertAuthRateLimit({
      scope: "email-verification-email",
      identifier: body.email,
      ipKey,
      limit: 5,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "이 이메일로 인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });

    const result = await requestEmailVerification({ email: body.email });

    return NextResponse.json({
      code: "AUTH_EMAIL_VERIFICATION_REQUEST_PREPARED",
      ...result,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        code: "AUTH_EMAIL_VERIFICATION_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "이메일 인증 링크를 생성하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthRateLimit,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";
import { registerUserAccount } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      password?: string;
    };

    if (!body.email || !body.displayName || !body.password) {
      return NextResponse.json(
        {
          code: "AUTH_SIGN_UP_FIELDS_REQUIRED",
          message: "닉네임, 이메일, 비밀번호를 입력해 주세요.",
          messageKey: "auth.signUpFieldsRequired",
        },
        { status: 400 },
      );
    }

    const ipKey = getRequestRateLimitKey(request.headers);
    await assertAuthRateLimit({
      scope: "sign-up-ip",
      identifier: ipKey,
      ipKey,
      limit: 5,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
    await assertAuthRateLimit({
      scope: "sign-up-email",
      identifier: body.email,
      ipKey,
      limit: 3,
      windowMinutes: 60,
      lockMinutes: 60,
      message: "이 이메일로 회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });

    const user = await registerUserAccount({
      email: body.email,
      displayName: body.displayName,
      password: body.password,
    });

    return NextResponse.json({
      code: "AUTH_SIGN_UP_VERIFICATION_SENT",
      message: "회원가입이 완료되었습니다. 이메일 인증 링크를 발송했습니다.",
      messageKey: "auth.signUpCompleted",
      role: user.role,
      verificationUrl: user.verificationUrl,
      verificationPending: user.verificationPending,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          messageKey: "auth.rateLimited",
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        code: "AUTH_SIGN_UP_FAILED",
        message: error instanceof Error ? error.message : "회원가입에 실패했습니다.",
        messageKey: "auth.signUpFailed",
      },
      { status: 400 },
    );
  }
}

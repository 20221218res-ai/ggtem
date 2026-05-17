import { NextRequest, NextResponse } from "next/server";
import { verifyAdminMfaChallenge } from "@/lib/auth/admin-mfa";
import {
  assertAuthRateLimit,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";
import { createSessionForVerifiedUserId } from "@/lib/auth/session";
import { getSignedInRedirectPath } from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      challengeToken?: string;
      code?: string;
    };

    const ipKey = getRequestRateLimitKey(request.headers);
    await assertAuthRateLimit({
      scope: "admin-mfa-confirm-ip",
      identifier: ipKey,
      ipKey,
      limit: 30,
      windowMinutes: 10,
      lockMinutes: 15,
      message: "Too many admin verification attempts. Please try again later.",
    });
    if (body.challengeToken) {
      await assertAuthRateLimit({
        scope: "admin-mfa-confirm-token",
        identifier: body.challengeToken,
        ipKey,
        limit: 8,
        windowMinutes: 10,
        lockMinutes: 15,
        message: "Too many attempts for this admin verification code. Please sign in again.",
      });
    }

    const verified = await verifyAdminMfaChallenge({
      challengeToken: body.challengeToken,
      code: body.code,
    });
    const user = await createSessionForVerifiedUserId(verified.userId);

    return NextResponse.json({
      code: "AUTH_ADMIN_MFA_SUCCESS",
      message: "관리자 인증이 완료되었습니다.",
      role: user.role,
      redirectPath: getSignedInRedirectPath(user),
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
        code: "AUTH_ADMIN_MFA_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "관리자 인증번호 확인에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

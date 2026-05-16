import { NextRequest, NextResponse } from "next/server";
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

    const result = await verifyEmailWithToken({ token: body.token });

    return NextResponse.json({
      code: "AUTH_EMAIL_VERIFICATION_COMPLETED",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "AUTH_EMAIL_VERIFICATION_FAILED",
        message: error instanceof Error ? error.message : "이메일 인증에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

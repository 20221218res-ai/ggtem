import { NextRequest, NextResponse } from "next/server";
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

    const result = await requestPasswordReset({ email: body.email });

    return NextResponse.json({
      code: "AUTH_PASSWORD_RESET_REQUEST_PREPARED",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "AUTH_PASSWORD_RESET_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "비밀번호 재설정 링크를 생성하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
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

    const result = await resetPasswordWithToken({
      token: body.token,
      password: body.password,
    });

    return NextResponse.json({
      code: "AUTH_PASSWORD_CHANGED",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "AUTH_PASSWORD_RESET_CONFIRM_FAILED",
        message: error instanceof Error ? error.message : "비밀번호를 재설정하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

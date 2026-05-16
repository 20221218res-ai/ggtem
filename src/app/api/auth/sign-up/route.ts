import { NextRequest, NextResponse } from "next/server";
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
        { code: "AUTH_SIGN_UP_FIELDS_REQUIRED", message: "닉네임, 이메일, 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const user = await registerUserAccount({
      email: body.email,
      displayName: body.displayName,
      password: body.password,
    });

    return NextResponse.json({
      code: "AUTH_SIGN_UP_VERIFICATION_SENT",
      message: "회원가입이 완료되었습니다. 이메일 인증 링크를 발송했습니다.",
      role: user.role,
      verificationUrl: user.verificationUrl,
      verificationPending: user.verificationPending,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "AUTH_SIGN_UP_FAILED",
        message: error instanceof Error ? error.message : "회원가입에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
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

    const result = await requestEmailVerification({ email: body.email });

    return NextResponse.json({
      code: "AUTH_EMAIL_VERIFICATION_REQUEST_PREPARED",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "AUTH_EMAIL_VERIFICATION_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "이메일 인증 링크를 생성하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

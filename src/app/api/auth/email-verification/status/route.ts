import { NextResponse } from "next/server";
import { getPendingEmailVerificationStatus } from "@/lib/auth/session";

export async function GET() {
  try {
    const status = await getPendingEmailVerificationStatus();
    return NextResponse.json(
      status.status === "blocked"
        ? { code: "AUTH_ACCOUNT_UNAVAILABLE", ...status }
        : status,
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        code: "AUTH_EMAIL_VERIFICATION_STATUS_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "이메일 인증 상태를 확인하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

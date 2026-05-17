import { NextRequest, NextResponse } from "next/server";
import { acceptAdminInviteWithToken } from "@/lib/admin/admin-accounts";
import {
  assertAuthRateLimit,
  getRequestRateLimitKey,
  RateLimitError,
} from "@/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
    };

    if (!body.token || !body.password) {
      return NextResponse.json(
        { message: "초대 토큰과 초기 비밀번호가 필요합니다." },
        { status: 400 },
      );
    }

    const ipKey = getRequestRateLimitKey(request.headers);
    await assertAuthRateLimit({
      scope: "admin-invite-accept-ip",
      identifier: ipKey,
      ipKey,
      limit: 10,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "관리자 초대 수락 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
    await assertAuthRateLimit({
      scope: "admin-invite-accept-token",
      identifier: body.token,
      ipKey,
      limit: 5,
      windowMinutes: 30,
      lockMinutes: 30,
      message: "관리자 초대 비밀번호 입력 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });

    const result = await acceptAdminInviteWithToken({
      token: body.token,
      password: body.password,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "관리자 초대를 수락하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

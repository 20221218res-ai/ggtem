import { NextRequest, NextResponse } from "next/server";
import { acceptAdminInviteWithToken } from "@/lib/admin/admin-accounts";

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

    const result = await acceptAdminInviteWithToken({
      token: body.token,
      password: body.password,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "관리자 초대를 수락하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

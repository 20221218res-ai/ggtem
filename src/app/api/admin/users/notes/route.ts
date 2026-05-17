import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";
import { createAdminUserNote } from "@/lib/admin/users";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      userId?: string;
      body?: string;
    };

    if (!body.userId || !body.body) {
      return NextResponse.json(
        {
          message: "유저 ID와 운영 메모 내용이 필요합니다.",
        },
        {
          status: 400,
        },
      );
    }

    await requireAdminActionGuard({
      request,
      adminId: auth.user.userId,
      action: "users:note",
      requirePassword: false,
      limit: 10,
    });

    const result = await createAdminUserNote({
      actorId: auth.user.userId,
      userId: body.userId,
      body: body.body,
    });

    return NextResponse.json(result);
  } catch (error) {
    const rateLimitResponse = getAdminActionErrorResponse(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "운영 메모를 추가하지 못했습니다.",
      },
      {
        status: 400,
      },
    );
  }
}

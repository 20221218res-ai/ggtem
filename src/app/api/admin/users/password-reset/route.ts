import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";
import { requestPasswordReset } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      userId?: string;
      reason?: string;
      adminPassword?: string;
    };
    const userId = body.userId?.trim();
    const reason = body.reason?.trim() ?? "";

    if (!userId) {
      return NextResponse.json(
        { message: "유저 ID가 필요합니다." },
        { status: 400 },
      );
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { message: "비밀번호 초기화 사유를 10자 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    await requireAdminActionGuard({
      request,
      adminId: auth.user.userId,
      action: "users:password-reset",
      adminPassword: body.adminPassword,
      limit: 3,
    });

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "유저를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (user.role === "SUPER" && auth.user.role !== "SUPER") {
      return NextResponse.json(
        { message: "최고관리자 계정은 최고관리자만 초기화할 수 있습니다." },
        { status: 403 },
      );
    }

    const reset = await requestPasswordReset({ email: user.email });

    await prisma.adminAuditLog.create({
      data: {
        adminId: auth.user.userId,
        action: "USER_PASSWORD_RESET_REQUESTED",
        targetType: "USER",
        targetId: user.id,
        reason,
        before: {
          email: user.email,
          role: user.role,
        },
        after: {
          emailSent: true,
          displayName: user.displayName,
        },
      },
    });

    return NextResponse.json({
      message: reset.message,
      resetUrl: reset.resetUrl,
    });
  } catch (error) {
    const rateLimitResponse = getAdminActionErrorResponse(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "비밀번호 초기화 메일을 발송하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

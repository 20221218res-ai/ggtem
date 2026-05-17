import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";
import {
  applySellerRiskRestriction,
  getAdminRiskState,
  resolveAdminRiskReport,
  restoreSellerSellingAccess,
} from "@/lib/admin/risk";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const state = await getAdminRiskState({
      status: request.nextUrl.searchParams.get("status"),
      severity: request.nextUrl.searchParams.get("severity"),
      query: request.nextUrl.searchParams.get("query"),
    });

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "위험 신고 목록을 불러오지 못했습니다.",
      },
      {
        status: 400,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      action?: string;
      userId?: string;
      reportId?: string;
      status?: string;
      severity?: string;
      targetStatus?: string;
      resolutionNote?: string;
      adminPassword?: string;
    };

    if (body.action === "APPLY_SELLING_RESTRICTION") {
      if (!body.userId) {
        return NextResponse.json(
          { message: "유저 ID가 필요합니다." },
          { status: 400 },
        );
      }

      await requireAdminActionGuard({
        request,
        adminId: auth.user.userId,
        action: "risk:apply-selling-restriction",
        adminPassword: body.adminPassword,
      });

      const result = await applySellerRiskRestriction({
        actorId: auth.user.userId,
        userId: body.userId,
        reason: body.resolutionNote,
      });

      return NextResponse.json(result);
    }

    if (body.action === "RESTORE_SELLING_ACCESS") {
      if (!body.userId) {
        return NextResponse.json(
          { message: "유저 ID가 필요합니다." },
          { status: 400 },
        );
      }

      await requireAdminActionGuard({
        request,
        adminId: auth.user.userId,
        action: "risk:restore-selling-access",
        adminPassword: body.adminPassword,
      });

      const result = await restoreSellerSellingAccess({
        actorId: auth.user.userId,
        userId: body.userId,
        reason: body.resolutionNote,
      });

      return NextResponse.json(result);
    }

    if (!body.reportId || !body.status) {
      return NextResponse.json(
        { message: "신고 ID와 상태가 필요합니다." },
        { status: 400 },
      );
    }

    await requireAdminActionGuard({
      request,
      adminId: auth.user.userId,
      action: "risk:resolve-report",
      requirePassword: false,
    });

    const result = await resolveAdminRiskReport({
      actorId: auth.user.userId,
      reportId: body.reportId,
      status: body.status,
      severity: body.severity,
      targetStatus: body.targetStatus,
      resolutionNote: body.resolutionNote,
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
          error instanceof Error ? error.message : "위험 신고 상태를 변경하지 못했습니다.",
      },
      {
        status: 400,
      },
    );
  }
}

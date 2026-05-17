import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";
import { getAdminFinanceState, processAdminFinanceAction } from "@/lib/admin/finance";

export async function GET() {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.FINANCE_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const state = await getAdminFinanceState();
    return NextResponse.json(state);
  } catch (error) {
    const rateLimitResponse = getAdminActionErrorResponse(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "관리자 재무 상태를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.FINANCE_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      kind?: "DEPOSIT" | "WITHDRAWAL";
      requestId?: string;
      action?:
        | "CONFIRM_DEPOSIT"
        | "REJECT_DEPOSIT"
        | "COMPLETE_WITHDRAWAL"
        | "REJECT_WITHDRAWAL";
      adminEvidence?: {
        txId?: string;
        memo?: string;
      };
      adminPassword?: string;
    };

    if (!body.kind || !body.requestId || !body.action) {
      return NextResponse.json(
        {
          message: "처리 유형, 요청 ID, 처리 작업이 필요합니다.",
        },
        { status: 400 },
      );
    }

    if (body.action === "COMPLETE_WITHDRAWAL" && auth.user.role !== "SUPER") {
      return NextResponse.json(
        { message: "출금 최종 완료는 최고 관리자만 처리할 수 있습니다." },
        { status: 403 },
      );
    }

    await requireAdminActionGuard({
      request,
      adminId: auth.user.userId,
      action: `finance:${body.action}`,
      adminPassword: body.adminPassword,
      limit: body.action === "COMPLETE_WITHDRAWAL" ? 3 : 5,
    });

    const result = await processAdminFinanceAction({
      kind: body.kind,
      requestId: body.requestId,
      action: body.action,
      adminId: auth.user.userId,
      adminEvidence: body.adminEvidence,
    });

    return NextResponse.json(result);
  } catch (error) {
    const rateLimitResponse = getAdminActionErrorResponse(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "재무 처리 요청을 완료하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

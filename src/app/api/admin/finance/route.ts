import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
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
    };

    if (!body.kind || !body.requestId || !body.action) {
      return NextResponse.json(
        {
          message: "처리 유형, 요청 ID, 처리 작업이 필요합니다.",
        },
        { status: 400 },
      );
    }

    const result = await processAdminFinanceAction({
      kind: body.kind,
      requestId: body.requestId,
      action: body.action,
      adminId: auth.user.userId,
      adminEvidence: body.adminEvidence,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "재무 처리 요청을 완료하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

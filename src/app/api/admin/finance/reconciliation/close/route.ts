import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { createAdminFinanceCloseReport } from "@/lib/admin/finance";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.FINANCE_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      range?: string;
      note?: string;
    };
    const result = await createAdminFinanceCloseReport({
      actorId: auth.user.userId,
      range: body.range,
      note: body.note,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "재무 마감 리포트를 저장하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { createTrustReport } from "@/lib/risk/trust-reports";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      orderId?: string;
      category?: string;
      description?: string;
    };

    if (!body.orderId || !body.category || !body.description) {
      return NextResponse.json(
        {
          message: "주문, 신고 유형, 신고 내용을 모두 입력해 주세요.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await createTrustReport({
      orderId: body.orderId,
      category: body.category,
      description: body.description,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "신고 접수에 실패했습니다.",
      },
      {
        status: 400,
      },
    );
  }
}

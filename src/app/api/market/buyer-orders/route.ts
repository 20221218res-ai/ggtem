import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { verifyCurrentUserPassword } from "@/lib/auth/session";
import { updateMarketplaceBuyerOrderStatus } from "@/lib/market/my-orders";

type BuyerOrderActionBody = {
  orderId?: string;
  action?: "CANCEL_ORDER" | "CONFIRM_DELIVERY" | "REPORT_PROBLEM";
  reason?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as BuyerOrderActionBody;

    if (!body.orderId || !body.action) {
      return NextResponse.json(
        { message: "주문 정보와 처리할 작업이 필요합니다." },
        { status: 400 },
      );
    }

    if (body.action === "CONFIRM_DELIVERY") {
      if (!body.password) {
        return NextResponse.json(
          { message: "결제 비밀번호를 입력해 주세요." },
          { status: 400 },
        );
      }

      const passwordOk = await verifyCurrentUserPassword({
        userId: auth.user.userId,
        password: body.password,
      });

      if (!passwordOk) {
        return NextResponse.json(
          { message: "결제 비밀번호가 일치하지 않습니다." },
          { status: 403 },
        );
      }
    }

    const result = await updateMarketplaceBuyerOrderStatus({
      orderId: body.orderId,
      action: body.action,
      reason: body.reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "구매 주문 상태 변경에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

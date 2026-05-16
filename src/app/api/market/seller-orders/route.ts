import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { updateMarketplaceSellerOrderStatus } from "@/lib/market/my-listings";

type SellerOrderActionBody = {
  orderId?: string;
  action?: "START_DELIVERY" | "MARK_DELIVERED" | "REQUEST_BUYER_CONFIRM";
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as SellerOrderActionBody;

    if (!body.orderId || !body.action) {
      return NextResponse.json(
        {
          message: "판매 주문 정보와 처리할 작업이 필요합니다.",
          messageKey: "orderManage.actionInfoRequired",
        },
        { status: 400 },
      );
    }

    const result = await updateMarketplaceSellerOrderStatus({
      orderId: body.orderId,
      action: body.action,
    });

    return NextResponse.json({
      ...result,
      messageKey: getSellerActionMessageKey(body.action),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "판매 주문 상태 변경에 실패했습니다.",
        messageKey: "orderManage.updateFailed",
      },
      { status: 400 },
    );
  }
}

function getSellerActionMessageKey(action: SellerOrderActionBody["action"]) {
  if (action === "START_DELIVERY") return "orderManage.startDeliverySuccess";
  if (action === "MARK_DELIVERED") return "orderManage.markDeliveredSuccess";
  if (action === "REQUEST_BUYER_CONFIRM") return "orderManage.requestConfirmSuccess";
  return "common.confirm";
}

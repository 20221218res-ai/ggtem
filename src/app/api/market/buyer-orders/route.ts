import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { verifyCurrentUserPaymentPin } from "@/lib/auth/payment-pin";
import { updateMarketplaceBuyerOrderStatus } from "@/lib/market/my-orders";

type BuyerOrderActionBody = {
  orderId?: string;
  action?: "CANCEL_ORDER" | "CONFIRM_DELIVERY" | "REPORT_PROBLEM";
  reason?: string;
  password?: string;
  paymentPin?: string;
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
        {
          message: "주문 정보와 처리할 작업이 필요합니다.",
          messageKey: "orderManage.actionInfoRequired",
        },
        { status: 400 },
      );
    }

    if (body.action === "CONFIRM_DELIVERY") {
      const pinCheck = await verifyCurrentUserPaymentPin({
        userId: auth.user.userId,
        paymentPin: body.paymentPin ?? body.password,
      });

      if (!pinCheck.ok) {
        return NextResponse.json(
          {
            code: pinCheck.code,
            message: pinCheck.message,
            messageKey: getPaymentPinErrorKey(pinCheck.code),
          },
          { status: pinCheck.status },
        );
      }
    }

    const result = await updateMarketplaceBuyerOrderStatus({
      orderId: body.orderId,
      action: body.action,
      reason: body.reason,
    });

    return NextResponse.json({
      ...result,
      messageKey: getBuyerActionMessageKey(body.action),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "구매 주문 상태 변경에 실패했습니다.",
        messageKey: "orderManage.updateFailed",
      },
      { status: 400 },
    );
  }
}

function getBuyerActionMessageKey(action: BuyerOrderActionBody["action"]) {
  if (action === "CANCEL_ORDER") return "orderManage.cancelSuccess";
  if (action === "CONFIRM_DELIVERY") return "orderManage.confirmSuccess";
  if (action === "REPORT_PROBLEM") return "orderManage.disputeSuccess";
  return "common.confirm";
}

function getPaymentPinErrorKey(code: string) {
  if (code === "PAYMENT_PIN_NOT_SET") return "tradeSafety.paymentPinMissing";
  if (code === "PAYMENT_PIN_INVALID_FORMAT") return "tradeSafety.paymentPinInvalid";
  if (code === "PAYMENT_PIN_MISMATCH") return "tradeSafety.paymentPinStatusError";
  return "tradeSafety.paymentPinStatusError";
}

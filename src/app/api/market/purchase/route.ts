import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { verifyCurrentUserPaymentPin } from "@/lib/auth/payment-pin";
import { purchaseMarketplaceListing } from "@/lib/market/listings";

type PurchaseRequestBody = {
  listingId?: string;
  quantity?: string;
  amount?: string;
  password?: string;
  paymentPin?: string;
  characterName?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as PurchaseRequestBody;

    if (!body.listingId || !body.quantity) {
      return NextResponse.json(
        { message: "구매할 매물과 수량 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const pinCheck = await verifyCurrentUserPaymentPin({
      userId: auth.user.userId,
      paymentPin: body.paymentPin ?? body.password,
    });

    if (!pinCheck.ok) {
      return NextResponse.json(
        { code: pinCheck.code, message: pinCheck.message },
        { status: pinCheck.status },
      );
    }

    const result = await purchaseMarketplaceListing({
      listingId: body.listingId,
      quantity: body.quantity,
      amount: body.amount,
      tradeCharacterName: body.characterName,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "구매 주문 생성에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

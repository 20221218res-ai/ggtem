import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { verifyCurrentUserPassword } from "@/lib/auth/session";
import { purchaseMarketplaceListing } from "@/lib/market/listings";

type PurchaseRequestBody = {
  listingId?: string;
  quantity?: string;
  amount?: string;
  password?: string;
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

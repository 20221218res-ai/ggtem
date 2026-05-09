import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { sellToMarketplaceBuyRequest } from "@/lib/market/buy-requests";

type InstantSaleRequestBody = {
  buyRequestId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as InstantSaleRequestBody;

    if (!body.buyRequestId) {
      return NextResponse.json(
        { message: "즉시판매할 구매요청 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await sellToMarketplaceBuyRequest({
      buyRequestId: body.buyRequestId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "즉시판매 주문 생성에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import {
  cancelMarketplaceBuyRequest,
  createMarketplaceBuyRequest,
} from "@/lib/market/buy-requests";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      mode?: "CREATE" | "CANCEL";
      buyRequestId?: string;
      gameId?: string;
      serverId?: string;
      serverDetail?: string;
      category?: "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
      title?: string;
      description?: string;
      accountTransferType?: string;
      accountRank?: string;
      quantity?: string;
      unitPrice?: string;
      pricePerUnit?: string;
      priceUnitQuantity?: string;
      tradeMode?: "BULK" | "SPLIT";
      minimumQuantity?: string;
      expiresInDays?: number;
      premiumDurationHours?: number;
    };

    if (body.mode === "CANCEL") {
      if (!body.buyRequestId) {
        return NextResponse.json(
          { message: "취소할 구매요청 정보가 필요합니다." },
          { status: 400 },
        );
      }

      const result = await cancelMarketplaceBuyRequest({
        buyRequestId: body.buyRequestId,
      });

      return NextResponse.json(result);
    }

    if (
      !body.gameId ||
      !body.serverId ||
      !body.category ||
      !body.quantity ||
      !body.unitPrice
    ) {
      return NextResponse.json(
        { message: "게임, 서버, 품목 유형, 수량, 단가를 모두 입력해 주세요." },
        { status: 400 },
      );
    }

    const result = await createMarketplaceBuyRequest({
      gameId: body.gameId,
      serverId: body.serverId,
      serverDetail: body.serverDetail,
      category: body.category,
      title: body.title,
      description: body.description,
      accountTransferType: body.accountTransferType,
      accountRank: body.accountRank,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      pricePerUnit: body.pricePerUnit,
      priceUnitQuantity: body.priceUnitQuantity,
      tradeMode: body.tradeMode,
      minimumQuantity: body.minimumQuantity,
      expiresInDays: body.expiresInDays,
      premiumDurationHours: body.premiumDurationHours,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "구매요청을 처리하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

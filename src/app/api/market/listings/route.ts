import { NextRequest, NextResponse } from "next/server";
import { requireAccountCapability, requireApiRole } from "@/lib/auth/guards";
import { createMarketplaceSellerListing } from "@/lib/market/my-listings";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const capabilityError = requireAccountCapability(auth.user, "SELLING");
    if (capabilityError) {
      return capabilityError;
    }

    const body = (await request.json()) as {
      gameId?: string;
      serverId?: string;
      serverDetail?: string;
      category?: "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
      accountTransferType?: string;
      title?: string;
      description?: string;
      unitPrice?: string;
      pricePerUnit?: string;
      priceUnitQuantity?: string;
      tradeMode?: "BULK" | "SPLIT";
      quantity?: string;
      minimumQuantity?: string;
      premiumDurationHours?: number;
    };

    if (
      !body.gameId ||
      !body.serverId ||
      !body.category ||
      !body.title ||
      !body.unitPrice ||
      !body.quantity
    ) {
      return NextResponse.json(
        { message: "게임, 서버, 품목 유형, 제목, 단가, 수량을 모두 입력해 주세요." },
        { status: 400 },
      );
    }

    const result = await createMarketplaceSellerListing({
      gameId: body.gameId,
      serverId: body.serverId,
      serverDetail: body.serverDetail,
      category: body.category,
      accountTransferType: body.accountTransferType,
      title: body.title,
      description: body.description,
      unitPrice: body.unitPrice,
      pricePerUnit: body.pricePerUnit,
      priceUnitQuantity: body.priceUnitQuantity,
      tradeMode: body.tradeMode,
      quantity: body.quantity,
      minimumQuantity: body.minimumQuantity,
      premiumDurationHours: body.premiumDurationHours,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "판매글을 등록하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

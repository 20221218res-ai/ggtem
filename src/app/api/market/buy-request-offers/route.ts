import { NextRequest, NextResponse } from "next/server";
import { requireAccountCapability, requireApiRole } from "@/lib/auth/guards";
import {
  createMarketplaceBuyRequestOffer,
  updateMarketplaceBuyRequestOfferStatus,
} from "@/lib/market/buy-requests";

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
      buyRequestId?: string;
      listingId?: string;
      quantity?: string;
      unitPrice?: string;
      message?: string;
    };

    if (!body.buyRequestId || !body.quantity || !body.unitPrice) {
      return NextResponse.json(
        { message: "구매요청, 수량, 단가 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await createMarketplaceBuyRequestOffer({
      buyRequestId: body.buyRequestId,
      listingId: body.listingId,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      message: body.message,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "판매 제안을 등록하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      offerId?: string;
      action?: "ACCEPT" | "REJECT";
    };

    if (!body.offerId || !body.action) {
      return NextResponse.json(
        {
          message: "처리할 판매 제안과 작업 정보가 필요합니다.",
          messageKey: "offerAction.required",
        },
        { status: 400 },
      );
    }

    if (!["ACCEPT", "REJECT"].includes(body.action)) {
      return NextResponse.json(
        {
          message: "제안 작업은 수락 또는 거절만 가능합니다.",
          messageKey: "offerAction.unsupportedAction",
        },
        { status: 400 },
      );
    }

    const result = await updateMarketplaceBuyRequestOfferStatus({
      offerId: body.offerId,
      action: body.action,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "판매 제안 상태를 변경하지 못했습니다.",
        messageKey: "offerAction.statusFailed",
      },
      { status: 400 },
    );
  }
}

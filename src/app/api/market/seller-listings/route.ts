import { NextRequest, NextResponse } from "next/server";
import { requireAccountCapability, requireApiRole } from "@/lib/auth/guards";
import {
  duplicateMarketplaceSellerListing,
  updateMarketplaceSellerListing,
  updateMarketplaceSellerListingStatus,
} from "@/lib/market/my-listings";

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
      mode?: "UPDATE" | "STATUS" | "DUPLICATE";
      listingId?: string;
      title?: string;
      description?: string;
      unitPrice?: string;
      totalQuantity?: string;
      action?: "PAUSE" | "RESUME" | "HIDE";
    };

    if (body.mode === "STATUS") {
      if (!body.listingId || !body.action) {
        return NextResponse.json(
          { message: "판매글 정보와 처리할 작업이 필요합니다." },
          { status: 400 },
        );
      }

      const result = await updateMarketplaceSellerListingStatus({
        listingId: body.listingId,
        action: body.action,
      });

      return NextResponse.json(result);
    }

    if (body.mode === "DUPLICATE") {
      if (!body.listingId) {
        return NextResponse.json(
          { message: "복사할 판매글 정보가 필요합니다." },
          { status: 400 },
        );
      }

      const result = await duplicateMarketplaceSellerListing({
        listingId: body.listingId,
      });

      return NextResponse.json(result);
    }

    if (
      !body.listingId ||
      !body.title ||
      !body.unitPrice ||
      !body.totalQuantity
    ) {
      return NextResponse.json(
        {
          message:
            "판매글, 제목, 단가, 총 수량을 모두 입력해 주세요.",
        },
        { status: 400 },
      );
    }

    const result = await updateMarketplaceSellerListing({
      listingId: body.listingId,
      title: body.title,
      description: body.description,
      unitPrice: body.unitPrice,
      totalQuantity: body.totalQuantity,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "판매글을 수정하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

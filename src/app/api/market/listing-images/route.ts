import { NextRequest, NextResponse } from "next/server";
import { requireAccountCapability, requireApiRole } from "@/lib/auth/guards";
import {
  removeMarketplaceSellerListingImage,
  uploadMarketplaceSellerListingImage,
} from "@/lib/market/my-listings";

export const runtime = "nodejs";

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

    const formData = await request.formData();
    const listingId = String(formData.get("listingId") ?? "").trim();
    const altText = String(formData.get("altText") ?? "").trim();
    const image = formData.get("image");

    if (!listingId) {
      return NextResponse.json(
        { message: "이미지를 등록할 판매글 정보가 필요합니다." },
        { status: 400 },
      );
    }

    if (!(image instanceof File)) {
      return NextResponse.json(
        { message: "업로드할 이미지 파일을 선택해 주세요." },
        { status: 400 },
      );
    }

    const result = await uploadMarketplaceSellerListingImage({
      listingId,
      fileName: image.name,
      contentType: image.type,
      bytes: new Uint8Array(await image.arrayBuffer()),
      altText,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "판매글 이미지를 업로드하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const capabilityError = requireAccountCapability(auth.user, "SELLING");
    if (capabilityError) {
      return capabilityError;
    }

    const searchParams = request.nextUrl.searchParams;
    const listingId = String(searchParams.get("listingId") ?? "").trim();

    if (!listingId) {
      return NextResponse.json(
        { message: "이미지를 삭제할 판매글 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await removeMarketplaceSellerListingImage({ listingId });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "판매글 이미지를 삭제하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

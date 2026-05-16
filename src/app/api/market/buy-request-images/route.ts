import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import {
  removeMarketplaceBuyRequestImage,
  uploadMarketplaceBuyRequestImage,
} from "@/lib/market/buy-request-images";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const formData = await request.formData();
    const buyRequestId = String(formData.get("buyRequestId") ?? "").trim();
    const altText = String(formData.get("altText") ?? "").trim();
    const image = formData.get("image");

    if (!buyRequestId) {
      return NextResponse.json(
        {
          message: "이미지를 추가할 구매글 정보가 필요합니다.",
          messageKey: "listingEdit.imageListingRequired",
        },
        { status: 400 },
      );
    }

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          message: "업로드할 이미지 파일을 선택해 주세요.",
          messageKey: "listingEdit.imageRequired",
        },
        { status: 400 },
      );
    }

    const result = await uploadMarketplaceBuyRequestImage({
      buyRequestId,
      fileName: image.name,
      contentType: image.type,
      bytes: new Uint8Array(await image.arrayBuffer()),
      altText,
    });

    return NextResponse.json({
      ...result,
      messageKey: "listingEdit.imageSaveSuccess",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "구매글 이미지를 업로드하지 못했습니다.",
        messageKey: "listingForm.imageUploadFailed",
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

    const searchParams = request.nextUrl.searchParams;
    const buyRequestId = String(searchParams.get("buyRequestId") ?? "").trim();
    const imageId = String(searchParams.get("imageId") ?? "").trim();

    if (!buyRequestId || !imageId) {
      return NextResponse.json(
        {
          message: "이미지를 삭제할 구매글과 이미지 정보가 필요합니다.",
          messageKey: "listingEdit.imageListingRequired",
        },
        { status: 400 },
      );
    }

    const result = await removeMarketplaceBuyRequestImage({
      buyRequestId,
      imageId,
    });

    return NextResponse.json({
      ...result,
      messageKey: "listingEdit.imageRemoveSuccess",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "구매글 이미지를 삭제하지 못했습니다.",
        messageKey: "listingEdit.imageRemoveFailed",
      },
      { status: 400 },
    );
  }
}

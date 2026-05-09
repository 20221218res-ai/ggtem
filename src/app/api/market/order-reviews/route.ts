import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { createOrderReview } from "@/lib/market/order-reviews";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      orderId?: string;
      rating?: number;
      comment?: string;
    };

    if (!body.orderId || body.rating === undefined) {
      return NextResponse.json(
        {
          message: "주문 정보와 평점이 필요합니다.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await createOrderReview({
      orderId: body.orderId,
      rating: body.rating,
      comment: body.comment,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "리뷰를 등록하지 못했습니다.",
      },
      {
        status: 400,
      },
    );
  }
}

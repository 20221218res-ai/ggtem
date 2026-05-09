import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { isDemoToolEnabled } from "@/lib/demo-mode";
import {
  cancelTradeDemoOrder,
  completeTradeDemoOrder,
  createTradeDemoListing,
  getTradeDemoState,
  purchaseTradeDemoListing,
} from "@/lib/admin/trade-demo";

type TradeDemoRequestBody =
  | {
      action?: "CREATE_LISTING";
      title?: string;
      quantity?: string;
      amount?: string;
    }
    | {
      action?: "PURCHASE";
      listingId?: string;
      quantity?: string;
      amount?: string;
    }
  | {
      action?: "CANCEL_ORDER" | "COMPLETE_ORDER";
      orderId?: string;
    };

export async function GET() {
  if (!isDemoToolEnabled()) {
    return NextResponse.json({ message: "Demo tools are disabled." }, { status: 404 });
  }

  const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
  if (!auth.ok) {
    return auth.response;
  }

  const state = await getTradeDemoState();
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  try {
    if (!isDemoToolEnabled()) {
      return NextResponse.json({ message: "Demo tools are disabled." }, { status: 404 });
    }

    const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as TradeDemoRequestBody;

    if (body.action === "CREATE_LISTING") {
      if (!body.title || !body.quantity || !body.amount) {
        return NextResponse.json(
          { message: "데모 매물 생성에는 제목, 수량, 금액이 필요합니다." },
          { status: 400 },
        );
      }

      const state = await createTradeDemoListing({
        title: body.title,
        quantity: body.quantity,
        amount: body.amount,
      });

      return NextResponse.json(state);
    }

    if (body.action === "PURCHASE") {
      if (!body.listingId || !body.quantity || !body.amount) {
        return NextResponse.json(
          { message: "데모 구매에는 매물 ID, 수량, 금액이 필요합니다." },
          { status: 400 },
        );
      }

      const state = await purchaseTradeDemoListing({
        listingId: body.listingId,
        quantity: body.quantity,
        amount: body.amount,
      });

      return NextResponse.json(state);
    }

    if (body.action === "CANCEL_ORDER") {
      if (!body.orderId) {
        return NextResponse.json(
          { message: "데모 주문 취소에는 주문 ID가 필요합니다." },
          { status: 400 },
        );
      }

      const state = await cancelTradeDemoOrder({
        orderId: body.orderId,
      });

      return NextResponse.json(state);
    }

    if (body.action === "COMPLETE_ORDER") {
      if (!body.orderId) {
        return NextResponse.json(
          { message: "데모 주문 완료에는 주문 ID가 필요합니다." },
          { status: 400 },
        );
      }

      const state = await completeTradeDemoOrder({
        orderId: body.orderId,
      });

      return NextResponse.json(state);
    }

    return NextResponse.json(
      { message: "지원하지 않는 작업입니다." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "거래 데모 처리에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

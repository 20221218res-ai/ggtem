import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { sendOrderChatMessage } from "@/lib/chat/order-chat";

type OrderChatBody = {
  orderId?: string;
  body?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "SELLER"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as OrderChatBody;

    if (!body.orderId || !body.body) {
      return NextResponse.json(
        { message: "주문 정보와 메시지 내용이 필요합니다." },
        { status: 400 },
      );
    }

    const result = await sendOrderChatMessage({
      orderId: body.orderId,
      body: body.body,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "주문 채팅 메시지를 보내지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

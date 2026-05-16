import { NextRequest, NextResponse } from "next/server";
import {
  getOrderAccountCredentialView,
  submitOrderAccountCredential,
} from "@/lib/market/order-account-credentials";

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
    const reveal = request.nextUrl.searchParams.get("reveal") === "1";

    if (!orderId) {
      return NextResponse.json(
        {
          message: "주문 ID가 필요합니다.",
          messageKey: "accountCredential.orderRequired",
        },
        { status: 400 },
      );
    }

    const view = await getOrderAccountCredentialView({ orderId, reveal });
    return NextResponse.json(view);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "계정 전달 정보를 확인하지 못했습니다.",
        messageKey: "accountCredential.loadFailed",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      accountId?: string;
      password?: string;
      note?: string | null;
    };

    if (!body.orderId || !body.accountId || !body.password) {
      return NextResponse.json(
        {
          message: "주문 ID, 계정, 비밀번호를 모두 입력해 주세요.",
          messageKey: "accountCredential.submitRequired",
        },
        { status: 400 },
      );
    }

    const result = await submitOrderAccountCredential({
      orderId: body.orderId,
      accountId: body.accountId,
      password: body.password,
      note: body.note ?? null,
    });

    return NextResponse.json({
      ...result,
      messageKey: "accountCredential.saveSuccess",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "계정 전달 정보를 저장하지 못했습니다.",
        messageKey: "accountCredential.saveFailed",
      },
      { status: 400 },
    );
  }
}

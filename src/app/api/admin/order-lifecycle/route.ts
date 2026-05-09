import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import { isDemoToolEnabled } from "@/lib/demo-mode";
import {
  getOrderLifecycleRepository,
  type OrderLifecycleAction,
} from "@/lib/orders/order-lifecycle-repository";

type OrderLifecycleRequestBody = {
  action?: "LOCK" | "CANCEL" | "COMPLETE" | "RESET";
  quantity?: string;
  amount?: string;
};

export async function GET() {
  if (!isDemoToolEnabled()) {
    return NextResponse.json({ message: "Demo tools are disabled." }, { status: 404 });
  }

  const auth = await requireApiRole(ROLE_GROUPS.PLATFORM_ADMINS);
  if (!auth.ok) {
    return auth.response;
  }

  const repository = getOrderLifecycleRepository();
  const state = await repository.getState();

  return NextResponse.json({
    ...state,
    storageMode: repository.getStorageMode(),
  });
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

    const repository = getOrderLifecycleRepository();
    const body = (await request.json()) as OrderLifecycleRequestBody;

    if (!body.action) {
      return NextResponse.json(
        { message: "처리 작업이 필요합니다." },
        { status: 400 },
      );
    }

    if (body.action === "LOCK") {
      if (!body.quantity || !body.amount) {
        return NextResponse.json(
          { message: "잠금 작업에는 수량과 금액이 필요합니다." },
          { status: 400 },
        );
      }

      const nextState = await repository.applyAction({
          type: "LOCK",
          quantity: body.quantity,
          amount: body.amount,
      });

      return NextResponse.json({
        ...nextState,
        storageMode: repository.getStorageMode(),
      });
    }

    if (body.action === "CANCEL") {
      const nextState = await repository.applyAction({
        type: "CANCEL",
      } satisfies OrderLifecycleAction);

      return NextResponse.json({
        ...nextState,
        storageMode: repository.getStorageMode(),
      });
    }

    if (body.action === "COMPLETE") {
      const nextState = await repository.applyAction({
        type: "COMPLETE",
      } satisfies OrderLifecycleAction);

      return NextResponse.json({
        ...nextState,
        storageMode: repository.getStorageMode(),
      });
    }

    if (body.action === "RESET") {
      const nextState = await repository.applyAction({
        type: "RESET",
      } satisfies OrderLifecycleAction);

      return NextResponse.json({
        ...nextState,
        storageMode: repository.getStorageMode(),
      });
    }

    return NextResponse.json(
      { message: "지원하지 않는 작업입니다." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "주문 라이프사이클 API 처리에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}

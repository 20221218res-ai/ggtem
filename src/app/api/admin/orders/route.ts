import { NextRequest, NextResponse } from "next/server";
import { getAdminOrdersState, resolveAdminDispute } from "@/lib/admin/orders";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const orderId = request.nextUrl.searchParams.get("orderId");
    const status = request.nextUrl.searchParams.get("status");
    const query = request.nextUrl.searchParams.get("query");
    const state = await getAdminOrdersState(orderId, {
      status,
      query,
    });
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "\uC8FC\uBB38 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      },
      { status: 400 },
    );
  }
}

type AdminOrderActionBody = {
  orderId?: string;
  action?: "REFUND_BUYER" | "RELEASE_TO_SELLER";
  note?: string;
  adminPassword?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as AdminOrderActionBody;

    if (!body.orderId || !body.action) {
      return NextResponse.json(
        {
          message: "\uAD00\uB9AC\uC790 \uC8FC\uBB38 \uCC98\uB9AC\uB97C \uC704\uD574 \uC8FC\uBB38 ID\uC640 \uCC98\uB9AC \uC791\uC5C5\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
        },
        { status: 400 },
      );
    }

    await requireAdminActionGuard({
      request,
      adminId: auth.user.userId,
      action: `orders:${body.action}`,
      adminPassword: body.adminPassword,
      limit: 3,
    });

    const result = await resolveAdminDispute({
      orderId: body.orderId,
      action: body.action,
      note: body.note,
      adminId: auth.user.userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const rateLimitResponse = getAdminActionErrorResponse(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "\uC8FC\uBB38 \uC0C1\uD0DC\uB97C \uBCC0\uACBD\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      },
      { status: 400 },
    );
  }
}

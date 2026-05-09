import { NextRequest, NextResponse } from "next/server";
import { getAdminDisputesState } from "@/lib/admin/orders";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const orderId = request.nextUrl.searchParams.get("orderId");
    const view = request.nextUrl.searchParams.get("view");
    const query = request.nextUrl.searchParams.get("query");
    const state = await getAdminDisputesState(orderId, {
      view,
      query,
    });

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "\uBD84\uC7C1 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      },
      { status: 400 },
    );
  }
}

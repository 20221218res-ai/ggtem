import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  getPaymentPinStatus,
  setCurrentUserPaymentPin,
} from "@/lib/auth/payment-pin";

export async function GET() {
  const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);
  if (!auth.ok) {
    return auth.response;
  }

  const status = await getPaymentPinStatus(auth.user.userId);
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(ROLE_GROUPS.MARKET_USERS);
  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json()) as {
    paymentPin?: string;
    currentPaymentPin?: string;
  };

  const result = await setCurrentUserPaymentPin({
    userId: auth.user.userId,
    paymentPin: body.paymentPin,
    currentPaymentPin: body.currentPaymentPin,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result);
}

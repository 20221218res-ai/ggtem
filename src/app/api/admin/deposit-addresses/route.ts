import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import {
  getAdminActionErrorResponse,
  requireAdminActionGuard,
} from "@/lib/auth/admin-action-guard";
import { updateDepositWalletAddress } from "@/lib/wallet/deposit-address-admin";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["SUPER"]);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const adminPassword = String(payload.adminPassword ?? "");
    await requireAdminActionGuard({
      request,
      adminId: auth.user.userId,
      action: "deposit-addresses:update",
      adminPassword,
      limit: 3,
    });

    const updated = await updateDepositWalletAddress({
      adminUserId: auth.user.userId,
      chain: String(payload.chain ?? ""),
      label: String(payload.label ?? ""),
      asset: String(payload.asset ?? "USDT"),
      networkName: String(payload.networkName ?? ""),
      address: String(payload.address ?? ""),
      minimumAmount: String(payload.minimumAmount ?? ""),
      reason: String(payload.reason ?? ""),
      adminPassword,
      isActive: Boolean(payload.isActive),
    });

    return NextResponse.json({
      message: "입금 주소 설정을 저장했습니다.",
      address: updated,
    });
  } catch (error) {
    const rateLimitResponse = getAdminActionErrorResponse(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "입금 주소 저장에 실패했습니다." },
      { status: 400 },
    );
  }
}

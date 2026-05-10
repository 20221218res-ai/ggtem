import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { updateDepositWalletAddress } from "@/lib/wallet/deposit-address-admin";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["SUPER"]);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = await request.json();
    const updated = await updateDepositWalletAddress({
      adminUserId: auth.user.userId,
      chain: String(payload.chain ?? ""),
      label: String(payload.label ?? ""),
      asset: String(payload.asset ?? "USDT"),
      networkName: String(payload.networkName ?? ""),
      address: String(payload.address ?? ""),
      minimumAmount: String(payload.minimumAmount ?? ""),
      reason: String(payload.reason ?? ""),
      adminPassword: String(payload.adminPassword ?? ""),
      isActive: Boolean(payload.isActive),
    });

    return NextResponse.json({
      message: "입금 주소 설정이 저장되었습니다.",
      address: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "입금 주소 저장에 실패했습니다." },
      { status: 400 },
    );
  }
}

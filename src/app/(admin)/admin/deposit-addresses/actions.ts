"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type WithdrawalChain } from "@/generated/prisma/client";
import { requirePageRole } from "@/lib/auth/guards";
import { verifyCurrentUserPassword } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { DEFAULT_DEPOSIT_WALLET_ADDRESSES } from "@/lib/wallet/deposit-address-defaults";

export async function updateDepositWalletAddressAction(formData: FormData) {
  const admin = await requirePageRole(["SUPER"], {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  const chain = parseChain(getText(formData, "chain"));
  const defaults = chain ? DEFAULT_DEPOSIT_WALLET_ADDRESSES[chain] : null;
  const label = getText(formData, "label") || defaults?.label || "";
  const asset = getText(formData, "asset") || defaults?.asset || "USDT";
  const networkName = getText(formData, "networkName") || defaults?.networkName || "";
  const address = getText(formData, "address");
  const minimumAmount = getText(formData, "minimumAmount") || defaults?.minimumAmount || "10";
  const reason = getText(formData, "reason");
  const adminPassword = getText(formData, "adminPassword");
  const isActive = formData.get("isActive") === "on";

  if (!chain || !label || !networkName || !address) {
    redirectWithError("체인, 이름, 네트워크, 입금 주소를 모두 입력해 주세요.");
  }

  if (!/^\d+(\.\d+)?$/.test(minimumAmount) || Number(minimumAmount) <= 0) {
    redirectWithError("최소 입금액은 0보다 큰 숫자로 입력해 주세요.");
  }

  const addressError = validateAddressForChain(chain, address);
  if (addressError) {
    redirectWithError(addressError);
  }

  if (reason.length < 10) {
    redirectWithError("변경 사유를 10자 이상 입력해 주세요.");
  }

  if (!adminPassword) {
    redirectWithError("최고관리자 비밀번호를 입력해야 주소를 변경할 수 있습니다.");
  }

  const passwordOk = await verifyCurrentUserPassword({
    userId: admin.userId,
    password: adminPassword,
  });

  if (!passwordOk) {
    redirectWithError("비밀번호가 일치하지 않습니다.");
  }

  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    const before = await tx.depositWalletAddress.findUnique({
      where: { chain },
    });

    const updated = await tx.depositWalletAddress.upsert({
      where: { chain },
      create: {
        chain,
        label,
        asset,
        networkName,
        address,
        minimumAmount,
        isActive,
        sortOrder: defaults?.sortOrder ?? (chain === "TRC20" ? 10 : 20),
        updatedByAdminId: admin.userId,
      },
      update: {
        label,
        asset,
        networkName,
        address,
        minimumAmount,
        isActive,
        updatedByAdminId: admin.userId,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: admin.userId,
        action: before ? "DEPOSIT_ADDRESS_UPDATED" : "DEPOSIT_ADDRESS_CREATED",
        targetType: "DEPOSIT_WALLET_ADDRESS",
        targetId: updated.id,
        reason,
        before: before
          ? {
              chain: before.chain,
              label: before.label,
              asset: before.asset,
              networkName: before.networkName,
              address: maskAddress(before.address),
              minimumAmount: before.minimumAmount.toString(),
              isActive: before.isActive,
            }
          : Prisma.JsonNull,
        after: {
          chain: updated.chain,
          label: updated.label,
          asset: updated.asset,
          networkName: updated.networkName,
          address: maskAddress(updated.address),
          minimumAmount: updated.minimumAmount.toString(),
          isActive: updated.isActive,
          passwordRechecked: true,
        },
      },
    });
  });

  revalidatePath("/admin/deposit-addresses");
  revalidatePath("/my/wallet");
  redirect(`/admin/deposit-addresses?notice=${chain.toLowerCase()}-updated`);
}

function parseChain(value: string): WithdrawalChain | null {
  if (value === "TRC20" || value === "BEP20") {
    return value;
  }

  return null;
}

function validateAddressForChain(chain: WithdrawalChain, address: string) {
  if (chain === "TRC20" && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return "TRC20 주소는 T로 시작하는 34자리 주소여야 합니다.";
  }

  if (chain === "BEP20" && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return "BEP20 주소는 0x로 시작하는 42자리 주소여야 합니다.";
  }

  return null;
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithError(message: string): never {
  redirect(`/admin/deposit-addresses?error=${encodeURIComponent(message)}`);
}

function maskAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

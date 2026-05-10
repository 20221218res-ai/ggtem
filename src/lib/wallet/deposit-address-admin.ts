import { Prisma, type WithdrawalChain } from "@/generated/prisma/client";
import { verifyCurrentUserPassword } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { DEFAULT_DEPOSIT_WALLET_ADDRESSES } from "@/lib/wallet/deposit-address-defaults";

export type UpdateDepositWalletAddressInput = {
  adminUserId: string;
  chain: string;
  label?: string;
  asset?: string;
  networkName?: string;
  address?: string;
  minimumAmount?: string;
  reason?: string;
  adminPassword?: string;
  isActive?: boolean;
};

export async function updateDepositWalletAddress(input: UpdateDepositWalletAddressInput) {
  const chain = parseChain(input.chain);
  const defaults = chain ? DEFAULT_DEPOSIT_WALLET_ADDRESSES[chain] : null;
  const label = input.label?.trim() || defaults?.label || "";
  const asset = input.asset?.trim() || defaults?.asset || "USDT";
  const networkName = input.networkName?.trim() || defaults?.networkName || "";
  const address = input.address?.trim() || "";
  const minimumAmount = input.minimumAmount?.trim() || defaults?.minimumAmount || "10";
  const reason = input.reason?.trim() || "";
  const adminPassword = input.adminPassword || "";
  const isActive = input.isActive ?? false;

  if (!chain || !label || !networkName || !address) {
    throw new Error("체인, 표시 이름, 네트워크, 입금 주소를 모두 입력해 주세요.");
  }

  if (!/^\d+(\.\d+)?$/.test(minimumAmount) || Number(minimumAmount) <= 0) {
    throw new Error("최소 입금액은 0보다 큰 숫자로 입력해 주세요.");
  }

  const addressError = validateAddressForChain(chain, address);
  if (addressError) {
    throw new Error(addressError);
  }

  if (reason.length < 10) {
    throw new Error("변경 사유를 10자 이상 입력해 주세요.");
  }

  if (!adminPassword) {
    throw new Error("최고관리자 비밀번호를 입력해야 주소를 변경할 수 있습니다.");
  }

  const passwordOk = await verifyCurrentUserPassword({
    userId: input.adminUserId,
    password: adminPassword,
  });

  if (!passwordOk) {
    throw new Error("비밀번호가 일치하지 않습니다.");
  }

  const prisma = getPrismaClient();
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.depositWalletAddress.findUnique({
      where: { chain },
    });

    const saved = await tx.depositWalletAddress.upsert({
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
        updatedByAdminId: input.adminUserId,
      },
      update: {
        label,
        asset,
        networkName,
        address,
        minimumAmount,
        isActive,
        updatedByAdminId: input.adminUserId,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.adminUserId,
        action: before ? "DEPOSIT_ADDRESS_UPDATED" : "DEPOSIT_ADDRESS_CREATED",
        targetType: "DEPOSIT_WALLET_ADDRESS",
        targetId: saved.id,
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
          chain: saved.chain,
          label: saved.label,
          asset: saved.asset,
          networkName: saved.networkName,
          address: maskAddress(saved.address),
          minimumAmount: saved.minimumAmount.toString(),
          isActive: saved.isActive,
          passwordRechecked: true,
        },
      },
    });

    return saved;
  });

  return {
    id: updated.id,
    chain: updated.chain,
    label: updated.label,
    networkName: updated.networkName,
    address: updated.address,
    minimumAmount: updated.minimumAmount.toString(),
    isActive: updated.isActive,
  };
}

export function parseChain(value: string): WithdrawalChain | null {
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

function maskAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

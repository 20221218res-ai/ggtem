export type WalletSnapshot = {
  userId: string;
  availableBalance: string;
  currency: string;
};

export type ManualDepositInput = {
  adminId: string;
  targetUserId: string;
  amount: string;
  currency: string;
  reason: string;
};

export type ManualDepositResult = {
  wallet: WalletSnapshot;
  ledgerEntry: {
    type: "ADMIN_DEPOSIT_APPROVED";
    direction: "CREDIT";
    bucket: "AVAILABLE";
    amount: string;
    currency: string;
    userId: string;
    memo: string;
  };
  auditLog: {
    action: "ADMIN_DEPOSIT_APPROVED";
    adminId: string;
    targetType: "USER";
    targetId: string;
    reason: string;
  };
};

const SCALE = 1_000_000n;

export function approveManualDeposit(
  wallet: WalletSnapshot,
  input: ManualDepositInput,
): ManualDepositResult {
  if (wallet.userId !== input.targetUserId) {
    throw new Error("Wallet user does not match deposit target.");
  }

  if (wallet.currency !== input.currency) {
    throw new Error("Wallet currency does not match deposit currency.");
  }

  if (!input.reason.trim()) {
    throw new Error("Manual deposit requires an admin reason.");
  }

  const currentAmount = parseFixedAmount(wallet.availableBalance);
  const depositAmount = parseFixedAmount(input.amount);

  if (depositAmount <= 0n) {
    throw new Error("Manual deposit amount must be greater than zero.");
  }

  const nextAmount = currentAmount + depositAmount;
  const normalizedAmount = formatFixedAmount(depositAmount);

  return {
    wallet: {
      ...wallet,
      availableBalance: formatFixedAmount(nextAmount),
    },
    ledgerEntry: {
      type: "ADMIN_DEPOSIT_APPROVED",
      direction: "CREDIT",
      bucket: "AVAILABLE",
      amount: normalizedAmount,
      currency: input.currency,
      userId: input.targetUserId,
      memo: input.reason.trim(),
    },
    auditLog: {
      action: "ADMIN_DEPOSIT_APPROVED",
      adminId: input.adminId,
      targetType: "USER",
      targetId: input.targetUserId,
      reason: input.reason.trim(),
    },
  };
}

export function parseFixedAmount(value: string): bigint {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number with up to 6 decimals.");
  }

  const [wholePart, fractionalPart = ""] = trimmed.split(".");
  const whole = BigInt(wholePart) * SCALE;
  const fractional = BigInt(fractionalPart.padEnd(6, "0"));

  return whole + fractional;
}

export function formatFixedAmount(value: bigint): string {
  const whole = value / SCALE;
  const fractional = value % SCALE;
  const fractionalText = fractional.toString().padStart(6, "0");
  const trimmedFractional = fractionalText.replace(/0+$/, "");

  return trimmedFractional ? `${whole}.${trimmedFractional}` : whole.toString();
}

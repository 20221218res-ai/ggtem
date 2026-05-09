import { getPrismaClient } from "@/lib/prisma";

const DEFAULT_WALLET_CURRENCY = "USDT";

export async function ensureUserWallet(userId: string) {
  const prisma = getPrismaClient();

  return prisma.wallet.upsert({
    where: {
      userId,
    },
    update: {},
    create: {
      userId,
      currency: DEFAULT_WALLET_CURRENCY,
    },
  });
}

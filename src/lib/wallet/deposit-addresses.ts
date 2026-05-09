import { getPrismaClient } from "@/lib/prisma";

export type PublicDepositWalletAddress = {
  id: string;
  chain: "TRC20" | "BEP20";
  label: string;
  asset: string;
  networkName: string;
  address: string;
  minimumAmount: string;
  isActive: boolean;
};

export type AdminDepositWalletAddress = PublicDepositWalletAddress & {
  sortOrder: number;
  updatedAt: string;
  updatedByAdminId: string | null;
};

export async function getPublicDepositWalletAddresses(): Promise<
  PublicDepositWalletAddress[]
> {
  const prisma = getPrismaClient();
  const addresses = await prisma.depositWalletAddress.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { chain: "asc" }],
  });

  return addresses.map((address) => ({
    id: address.id,
    chain: address.chain,
    label: address.label,
    asset: address.asset,
    networkName: address.networkName,
    address: address.address,
    minimumAmount: address.minimumAmount.toString(),
    isActive: address.isActive,
  }));
}

export async function getAdminDepositWalletAddressState() {
  const prisma = getPrismaClient();
  const addresses = await prisma.depositWalletAddress.findMany({
    orderBy: [{ sortOrder: "asc" }, { chain: "asc" }],
  });

  const mapped = addresses.map((address) => ({
    id: address.id,
    chain: address.chain,
    label: address.label,
    asset: address.asset,
    networkName: address.networkName,
    address: address.address,
    minimumAmount: address.minimumAmount.toString(),
    isActive: address.isActive,
    sortOrder: address.sortOrder,
    updatedAt: address.updatedAt.toISOString(),
    updatedByAdminId: address.updatedByAdminId,
  }));

  return {
    addresses: mapped,
    configuredCount: mapped.length,
    activeCount: mapped.filter((address) => address.isActive).length,
    missingChains: (["TRC20", "BEP20"] as const).filter(
      (chain) => !mapped.some((address) => address.chain === chain),
    ),
  };
}

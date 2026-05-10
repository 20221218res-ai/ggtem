export const DEFAULT_DEPOSIT_WALLET_ADDRESSES = {
  TRC20: {
    chain: "TRC20",
    label: "USDT TRC20",
    asset: "USDT",
    networkName: "TRON",
    minimumAmount: "10",
    sortOrder: 10,
  },
  BEP20: {
    chain: "BEP20",
    label: "USDT BEP20",
    asset: "USDT",
    networkName: "BNB Smart Chain",
    minimumAmount: "10",
    sortOrder: 20,
  },
} as const;

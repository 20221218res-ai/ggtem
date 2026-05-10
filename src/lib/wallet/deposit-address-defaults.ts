export const DEFAULT_DEPOSIT_WALLET_ADDRESSES = {
  TRC20: {
    chain: "TRC20",
    label: "USDT TRC20",
    asset: "USDT",
    networkName: "TRON",
    address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    minimumAmount: "10",
    sortOrder: 10,
  },
  BEP20: {
    chain: "BEP20",
    label: "USDT BEP20",
    asset: "USDT",
    networkName: "BNB Smart Chain",
    address: "0x55d398326f99059fF775485246999027B3197955",
    minimumAmount: "10",
    sortOrder: 20,
  },
} as const;

import {
  completePurchaseQuantity,
  lockPurchaseQuantity,
  releasePurchaseQuantity,
  type ListingInventorySnapshot,
} from "@/lib/inventory/purchase-lock";
import {
  formatFixedAmount,
  parseFixedAmount,
} from "@/lib/wallet/manual-deposit";

export type TradingWalletSnapshot = {
  userId: string;
  currency: string;
  availableBalance: string;
  escrowBalance: string;
};

export type OrderLifecycleSnapshot = {
  orderId: string | null;
  status: "IDLE" | "LOCKED" | "CANCELED" | "COMPLETED";
  inventory: ListingInventorySnapshot;
  buyerWallet: TradingWalletSnapshot;
  sellerWallet: TradingWalletSnapshot;
  lockedQuantity: string;
  escrowAmount: string;
};

export type LockOrderInput = {
  orderId: string;
  quantity: string;
  amount: string;
};

export type LockOrderResult = {
  snapshot: OrderLifecycleSnapshot;
  event: {
    type: "ORDER_LOCKED";
    orderId: string;
    quantity: string;
    amount: string;
  };
};

export type CancelOrderResult = {
  snapshot: OrderLifecycleSnapshot;
  event: {
    type: "ORDER_CANCELED";
    orderId: string;
    quantity: string;
    amount: string;
  };
};

export type CompleteOrderResult = {
  snapshot: OrderLifecycleSnapshot;
  event: {
    type: "ORDER_COMPLETED";
    orderId: string;
    quantity: string;
    amount: string;
  };
};

export function lockOrder(
  snapshot: OrderLifecycleSnapshot,
  input: LockOrderInput,
): LockOrderResult {
  ensureSameCurrency(snapshot);

  if (snapshot.status === "LOCKED") {
    throw new Error("An order is already locked in this simulator.");
  }

  const escrowAmount = parseFixedAmount(input.amount);
  const buyerAvailableBalance = parseFixedAmount(
    snapshot.buyerWallet.availableBalance,
  );
  const buyerEscrowBalance = parseFixedAmount(snapshot.buyerWallet.escrowBalance);

  if (escrowAmount <= 0n) {
    throw new Error("Trade amount must be greater than zero.");
  }

  if (buyerAvailableBalance < escrowAmount) {
    throw new Error("Buyer does not have enough available balance.");
  }

  const inventoryResult = lockPurchaseQuantity(snapshot.inventory, {
    listingId: snapshot.inventory.listingId,
    quantity: input.quantity,
    orderId: input.orderId,
  });

  return {
    snapshot: {
      ...snapshot,
      orderId: input.orderId,
      status: "LOCKED",
      inventory: inventoryResult.inventory,
      buyerWallet: {
        ...snapshot.buyerWallet,
        availableBalance: formatFixedAmount(
          buyerAvailableBalance - escrowAmount,
        ),
        escrowBalance: formatFixedAmount(buyerEscrowBalance + escrowAmount),
      },
      lockedQuantity: input.quantity,
      escrowAmount: formatFixedAmount(escrowAmount),
    },
    event: {
      type: "ORDER_LOCKED",
      orderId: input.orderId,
      quantity: input.quantity,
      amount: formatFixedAmount(escrowAmount),
    },
  };
}

export function cancelOrder(
  snapshot: OrderLifecycleSnapshot,
): CancelOrderResult {
  ensureSameCurrency(snapshot);

  if (snapshot.status !== "LOCKED" || !snapshot.orderId) {
    throw new Error("There is no locked order to cancel.");
  }

  const escrowAmount = parseFixedAmount(snapshot.escrowAmount);
  const buyerAvailableBalance = parseFixedAmount(
    snapshot.buyerWallet.availableBalance,
  );
  const buyerEscrowBalance = parseFixedAmount(snapshot.buyerWallet.escrowBalance);

  if (buyerEscrowBalance < escrowAmount) {
    throw new Error("Buyer escrow balance is inconsistent.");
  }

  const inventoryResult = releasePurchaseQuantity(snapshot.inventory, {
    listingId: snapshot.inventory.listingId,
    quantity: snapshot.lockedQuantity,
    orderId: snapshot.orderId,
  });

  return {
    snapshot: {
      ...snapshot,
      orderId: null,
      status: "CANCELED",
      inventory: inventoryResult.inventory,
      buyerWallet: {
        ...snapshot.buyerWallet,
        availableBalance: formatFixedAmount(
          buyerAvailableBalance + escrowAmount,
        ),
        escrowBalance: formatFixedAmount(buyerEscrowBalance - escrowAmount),
      },
      lockedQuantity: "0",
      escrowAmount: "0",
    },
    event: {
      type: "ORDER_CANCELED",
      orderId: snapshot.orderId,
      quantity: snapshot.lockedQuantity,
      amount: snapshot.escrowAmount,
    },
  };
}

export function completeOrder(
  snapshot: OrderLifecycleSnapshot,
): CompleteOrderResult {
  ensureSameCurrency(snapshot);

  if (snapshot.status !== "LOCKED" || !snapshot.orderId) {
    throw new Error("There is no locked order to complete.");
  }

  const escrowAmount = parseFixedAmount(snapshot.escrowAmount);
  const buyerEscrowBalance = parseFixedAmount(snapshot.buyerWallet.escrowBalance);
  const sellerAvailableBalance = parseFixedAmount(
    snapshot.sellerWallet.availableBalance,
  );
  const sellerEscrowBalance = parseFixedAmount(
    snapshot.sellerWallet.escrowBalance,
  );

  if (buyerEscrowBalance < escrowAmount) {
    throw new Error("Buyer escrow balance is inconsistent.");
  }

  const inventoryResult = completePurchaseQuantity(snapshot.inventory, {
    listingId: snapshot.inventory.listingId,
    quantity: snapshot.lockedQuantity,
    orderId: snapshot.orderId,
  });

  return {
    snapshot: {
      ...snapshot,
      orderId: null,
      status: "COMPLETED",
      inventory: inventoryResult.inventory,
      buyerWallet: {
        ...snapshot.buyerWallet,
        escrowBalance: formatFixedAmount(buyerEscrowBalance - escrowAmount),
      },
      sellerWallet: {
        ...snapshot.sellerWallet,
        availableBalance: formatFixedAmount(
          sellerAvailableBalance + escrowAmount,
        ),
        escrowBalance: formatFixedAmount(sellerEscrowBalance),
      },
      lockedQuantity: "0",
      escrowAmount: "0",
    },
    event: {
      type: "ORDER_COMPLETED",
      orderId: snapshot.orderId,
      quantity: snapshot.lockedQuantity,
      amount: snapshot.escrowAmount,
    },
  };
}

function ensureSameCurrency(snapshot: OrderLifecycleSnapshot) {
  if (snapshot.buyerWallet.currency !== snapshot.sellerWallet.currency) {
    throw new Error("Buyer and seller wallet currency must match.");
  }
}

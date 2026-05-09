import type { OrderLifecycleSnapshot } from "@/lib/orders/order-lifecycle";

export type OrderLifecycleEvent = {
  type: string;
  orderId: string;
  quantity: string;
  amount: string;
  createdAt: string;
};

export type OrderLifecycleApiState = {
  snapshot: OrderLifecycleSnapshot;
  lastEvent: OrderLifecycleEvent | null;
  eventHistory: OrderLifecycleEvent[];
};

export const initialOrderLifecycleSnapshot: OrderLifecycleSnapshot = {
  orderId: null,
  status: "IDLE",
  inventory: {
    listingId: "listing-demo-900k",
    totalQuantity: "900000",
    availableQuantity: "900000",
    lockedQuantity: "0",
    soldQuantity: "0",
  },
  buyerWallet: {
    userId: "trader-a-demo",
    currency: "USDT",
    availableBalance: "500",
    escrowBalance: "0",
  },
  sellerWallet: {
    userId: "trader-b-demo",
    currency: "USDT",
    availableBalance: "0",
    escrowBalance: "0",
  },
  lockedQuantity: "0",
  escrowAmount: "0",
};

export const initialOrderLifecycleApiState: OrderLifecycleApiState = {
  snapshot: initialOrderLifecycleSnapshot,
  lastEvent: null,
  eventHistory: [],
};

export function createOrderLifecycleEvent(event: {
  type: string;
  orderId: string;
  quantity: string;
  amount: string;
}): OrderLifecycleEvent {
  return {
    ...event,
    createdAt: new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    }).format(new Date()),
  };
}

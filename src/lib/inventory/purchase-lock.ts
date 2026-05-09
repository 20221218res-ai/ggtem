export type ListingInventorySnapshot = {
  listingId: string;
  totalQuantity: string;
  availableQuantity: string;
  lockedQuantity: string;
  soldQuantity: string;
};

export type LockPurchaseQuantityInput = {
  listingId: string;
  quantity: string;
  orderId: string;
};

export type LockPurchaseQuantityResult = {
  inventory: ListingInventorySnapshot;
  event: {
    type: "LISTING_INVENTORY_LOCKED";
    listingId: string;
    orderId: string;
    quantity: string;
    before: ListingInventorySnapshot;
    after: ListingInventorySnapshot;
  };
};

export type ReleasePurchaseQuantityInput = {
  listingId: string;
  quantity: string;
  orderId: string;
};

export type ReleasePurchaseQuantityResult = {
  inventory: ListingInventorySnapshot;
  event: {
    type: "LISTING_INVENTORY_RELEASED";
    listingId: string;
    orderId: string;
    quantity: string;
    before: ListingInventorySnapshot;
    after: ListingInventorySnapshot;
  };
};

export type CompletePurchaseQuantityInput = {
  listingId: string;
  quantity: string;
  orderId: string;
};

export type CompletePurchaseQuantityResult = {
  inventory: ListingInventorySnapshot;
  event: {
    type: "LISTING_INVENTORY_SOLD";
    listingId: string;
    orderId: string;
    quantity: string;
    before: ListingInventorySnapshot;
    after: ListingInventorySnapshot;
  };
};

const SCALE = 1_000_000n;

export function lockPurchaseQuantity(
  inventory: ListingInventorySnapshot,
  input: LockPurchaseQuantityInput,
): LockPurchaseQuantityResult {
  if (inventory.listingId !== input.listingId) {
    throw new Error("Inventory listing does not match purchase listing.");
  }

  const totalQuantity = parseFixedQuantity(inventory.totalQuantity);
  const availableQuantity = parseFixedQuantity(inventory.availableQuantity);
  const lockedQuantity = parseFixedQuantity(inventory.lockedQuantity);
  const soldQuantity = parseFixedQuantity(inventory.soldQuantity);
  const purchaseQuantity = parseFixedQuantity(input.quantity);

  if (purchaseQuantity <= 0n) {
    throw new Error("Purchase quantity must be greater than zero.");
  }

  if (availableQuantity < purchaseQuantity) {
    throw new Error("Not enough available inventory.");
  }

  const calculatedTotal = availableQuantity + lockedQuantity + soldQuantity;

  if (calculatedTotal !== totalQuantity) {
    throw new Error("Inventory totals are inconsistent.");
  }

  const nextInventory: ListingInventorySnapshot = {
    ...inventory,
    availableQuantity: formatFixedQuantity(availableQuantity - purchaseQuantity),
    lockedQuantity: formatFixedQuantity(lockedQuantity + purchaseQuantity),
  };

  return {
    inventory: nextInventory,
    event: {
      type: "LISTING_INVENTORY_LOCKED",
      listingId: input.listingId,
      orderId: input.orderId,
      quantity: formatFixedQuantity(purchaseQuantity),
      before: inventory,
      after: nextInventory,
    },
  };
}

export function releasePurchaseQuantity(
  inventory: ListingInventorySnapshot,
  input: ReleasePurchaseQuantityInput,
): ReleasePurchaseQuantityResult {
  if (inventory.listingId !== input.listingId) {
    throw new Error("Inventory listing does not match purchase listing.");
  }

  const totalQuantity = parseFixedQuantity(inventory.totalQuantity);
  const availableQuantity = parseFixedQuantity(inventory.availableQuantity);
  const lockedQuantity = parseFixedQuantity(inventory.lockedQuantity);
  const soldQuantity = parseFixedQuantity(inventory.soldQuantity);
  const releaseQuantity = parseFixedQuantity(input.quantity);

  if (releaseQuantity <= 0n) {
    throw new Error("Release quantity must be greater than zero.");
  }

  if (lockedQuantity < releaseQuantity) {
    throw new Error("Not enough locked inventory.");
  }

  const calculatedTotal = availableQuantity + lockedQuantity + soldQuantity;

  if (calculatedTotal !== totalQuantity) {
    throw new Error("Inventory totals are inconsistent.");
  }

  const nextInventory: ListingInventorySnapshot = {
    ...inventory,
    availableQuantity: formatFixedQuantity(availableQuantity + releaseQuantity),
    lockedQuantity: formatFixedQuantity(lockedQuantity - releaseQuantity),
  };

  return {
    inventory: nextInventory,
    event: {
      type: "LISTING_INVENTORY_RELEASED",
      listingId: input.listingId,
      orderId: input.orderId,
      quantity: formatFixedQuantity(releaseQuantity),
      before: inventory,
      after: nextInventory,
    },
  };
}

export function completePurchaseQuantity(
  inventory: ListingInventorySnapshot,
  input: CompletePurchaseQuantityInput,
): CompletePurchaseQuantityResult {
  if (inventory.listingId !== input.listingId) {
    throw new Error("Inventory listing does not match purchase listing.");
  }

  const totalQuantity = parseFixedQuantity(inventory.totalQuantity);
  const availableQuantity = parseFixedQuantity(inventory.availableQuantity);
  const lockedQuantity = parseFixedQuantity(inventory.lockedQuantity);
  const soldQuantity = parseFixedQuantity(inventory.soldQuantity);
  const soldQuantityDelta = parseFixedQuantity(input.quantity);

  if (soldQuantityDelta <= 0n) {
    throw new Error("Complete quantity must be greater than zero.");
  }

  if (lockedQuantity < soldQuantityDelta) {
    throw new Error("Not enough locked inventory.");
  }

  const calculatedTotal = availableQuantity + lockedQuantity + soldQuantity;

  if (calculatedTotal !== totalQuantity) {
    throw new Error("Inventory totals are inconsistent.");
  }

  const nextInventory: ListingInventorySnapshot = {
    ...inventory,
    lockedQuantity: formatFixedQuantity(lockedQuantity - soldQuantityDelta),
    soldQuantity: formatFixedQuantity(soldQuantity + soldQuantityDelta),
  };

  return {
    inventory: nextInventory,
    event: {
      type: "LISTING_INVENTORY_SOLD",
      listingId: input.listingId,
      orderId: input.orderId,
      quantity: formatFixedQuantity(soldQuantityDelta),
      before: inventory,
      after: nextInventory,
    },
  };
}

export function parseFixedQuantity(value: string): bigint {
  const trimmed = value.trim().replaceAll(",", "");

  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Quantity must be a positive number with up to 6 decimals.");
  }

  const [wholePart, fractionalPart = ""] = trimmed.split(".");
  const whole = BigInt(wholePart) * SCALE;
  const fractional = BigInt(fractionalPart.padEnd(6, "0"));

  return whole + fractional;
}

export function formatFixedQuantity(value: bigint): string {
  const whole = value / SCALE;
  const fractional = value % SCALE;
  const fractionalText = fractional.toString().padStart(6, "0");
  const trimmedFractional = fractionalText.replace(/0+$/, "");

  return trimmedFractional ? `${whole}.${trimmedFractional}` : whole.toString();
}

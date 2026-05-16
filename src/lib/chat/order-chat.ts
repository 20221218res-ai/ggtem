import { getCurrentSessionUser } from "@/lib/auth/session";
import { createUserNotification } from "@/lib/notifications/notifications";
import { getPrismaClient } from "@/lib/prisma";
import { assertNoOffPlatformContact } from "@/lib/risk/off-platform-contact";

export type OrderChatView = {
  roomId: string;
  orderId: string;
  listingId: string;
  orderNumber: string;
  orderStatus: string;
  grossAmount: string;
  sellerReceivableAmount: string;
  currency: string;
  tradeCharacterName: string | null;
  buyerGameNickname: string | null;
  sellerGameNickname: string | null;
  listingTitle: string;
  category: string;
  gameName: string;
  serverName: string | null;
  moneyUnitName: string;
  priceUnitQuantity: string;
  accountTransferType: string | null;
  quantity: string;
  unitPrice: string;
  buyerName: string;
  sellerName: string;
  currentUser: {
    userId: string;
    displayName: string;
    role: string;
  };
  counterpartName: string;
  messages: Array<{
    messageId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    body: string;
    createdAt: string;
    readAt: string | null;
    isMine: boolean;
    isReadByCounterpart: boolean;
  }>;
};

export type OrderChatSendResult = {
  roomId: string;
  messageId: string;
  message: string;
};

export type OrderChatInboxView = {
  currentUser: {
    userId: string;
    displayName: string;
    role: string;
  };
  rooms: Array<{
    roomId: string;
    orderId: string;
    orderNumber: string;
    listingTitle: string;
    grossAmount: string;
    currency: string;
    counterpartName: string;
    orderStatus: string;
    perspective: "BUYER" | "SELLER";
    lastMessagePreview: string;
    lastMessageAt: string;
    unreadCount: number;
    href: string;
  }>;
};

export async function getOrderChatInboxLiveSignature(): Promise<string | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser || !["CUSTOMER", "SELLER"].includes(sessionUser.role)) {
    return null;
  }

  const roomRows = await prisma.chatRoom.findMany({
    where: {
      OR: [{ buyerId: sessionUser.userId }, { sellerId: sessionUser.userId }],
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          body: true,
          createdAt: true,
        },
      },
    },
  });

  const roomIds = roomRows.map((room) => room.id);
  const unreadRows = roomIds.length
    ? await prisma.chatMessage.groupBy({
        by: ["roomId"],
        where: {
          roomId: {
            in: roomIds,
          },
          senderId: {
            not: sessionUser.userId,
          },
          readAt: null,
        },
        _count: {
          _all: true,
        },
      })
    : [];

  const unreadCountByRoomId = new Map(
    unreadRows.map((row) => [row.roomId, row._count._all]),
  );

  return JSON.stringify(
    roomRows.map((room) => ({
      roomId: room.id,
      lastMessageAt: (
        room.messages[0]?.createdAt ??
        room.lastMessageAt ??
        room.updatedAt ??
        room.createdAt
      ).toISOString(),
      preview: room.messages[0]?.body ?? "",
      unreadCount: unreadCountByRoomId.get(room.id) ?? 0,
    })),
  );
}

export async function getOrderChatLiveSignature(input: {
  orderId: string;
}): Promise<string | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser || !["CUSTOMER", "SELLER"].includes(sessionUser.role)) {
    return null;
  }

  const order = await prisma.order.findFirst({
    where: buildOrderWhereClause(input.orderId, sessionUser.userId),
    select: {
      id: true,
    },
  });

  if (!order) {
    return null;
  }

  const room = await ensureOrderChatRoom(order.id);
  const [latestMessage, unreadCount] = await Promise.all([
    prisma.chatMessage.findFirst({
      where: {
        roomId: room.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        createdAt: true,
        readAt: true,
      },
    }),
    prisma.chatMessage.count({
      where: {
        roomId: room.id,
        senderId: {
          not: sessionUser.userId,
        },
        readAt: null,
      },
    }),
  ]);

  return JSON.stringify({
    roomId: room.id,
    unreadCount,
    latestMessageId: latestMessage?.id ?? null,
    latestMessageAt: latestMessage?.createdAt.toISOString() ?? null,
    latestReadAt: latestMessage?.readAt?.toISOString() ?? null,
  });
}

export async function getOrderChatInbox(): Promise<OrderChatInboxView | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser || !["CUSTOMER", "SELLER"].includes(sessionUser.role)) {
    return null;
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        {
          buyerId: sessionUser.userId,
        },
        {
          sellerId: sessionUser.userId,
        },
      ],
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      orderNumber: true,
      status: true,
      grossAmount: true,
      currency: true,
      buyer: {
        select: {
          displayName: true,
        },
      },
      seller: {
        select: {
          displayName: true,
        },
      },
      listing: {
        select: {
          title: true,
        },
      },
      chatRoom: {
        select: {
          id: true,
          createdAt: true,
          messages: {
            select: {
              body: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 30,
  });

  const roomRows: Array<{
    order: (typeof orders)[number];
    room: { id: string; createdAt: Date };
    latestMessage: { body: string; createdAt: Date } | null;
  }> = [];

  for (const order of orders) {
    const room = order.chatRoom ?? (await ensureOrderChatRoom(order.id));
    const latestMessage =
      order.chatRoom?.id === room.id
        ? order.chatRoom.messages[0] ?? null
        : await prisma.chatMessage.findFirst({
            where: {
              roomId: room.id,
            },
            select: {
              body: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          });

    roomRows.push({ order, room, latestMessage });
  }

  const unreadGroups = roomRows.length
    ? await prisma.chatMessage.groupBy({
        by: ["roomId"],
        where: {
          roomId: {
            in: roomRows.map((row) => row.room.id),
          },
          senderId: {
            not: sessionUser.userId,
          },
          readAt: null,
        },
        _count: {
          _all: true,
        },
      })
    : [];
  const unreadCountByRoomId = new Map(
    unreadGroups.map((group) => [group.roomId, group._count._all]),
  );

  const rooms: OrderChatInboxView["rooms"] = [];

  for (const { order, room, latestMessage } of roomRows) {
    const unreadCount = unreadCountByRoomId.get(room.id) ?? 0;

    rooms.push({
      roomId: room.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      listingTitle: order.listing.title,
      grossAmount: order.grossAmount.toString(),
      currency: order.currency,
      counterpartName:
        sessionUser.userId === order.buyerId
          ? order.seller.displayName
          : order.buyer.displayName,
      orderStatus: order.status,
      perspective: sessionUser.userId === order.sellerId ? "SELLER" : "BUYER",
      lastMessagePreview:
        latestMessage?.body ??
        "아직 메시지가 없습니다. 채팅방을 열어 거래 내용을 조율하세요.",
      lastMessageAt: formatKoreanDate(
        latestMessage?.createdAt ?? room.createdAt,
      ),
      unreadCount,
      href:
        sessionUser.userId === order.sellerId
          ? `/my/listings/orders/${order.id}/chat`
          : `/my/orders/${order.id}/chat`,
    });
  }

  return {
    currentUser: {
      userId: sessionUser.userId,
      displayName: sessionUser.displayName,
      role: sessionUser.role,
    },
    rooms,
  };
}

export async function getOrderChatView(input: {
  orderId: string;
  allowedRoles: Array<"CUSTOMER" | "SELLER">;
  perspective?: "BUYER" | "SELLER";
}): Promise<OrderChatView | null> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (
    !sessionUser ||
    !input.allowedRoles.includes(sessionUser.role as "CUSTOMER" | "SELLER")
  ) {
    return null;
  }

  const order = await prisma.order.findFirst({
    where: buildOrderWhereClause(
      input.orderId,
      sessionUser.userId,
      input.perspective,
    ),
    select: {
      id: true,
      listingId: true,
      buyerId: true,
      sellerId: true,
      orderNumber: true,
      status: true,
      grossAmount: true,
      sellerReceivableAmount: true,
      currency: true,
      tradeCharacterName: true,
      buyerGameNickname: true,
      sellerGameNickname: true,
      quantity: true,
      unitPrice: true,
      buyer: {
        select: {
          displayName: true,
        },
      },
      seller: {
        select: {
          displayName: true,
        },
      },
      listing: {
        select: {
          title: true,
          category: true,
          priceUnitQuantity: true,
          accountTransferType: true,
          game: {
            select: {
              name: true,
              moneyUnitName: true,
            },
          },
          server: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  const room = await ensureOrderChatRoom(order.id);
  await prisma.chatMessage.updateMany({
    where: {
      roomId: room.id,
      senderId: {
        not: sessionUser.userId,
      },
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  const roomWithMessages = await prisma.chatRoom.findUnique({
    where: {
      id: room.id,
    },
    select: {
      id: true,
      messages: {
        select: {
          id: true,
          senderId: true,
          body: true,
          createdAt: true,
          readAt: true,
          sender: {
            select: {
              displayName: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 100,
      },
    },
  });

  if (!roomWithMessages) {
    return null;
  }

  return {
    roomId: roomWithMessages.id,
    orderId: order.id,
    listingId: order.listingId,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    grossAmount: order.grossAmount.toString(),
    sellerReceivableAmount: order.sellerReceivableAmount.toString(),
    currency: order.currency,
    tradeCharacterName: order.tradeCharacterName,
    buyerGameNickname: order.buyerGameNickname,
    sellerGameNickname: order.sellerGameNickname,
    listingTitle: order.listing.title,
    category: order.listing.category,
    gameName: order.listing.game.name,
    serverName: order.listing.server?.name ?? null,
    moneyUnitName: order.listing.game.moneyUnitName,
    priceUnitQuantity: order.listing.priceUnitQuantity?.toString() ?? "10000",
    accountTransferType: order.listing.accountTransferType,
    quantity: order.quantity.toString(),
    unitPrice: order.unitPrice.toString(),
    buyerName: order.buyer.displayName,
    sellerName: order.seller.displayName,
    currentUser: {
      userId: sessionUser.userId,
      displayName: sessionUser.displayName,
      role: sessionUser.role,
    },
    counterpartName:
      sessionUser.userId === order.buyerId
        ? order.seller.displayName
        : order.buyer.displayName,
    messages: roomWithMessages.messages.map((message) => ({
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      senderRole: message.sender.role,
      body: message.body,
      createdAt: formatKoreanDate(message.createdAt),
      readAt: message.readAt ? formatKoreanDate(message.readAt) : null,
      isMine: message.senderId === sessionUser.userId,
      isReadByCounterpart:
        message.senderId === sessionUser.userId ? Boolean(message.readAt) : true,
    })),
  };
}

export async function sendOrderChatMessage(input: {
  orderId: string;
  body: string;
}): Promise<OrderChatSendResult> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser || !["CUSTOMER", "SELLER"].includes(sessionUser.role)) {
    throw new Error("로그인한 사용자만 주문 채팅 메시지를 보낼 수 있습니다.");
  }

  const trimmedBody = input.body.trim();
  if (!trimmedBody) {
    throw new Error("메시지 내용을 입력해 주세요.");
  }

  if (trimmedBody.length > 1000) {
    throw new Error("메시지는 1000자 이하로 입력해 주세요.");
  }

  const order = await prisma.order.findFirst({
    where: buildOrderWhereClause(input.orderId, sessionUser.userId),
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
    },
  });

  if (!order) {
    throw new Error("주문 채팅방을 찾을 수 없습니다.");
  }

  await assertNoOffPlatformContact(trimmedBody, {
    actorUserId: sessionUser.userId,
    targetUserId:
      sessionUser.userId === order.buyerId ? order.sellerId : order.buyerId,
    orderId: order.id,
    sourceType: "ORDER_CHAT_MESSAGE",
    sourceId: `${order.id}:${Date.now()}`,
    contentKind: "CHAT",
  });

  const room = await ensureOrderChatRoom(order.id);
  const message = await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: sessionUser.userId,
      body: trimmedBody,
    },
  });

  await prisma.chatRoom.update({
    where: {
      id: room.id,
    },
    data: {
      lastMessageAt: message.createdAt,
    },
  });

  const recipientUserId =
    sessionUser.userId === order.buyerId ? order.sellerId : order.buyerId;

  await createUserNotification({
    userId: recipientUserId,
    type: "CHAT_MESSAGE",
    title: "주문 채팅 메시지",
    body: trimmedBody.length > 120 ? `${trimmedBody.slice(0, 117)}...` : trimmedBody,
    href:
      sessionUser.userId === order.sellerId
        ? `/my/orders/${order.id}/chat`
        : `/my/listings/orders/${order.id}/chat`,
    metadata: {
      orderId: order.id,
      roomId: room.id,
      senderId: sessionUser.userId,
    },
  });

  return {
    roomId: room.id,
    messageId: message.id,
    message: "주문 채팅 메시지를 보냈습니다.",
  };
}

async function ensureOrderChatRoom(orderId: string) {
  const prisma = getPrismaClient();
  const existingRoom = await prisma.chatRoom.findUnique({
    where: {
      orderId,
    },
    select: {
      id: true,
      orderId: true,
      buyerId: true,
      sellerId: true,
      createdAt: true,
    },
  });

  if (existingRoom) {
    return existingRoom;
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
    },
  });

  if (!order) {
    throw new Error("채팅방을 만들 주문을 찾을 수 없습니다.");
  }

  return prisma.chatRoom.create({
    data: {
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
    },
    select: {
      id: true,
      orderId: true,
      buyerId: true,
      sellerId: true,
      createdAt: true,
    },
  });
}

function buildOrderWhereClause(
  orderId: string,
  userId: string,
  perspective?: "BUYER" | "SELLER",
) {
  if (perspective === "SELLER") {
    return {
      id: orderId,
      sellerId: userId,
    };
  }

  if (perspective === "BUYER") {
    return {
      id: orderId,
      buyerId: userId,
    };
  }

  return {
    id: orderId,
    OR: [
      {
        buyerId: userId,
      },
      {
        sellerId: userId,
      },
    ],
  };
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

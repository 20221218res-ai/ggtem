import { detectOffPlatformContact } from "@/lib/risk/off-platform-contact";
import { getPrismaClient } from "@/lib/prisma";

export type AdminOrderChatsState = {
  filters: {
    query: string;
    orderId: string | null;
    riskOnly: boolean;
  };
  summary: {
    shownRooms: number;
    totalRooms: number;
    riskyRooms: number;
  };
  rooms: Array<{
    roomId: string;
    orderId: string;
    orderNumber: string;
    orderStatus: string;
    listingTitle: string;
    gameName: string;
    buyerName: string;
    buyerEmail: string;
    sellerName: string;
    sellerEmail: string;
    lastMessagePreview: string;
    lastMessageAt: string | null;
    messageCount: number;
    riskSignalCount: number;
  }>;
  selectedRoom: {
    roomId: string;
    orderId: string;
    orderNumber: string;
    orderStatus: string;
    listingTitle: string;
    gameName: string;
    buyerName: string;
    buyerEmail: string;
    sellerName: string;
    sellerEmail: string;
    grossAmount: string;
    currency: string;
    messages: Array<{
      messageId: string;
      senderId: string;
      senderName: string;
      senderEmail: string;
      senderRole: "BUYER" | "SELLER" | "OTHER";
      body: string;
      createdAt: string;
      readAt: string | null;
      riskLabels: string[];
    }>;
  } | null;
};

export async function getAdminOrderChatsState(input: {
  query?: string | null;
  orderId?: string | null;
  viewerAdminId: string;
  riskOnly?: boolean;
  auditView?: boolean;
}): Promise<AdminOrderChatsState> {
  const prisma = getPrismaClient();
  const query = input.query?.trim() ?? "";
  const orderId = input.orderId?.trim() || null;
  const riskOnly = input.riskOnly === true;
  const where = query
    ? {
        OR: [
          {
            order: {
              orderNumber: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          },
          {
            order: {
              listing: {
                title: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
          },
          {
            buyer: {
              email: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          },
          {
            seller: {
              email: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          },
          {
            buyer: {
              displayName: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          },
          {
            seller: {
              displayName: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          },
        ],
      }
    : {};

  const [rooms, totalRooms] = await Promise.all([
    prisma.chatRoom.findMany({
      where,
      include: {
        buyer: true,
        seller: true,
        order: {
          include: {
            listing: {
              include: {
                game: true,
              },
            },
          },
        },
        messages: {
          include: {
            sender: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 30,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: [
        {
          lastMessageAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
      take: 50,
    }),
    prisma.chatRoom.count(),
  ]);

  const allRoomSummaries = rooms.map((room) => {
    const orderedRecentMessages = [...room.messages].reverse();
    const riskSignalCount = orderedRecentMessages.filter((message) =>
      detectOffPlatformContact(message.body).blocked,
    ).length;
    const lastMessage = room.messages[0] ?? null;

    return {
      roomId: room.id,
      orderId: room.orderId,
      orderNumber: room.order.orderNumber,
      orderStatus: room.order.status,
      listingTitle: room.order.listing.title,
      gameName: room.order.listing.game.name,
      buyerName: room.buyer.displayName,
      buyerEmail: room.buyer.email,
      sellerName: room.seller.displayName,
      sellerEmail: room.seller.email,
      lastMessagePreview: lastMessage
        ? trimPreview(lastMessage.body)
        : "아직 메시지가 없습니다.",
      lastMessageAt: lastMessage ? formatKoreanDate(lastMessage.createdAt) : null,
      messageCount: room._count.messages,
      riskSignalCount,
    };
  });

  const roomSummaries = riskOnly
    ? allRoomSummaries.filter((room) => room.riskSignalCount > 0)
    : allRoomSummaries;

  const selectedRoom = orderId
    ? await getAdminOrderChatDetail(orderId, input.viewerAdminId, input.auditView !== false)
    : null;

  return {
    filters: {
      query,
      orderId,
      riskOnly,
    },
    summary: {
      shownRooms: roomSummaries.length,
      totalRooms,
      riskyRooms: allRoomSummaries.filter((room) => room.riskSignalCount > 0).length,
    },
    rooms: roomSummaries,
    selectedRoom,
  };
}

async function getAdminOrderChatDetail(
  orderId: string,
  viewerAdminId: string,
  auditView: boolean,
) {
  const prisma = getPrismaClient();
  const room = await prisma.chatRoom.findFirst({
    where: {
      orderId,
    },
    include: {
      buyer: true,
      seller: true,
      order: {
        include: {
          listing: {
            include: {
              game: true,
            },
          },
        },
      },
      messages: {
        include: {
          sender: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 200,
      },
    },
  });

  if (!room) return null;

  if (auditView) {
    await prisma.adminAuditLog.create({
      data: {
        adminId: viewerAdminId,
        action: "ADMIN_ORDER_CHAT_VIEWED",
        targetType: "ORDER",
        targetId: room.orderId,
        reason: "관리자 주문 채팅 열람",
        after: {
          roomId: room.id,
          orderNumber: room.order.orderNumber,
          buyerId: room.buyerId,
          sellerId: room.sellerId,
          messageCount: room.messages.length,
        },
      },
    });
  }

  return {
    roomId: room.id,
    orderId: room.orderId,
    orderNumber: room.order.orderNumber,
    orderStatus: room.order.status,
    listingTitle: room.order.listing.title,
    gameName: room.order.listing.game.name,
    buyerName: room.buyer.displayName,
    buyerEmail: room.buyer.email,
    sellerName: room.seller.displayName,
    sellerEmail: room.seller.email,
    grossAmount: room.order.grossAmount.toString(),
    currency: room.order.currency,
    messages: room.messages.map((message) => ({
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      senderEmail: message.sender.email,
      senderRole:
        message.senderId === room.buyerId
          ? ("BUYER" as const)
          : message.senderId === room.sellerId
            ? ("SELLER" as const)
            : ("OTHER" as const),
      body: message.body,
      createdAt: formatKoreanDate(message.createdAt),
      readAt: message.readAt ? formatKoreanDate(message.readAt) : null,
      riskLabels: detectOffPlatformContact(message.body).signals.map((signal) =>
        signalLabel(signal.code),
      ),
    })),
  };
}

function signalLabel(code: string) {
  const labels: Record<string, string> = {
    EMAIL: "이메일",
    EXTERNAL_URL: "외부 링크",
    PHONE: "전화번호",
    MESSENGER: "SNS/메신저",
    OFF_PLATFORM_TRADE: "외부거래 유도",
    CRYPTO_ADDRESS: "개인 지갑주소",
  };

  return labels[code] ?? code;
}

function trimPreview(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

import { getPrismaClient } from "@/lib/prisma";

export type AdminGameSettingsState = Awaited<ReturnType<typeof getAdminGameSettingsState>>;

export async function getAdminGameSettingsState() {
  const prisma = getPrismaClient();

  const [games, totalBuyRequests, buyRequestsByGame, buyRequestsByServer, recentChanges] =
    await Promise.all([
      prisma.game.findMany({
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        include: {
          servers: {
            orderBy: [{ isActive: "desc" }, { name: "asc" }],
            include: { _count: { select: { listings: true } } },
          },
          _count: { select: { listings: true } },
          adminNotes: {
            orderBy: { updatedAt: "desc" },
            take: 3,
            include: { admin: { select: { displayName: true, email: true } } },
          },
        },
      }),
      prisma.buyRequest.count(),
      prisma.buyRequest.groupBy({ by: ["gameId"], _count: true }),
      prisma.buyRequest.groupBy({
        by: ["serverId"],
        where: { serverId: { not: null } },
        _count: true,
      }),
      prisma.adminAuditLog.findMany({
        where: { targetType: { in: ["GAME", "GAME_SERVER"] } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { admin: { select: { displayName: true, email: true } } },
      }),
    ]);

  const buyRequestCountByGame = new Map(
    buyRequestsByGame.map((item) => [item.gameId, item._count]),
  );
  const buyRequestCountByServer = new Map(
    buyRequestsByServer.map((item) => [item.serverId, item._count]),
  );
  const activeGames = games.filter((game) => game.isActive);
  const activeServers = games.flatMap((game) => game.servers.filter((server) => server.isActive));
  const totalListings = games.reduce((sum, game) => sum + game._count.listings, 0);

  return {
    summary: {
      totalGames: games.length,
      activeGames: activeGames.length,
      totalServers: games.reduce((sum, game) => sum + game.servers.length, 0),
      activeServers: activeServers.length,
      totalListings,
      totalBuyRequests,
    },
    games: games.map((game) => ({
      id: game.id,
      name: game.name,
      code: game.code,
      nameKo: game.nameKo,
      nameCn: game.nameCn,
      nameVn: game.nameVn,
      namePh: game.namePh,
      nameTh: game.nameTh,
      moneyUnitName: game.moneyUnitName,
      imageUrl: game.imageUrl,
      imageStoragePath: game.imageStoragePath,
      imageAlt: game.imageAlt,
      sortOrder: game.sortOrder,
      isActive: game.isActive,
      listingCount: game._count.listings,
      buyRequestCount: buyRequestCountByGame.get(game.id) ?? 0,
      adminNotes: game.adminNotes.map((note) => ({
        id: note.id,
        body: note.body,
        adminName: note.admin.displayName || note.admin.email,
        updatedAt: formatKoreanDateTime(note.updatedAt),
      })),
      servers: game.servers.map((server) => ({
        id: server.id,
        name: server.name,
        code: server.code,
        isActive: server.isActive,
        listingCount: server._count.listings,
        buyRequestCount: buyRequestCountByServer.get(server.id) ?? 0,
      })),
    })),
    recentChanges: recentChanges.map((log) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      adminName: log.admin?.displayName ?? log.admin?.email ?? "시스템",
      createdAt: formatKoreanDateTime(log.createdAt),
    })),
  };
}

export function normalizeCatalogCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function formatKoreanDateTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(value);
}

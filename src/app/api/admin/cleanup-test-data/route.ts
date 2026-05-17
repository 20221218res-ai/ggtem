import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESET_WALLET_BALANCES = {
  availableBalance: "0",
  escrowLockedBalance: "0",
  buyRequestLocked: "0",
  pendingSettlement: "0",
  withdrawableBalance: "0",
  withdrawalLocked: "0",
};

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    const authorization = request.headers.get("authorization") ?? "";

    if (!secret || authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const confirmation = request.headers.get("x-gg-cleanup-confirm");
    if (confirmation !== "delete-test-data-keep-users") {
      return NextResponse.json({ message: "Cleanup confirmation header is required." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const before = await countModels(prisma);

    const result = await prisma.$transaction(async (tx) => {
      const deleted = {
        orderReviewModeration: await tx.orderReviewModeration.deleteMany(),
        orderReview: await tx.orderReview.deleteMany(),
        trustReport: await tx.trustReport.deleteMany(),
        chatMessage: await tx.chatMessage.deleteMany(),
        chatRoom: await tx.chatRoom.deleteMany(),
        orderAccountCredential: await tx.orderAccountCredential.deleteMany(),
        orderEvent: await tx.orderEvent.deleteMany(),
        buyRequestOffer: await tx.buyRequestOffer.deleteMany(),
        order: await tx.order.deleteMany(),
        listingImage: await tx.listingImage.deleteMany(),
        listingInventory: await tx.listingInventory.deleteMany(),
        buyRequestImage: await tx.buyRequestImage.deleteMany(),
        buyRequest: await tx.buyRequest.deleteMany(),
        listing: await tx.listing.deleteMany(),
        withdrawalLog: await tx.withdrawalLog.deleteMany(),
        withdrawalRequest: await tx.withdrawalRequest.deleteMany(),
        depositRequest: await tx.depositRequest.deleteMany(),
        walletLedgerEntry: await tx.walletLedgerEntry.deleteMany(),
        notification: await tx.notification.deleteMany(),
        adminFinanceCloseReport: await tx.adminFinanceCloseReport.deleteMany(),
        adminSlaIncidentNote: await tx.adminSlaIncidentNote.deleteMany(),
        adminSlaIncident: await tx.adminSlaIncident.deleteMany(),
        supportInquiry: await tx.supportInquiry.deleteMany(),
        adminAuditLog: await tx.adminAuditLog.deleteMany(),
      };

      const walletsReset = await tx.wallet.updateMany({
        data: RESET_WALLET_BALANCES,
      });

      return {
        deleted: Object.fromEntries(
          Object.entries(deleted).map(([model, value]) => [model, value.count]),
        ),
        walletsReset: walletsReset.count,
      };
    });

    const after = await countModels(prisma);

    return NextResponse.json({
      ok: true,
      before,
      result,
      after,
      preserved: {
        users: after.user,
        wallets: after.wallet,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown cleanup error",
        name: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack?.slice(0, 1600) : null,
      },
      { status: 500 },
    );
  }
}

async function countModels(prisma: ReturnType<typeof getPrismaClient>) {
  const [
    user,
    wallet,
    listing,
    listingImage,
    listingInventory,
    buyRequest,
    buyRequestImage,
    buyRequestOffer,
    order,
    orderAccountCredential,
    chatRoom,
    chatMessage,
    orderEvent,
    orderReview,
    orderReviewModeration,
    depositRequest,
    withdrawalRequest,
    withdrawalLog,
    walletLedgerEntry,
    notification,
    trustReport,
    adminAuditLog,
    adminFinanceCloseReport,
    supportInquiry,
    adminSlaIncident,
    adminSlaIncidentNote,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.wallet.count(),
    prisma.listing.count(),
    prisma.listingImage.count(),
    prisma.listingInventory.count(),
    prisma.buyRequest.count(),
    prisma.buyRequestImage.count(),
    prisma.buyRequestOffer.count(),
    prisma.order.count(),
    prisma.orderAccountCredential.count(),
    prisma.chatRoom.count(),
    prisma.chatMessage.count(),
    prisma.orderEvent.count(),
    prisma.orderReview.count(),
    prisma.orderReviewModeration.count(),
    prisma.depositRequest.count(),
    prisma.withdrawalRequest.count(),
    prisma.withdrawalLog.count(),
    prisma.walletLedgerEntry.count(),
    prisma.notification.count(),
    prisma.trustReport.count(),
    prisma.adminAuditLog.count(),
    prisma.adminFinanceCloseReport.count(),
    prisma.supportInquiry.count(),
    prisma.adminSlaIncident.count(),
    prisma.adminSlaIncidentNote.count(),
  ]);

  const wallets = await prisma.wallet.aggregate({
    _sum: {
      availableBalance: true,
      escrowLockedBalance: true,
      buyRequestLocked: true,
      pendingSettlement: true,
      withdrawableBalance: true,
      withdrawalLocked: true,
    },
  });

  return {
    user,
    wallet,
    listing,
    listingImage,
    listingInventory,
    buyRequest,
    buyRequestImage,
    buyRequestOffer,
    order,
    orderAccountCredential,
    chatRoom,
    chatMessage,
    orderEvent,
    orderReview,
    orderReviewModeration,
    depositRequest,
    withdrawalRequest,
    withdrawalLog,
    walletLedgerEntry,
    notification,
    trustReport,
    adminAuditLog,
    adminFinanceCloseReport,
    supportInquiry,
    adminSlaIncident,
    adminSlaIncidentNote,
    walletTotals: {
      availableBalance: wallets._sum.availableBalance?.toString() ?? "0",
      escrowLockedBalance: wallets._sum.escrowLockedBalance?.toString() ?? "0",
      buyRequestLocked: wallets._sum.buyRequestLocked?.toString() ?? "0",
      pendingSettlement: wallets._sum.pendingSettlement?.toString() ?? "0",
      withdrawableBalance: wallets._sum.withdrawableBalance?.toString() ?? "0",
      withdrawalLocked: wallets._sum.withdrawalLocked?.toString() ?? "0",
    },
  };
}

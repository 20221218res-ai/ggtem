import { getPrismaClient } from "@/lib/prisma";

export type MarketplaceSellerProfile = {
  sellerId: string;
  sellerName: string;
  joinedAt: string;
  activeListingCount: number;
  totalAvailableQuantity: string;
  reviewSummary: {
    averageRating: string;
    reviewCount: number;
  };
  trustSignals: {
    lowRecentReviewCount: number;
    openReportCount: number;
    highSeverityOpenReportCount: number;
  };
  recentReviews: Array<{
    reviewId: string;
    rating: number;
    comment: string | null;
    buyerName: string;
    orderNumber: string;
    createdAt: string;
  }>;
  listings: Array<{
    listingId: string;
    title: string;
    gameName: string;
    category: string;
    unitPrice: string;
    currency: string;
    availableQuantity: string;
    lockedQuantity: string;
    soldQuantity: string;
    createdAt: string;
  }>;
};

export async function getMarketplaceSellerProfile(
  sellerId: string,
): Promise<MarketplaceSellerProfile | null> {
  const prisma = getPrismaClient();
  const seller = await prisma.user.findUnique({
    where: {
      id: sellerId,
    },
    include: {
      listings: {
        where: {
          status: "ACTIVE",
          inventory: {
            is: {
              availableQuantity: {
                gt: 0,
              },
            },
          },
        },
        include: {
          inventory: true,
          game: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      },
    },
  });

  if (!seller) {
    return null;
  }

  const recentSignalStart = new Date();
  recentSignalStart.setDate(recentSignalStart.getDate() - 30);

  const [reviewAggregate, recentReviews, lowRecentReviewCount, openReportCount, highSeverityOpenReportCount] =
    await Promise.all([
    prisma.orderReview.aggregate({
      where: {
        sellerId: seller.id,
        OR: [
          {
            moderation: null,
          },
          {
            moderation: {
              is: {
                status: {
                  not: "HIDDEN",
                },
              },
            },
          },
        ],
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    }),
    prisma.orderReview.findMany({
      where: {
        sellerId: seller.id,
        OR: [
          {
            moderation: null,
          },
          {
            moderation: {
              is: {
                status: {
                  not: "HIDDEN",
                },
              },
            },
          },
        ],
      },
      include: {
        buyer: true,
        order: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    prisma.orderReview.count({
      where: {
        sellerId: seller.id,
        rating: {
          lte: 2,
        },
        createdAt: {
          gte: recentSignalStart,
        },
      },
    }),
    prisma.trustReport.count({
      where: {
        targetUserId: seller.id,
        status: {
          in: ["OPEN", "UNDER_REVIEW"],
        },
      },
    }),
    prisma.trustReport.count({
      where: {
        targetUserId: seller.id,
        status: {
          in: ["OPEN", "UNDER_REVIEW"],
        },
        severity: {
          in: ["HIGH", "CRITICAL"],
        },
      },
    }),
  ]);

  const totalAvailableQuantity = seller.listings.reduce((sum, listing) => {
    const nextValue = listing.inventory?.availableQuantity ?? 0;
    return sum + Number(nextValue);
  }, 0);

  return {
    sellerId: seller.id,
    sellerName: seller.displayName,
    joinedAt: formatKoreanDate(seller.createdAt),
    activeListingCount: seller.listings.length,
    totalAvailableQuantity: totalAvailableQuantity.toString(),
    reviewSummary: {
      averageRating: (reviewAggregate._avg.rating ?? 0).toFixed(1),
      reviewCount: reviewAggregate._count.rating,
    },
    trustSignals: {
      lowRecentReviewCount,
      openReportCount,
      highSeverityOpenReportCount,
    },
    recentReviews: recentReviews.map((review) => ({
      reviewId: review.id,
      rating: review.rating,
      comment: review.comment,
      buyerName: review.buyer.displayName,
      orderNumber: review.order.orderNumber,
      createdAt: formatKoreanDate(review.createdAt),
    })),
    listings: seller.listings.map((listing) => ({
      listingId: listing.id,
      title: listing.title,
      gameName: listing.game.name,
      category: listing.category,
      unitPrice: listing.unitPrice.toString(),
      currency: listing.currency,
      availableQuantity: listing.inventory?.availableQuantity.toString() ?? "0",
      lockedQuantity: listing.inventory?.lockedQuantity.toString() ?? "0",
      soldQuantity: listing.inventory?.soldQuantity.toString() ?? "0",
      createdAt: formatKoreanDate(listing.createdAt),
    })),
  };
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export type OrderReviewResult = {
  reviewId: string;
  rating: number;
  message: string;
};

export async function createOrderReview(input: {
  orderId: string;
  rating: number;
  comment?: string;
}): Promise<OrderReviewResult> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();
  const rating = Number(input.rating);
  const comment = input.comment?.trim() || null;

  if (!sessionUser || sessionUser.role !== "CUSTOMER") {
    throw new Error("구매자만 완료된 주문에 리뷰를 남길 수 있습니다.");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("평점은 1점부터 5점까지 입력할 수 있습니다.");
  }

  if (comment && comment.length > 1000) {
    throw new Error("리뷰 내용은 1000자 이하로 입력해 주세요.");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        buyerId: sessionUser.userId,
      },
      include: {
        review: true,
      },
    });

    if (!order) {
      throw new Error("내 구매 주문을 찾을 수 없습니다.");
    }

    if (order.status !== "COMPLETED") {
      throw new Error("완료된 주문만 리뷰를 남길 수 있습니다.");
    }

    if (order.review) {
      throw new Error("이미 리뷰를 작성한 주문입니다.");
    }

    const review = await tx.orderReview.create({
      data: {
        orderId: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        rating,
        comment,
      },
    });

    if (rating <= 2) {
      const severity = rating === 1 ? "HIGH" : "MEDIUM";

      const report = await tx.trustReport.create({
        data: {
          reporterId: order.buyerId,
          targetUserId: order.sellerId,
          orderId: order.id,
          category: "OTHER",
          severity,
          sourceType: "ORDER_REVIEW",
          sourceId: review.id,
          description: [
            `주문 ${order.orderNumber}의 ${rating}/5 구매자 리뷰에서 자동 생성되었습니다.`,
            comment ? `구매자 코멘트: ${comment}` : "구매자가 코멘트를 남기지 않았습니다.",
          ].join(" "),
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: "LOW_REVIEW_TRUST_REPORT_CREATED",
          targetType: "TRUST_REPORT",
          targetId: report.id,
          reason: `${rating}/5 review auto-escalated for order ${order.orderNumber}`,
          after: {
            reportId: report.id,
            reviewId: review.id,
            orderId: order.id,
            sellerId: order.sellerId,
            rating,
            severity,
          },
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: order.sellerId,
        type: "SYSTEM",
        title: "구매자 리뷰가 등록되었습니다",
        body: `주문 ${order.orderNumber}에 ${rating}/5 리뷰가 등록되었습니다.`,
        href: `/my/listings/orders/${order.id}`,
        metadata: {
          orderId: order.id,
          reviewId: review.id,
          rating,
        },
      },
    });

    return {
      reviewId: review.id,
      rating: review.rating,
      message:
        rating <= 2
          ? "리뷰가 등록되었습니다. 낮은 평점은 거래 안전 검토 신호로 함께 기록됩니다."
          : "리뷰가 등록되었습니다.",
    };
  });
}

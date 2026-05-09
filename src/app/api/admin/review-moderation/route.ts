import { NextRequest, NextResponse } from "next/server";
import {
  updateReviewModerationReportStatus,
  updateReviewModerationReviewStatus,
} from "@/lib/admin/review-moderation";
import { requireApiRole, ROLE_GROUPS } from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole(ROLE_GROUPS.ORDER_OPERATORS);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      target?: "REPORT" | "REVIEW";
      reportId?: string;
      reviewId?: string;
      status?: string;
      resolutionNote?: string;
      reason?: string;
    };

    if (body.target === "REVIEW") {
      if (!body.reviewId || !body.status || !body.reason) {
        return NextResponse.json(
          {
            message: "리뷰 ID, 상태, 처리 사유가 필요합니다.",
          },
          {
            status: 400,
          },
        );
      }

      const result = await updateReviewModerationReviewStatus({
        actorId: auth.user.userId,
        reviewId: body.reviewId,
        status: body.status,
        reason: body.reason,
      });

      return NextResponse.json(result);
    }

    if (!body.reportId || !body.status || !body.resolutionNote) {
      return NextResponse.json(
        {
          message: "신고 ID, 상태, 처리 메모가 필요합니다.",
        },
        {
          status: 400,
        },
      );
    }

    const result = await updateReviewModerationReportStatus({
      actorId: auth.user.userId,
      reportId: body.reportId,
      status: body.status,
      resolutionNote: body.resolutionNote,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "리뷰 모더레이션 상태를 변경하지 못했습니다.",
      },
      {
        status: 400,
      },
    );
  }
}
